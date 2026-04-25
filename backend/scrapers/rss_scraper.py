import feedparser
import requests
import re
import time
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# All Pakistani English news outlets (15 active)
OUTLETS = [
    # ── Core outlets ──────────────────────────────────────────────────────────
    {
        "name": "Dawn",
        "rss_url": "https://www.dawn.com/feeds/home",
        "website_url": "https://www.dawn.com",
    },
    {
        "name": "Geo News",
        "rss_url": "https://www.geo.tv/rss/1/7",
        "website_url": "https://www.geo.tv",
    },
    {
        "name": "ARY News",
        "rss_url": "https://arynews.tv/feed/",
        "website_url": "https://arynews.tv",
    },
    {
        "name": "Express Tribune",
        "rss_url": "https://news.google.com/rss/search?q=site:tribune.com.pk&hl=en-PK&gl=PK&ceid=PK:en",
        "website_url": "https://tribune.com.pk",
    },
    {
        "name": "Samaa News",
        "rss_url": "https://news.google.com/rss/search?q=site:samaa.tv&hl=en-PK&gl=PK&ceid=PK:en",
        "website_url": "https://samaa.tv",
    },
    {
        "name": "Dunya News",
        "rss_url": "https://news.google.com/rss/search?q=site:dunyanews.tv&hl=en-PK&gl=PK&ceid=PK:en",
        "website_url": "https://dunyanews.tv",
    },
    # ── Secondary outlets ─────────────────────────────────────────────────────
    {
        "name": "Pakistan Today",
        "rss_url": "https://news.google.com/rss/search?q=site:pakistantoday.com.pk&hl=en-PK&gl=PK&ceid=PK:en",
        "website_url": "https://www.pakistantoday.com.pk",
    },
    {
        "name": "The Nation",
        "rss_url": "https://news.google.com/rss/search?q=site:nation.com.pk&hl=en-PK&gl=PK&ceid=PK:en",
        "website_url": "https://nation.com.pk",
    },
    {
        "name": "Naya Daur",
        "rss_url": "https://news.google.com/rss/search?q=site:nayadaur.tv&hl=en-PK&gl=PK&ceid=PK:en",
        "website_url": "https://nayadaur.tv",
    },
    {
        "name": "Aaj News",
        "rss_url": "https://news.google.com/rss/search?q=site:aaj.tv&hl=en-PK&gl=PK&ceid=PK:en",
        "website_url": "https://aaj.tv",
    },
    {
        "name": "Daily Times",
        "rss_url": "https://news.google.com/rss/search?q=site:dailytimes.com.pk&hl=en-PK&gl=PK&ceid=PK:en",
        "website_url": "https://dailytimes.com.pk",
    },
    {
        "name": "Pakistan Observer",
        "rss_url": "https://pakobserver.net/feed/",
        "website_url": "https://pakobserver.net",
    },
    # ── New high-output outlets ───────────────────────────────────────────────
    {
        "name": "Minute Mirror",
        "rss_url": "https://minutemirror.com.pk/feed/",
        "website_url": "https://minutemirror.com.pk",
    },
    {
        "name": "Dispatch News Desk",
        "rss_url": "https://news.google.com/rss/search?q=site:dnd.com.pk&hl=en-PK&gl=PK&ceid=PK:en",
        "website_url": "https://dnd.com.pk",
    },
    {
        "name": "ProPakistani",
        "rss_url": "https://propakistani.pk/feed/",
        "website_url": "https://propakistani.pk",
    },
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def _extract_image_url(entry) -> str | None:
    """
    Extract the best available image URL from an RSS entry.
    Checks media:content, media:thumbnail, enclosure, and summary img tags.
    """
    # media:content (most common in modern feeds)
    media_content = getattr(entry, "media_content", None)
    if media_content and isinstance(media_content, list):
        for mc in media_content:
            url = mc.get("url", "")
            if url and any(url.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")):
                return url
            if url and "image" in mc.get("type", ""):
                return url

    # media:thumbnail
    media_thumbnail = getattr(entry, "media_thumbnail", None)
    if media_thumbnail and isinstance(media_thumbnail, list) and media_thumbnail:
        url = media_thumbnail[0].get("url", "")
        if url:
            return url

    # enclosure (podcasts but also images)
    enclosures = getattr(entry, "enclosures", [])
    for enc in enclosures:
        if "image" in enc.get("type", ""):
            return enc.get("href") or enc.get("url")

    # Parse <img> tag from summary/content HTML
    summary = getattr(entry, "summary", "") or ""
    match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary)
    if match:
        url = match.group(1)
        if url.startswith("http"):
            return url

    return None


def _parse_date(entry) -> datetime:
    """Safely parse published date from RSS entry."""
    try:
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            return datetime(*entry.published_parsed[:6])
    except Exception:
        pass
    return datetime.utcnow()


def _get_content_from_entry(entry) -> str:
    """Extract best available text from RSS entry."""
    # Try content first (full text in some feeds)
    if hasattr(entry, "content") and entry.content:
        return entry.content[0].get("value", "")
    # Then summary
    if hasattr(entry, "summary") and entry.summary:
        return entry.summary
    # Finally description
    if hasattr(entry, "description") and entry.description:
        return entry.description
    return ""


def _fetch_full_article(url: str) -> str:
    """
    Fetch full article text using trafilatura (primary) or newspaper3k (fallback).
    Returns up to 3000 chars of clean body text.
    """
    # Primary: trafilatura — faster and more accurate
    try:
        import trafilatura
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
            if text and len(text) > 100:
                return text[:3000]
    except Exception:
        pass
    # Fallback: newspaper3k
    try:
        from newspaper import Article as NewsArticle
        article = NewsArticle(url, language="en")
        article.download()
        article.parse()
        if article.text and len(article.text) > 100:
            return article.text[:3000]
    except Exception:
        pass
    return ""


def fetch_outlet(outlet: dict, fetch_full: bool = False) -> list:
    """Fetch articles from a single outlet's RSS feed."""
    articles = []
    try:
        feed = feedparser.parse(
            outlet["rss_url"],
            request_headers=HEADERS,
            agent=HEADERS["User-Agent"]
        )

        if feed.bozo and not feed.entries:
            logger.warning(f"Feed parse warning for {outlet['name']}: {feed.bozo_exception}")

        for entry in feed.entries[:35]:
            title = (entry.get("title") or "").strip()
            url = (entry.get("link") or "").strip()

            if not title or not url:
                continue

            content = _get_content_from_entry(entry)

            # Only fetch full content if short summary found
            if fetch_full and len(content) < 200:
                content = _fetch_full_article(url) or content

            articles.append({
                "title": title,
                "url": url,
                "content": content[:3000],
                "image_url": _extract_image_url(entry),
                "publish_date": _parse_date(entry),
                "outlet_name": outlet["name"],
            })

    except Exception as e:
        logger.error(f"Failed to scrape {outlet['name']}: {e}")

    logger.info(f"  {outlet['name']}: {len(articles)} articles fetched")
    return articles


def scrape_all_outlets(fetch_full: bool = False) -> list:
    """Scrape all outlets and return combined list of article dicts."""
    all_articles = []

    for outlet in OUTLETS:
        articles = fetch_outlet(outlet, fetch_full=fetch_full)
        all_articles.extend(articles)
        time.sleep(1)  # polite delay between requests

    logger.info(f"Total fetched: {len(all_articles)} articles from {len(OUTLETS)} outlets")
    return all_articles
def search_outlets(query: str, limit: int = 15) -> list:
    """
    Proactively search for a specific query across all supported outlets.
    Uses Google News RSS search as a proxy.
    """
    logger.info(f"Deep Search: query='{query}'")
    
    # URL encode query
    from urllib.parse import quote
    safe_query = quote(query)
    
    # 1. Search Google News for this specific query
    # We don't restrict the site: in the query to avoid URL length limits,
    # instead we filter the results by our supported domains.
    search_url = f"https://news.google.com/rss/search?q={safe_query}&hl=en-PK&gl=PK&ceid=PK:en"
    
    feed = feedparser.parse(search_url)
    if not feed.entries:
        return []

    # Get active domains for filtering
    supported_domains = []
    for o in OUTLETS:
        domain = o["website_url"].replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
        supported_domains.append(domain)

    results = []
    for entry in feed.entries[:limit]:
        url = entry.link
        
        # Check if URL belongs to one of our supported outlets
        matched_outlet = None
        for o in OUTLETS:
            domain = o["website_url"].replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
            if domain in url:
                matched_outlet = o["name"]
                break
        
        if not matched_outlet:
            continue

        results.append({
            "title": entry.title.split(" - ")[0],
            "url": url,
            "outlet_name": matched_outlet,
            "publish_date": datetime(*entry.published_parsed[:6]) if hasattr(entry, "published_parsed") else datetime.utcnow(),
            "content": "", # Will be scraped on demand
        })

    return results
