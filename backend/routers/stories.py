"""
Stories Router — story-centric endpoints, Ground News style.

GET  /api/stories/              — feed of multi-outlet stories (supports ?topic=Politics)
GET  /api/stories/blindspot     — blindspot feed (stories dominated by one side)
GET  /api/stories/{story_id}    — full story detail + articles
POST /api/stories/{story_id}/summarize  — generate Gemini summary
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from database import get_db
from models import Article, NewsOutlet, AnalysisResult, Story, StorySummary
from services.story_summarizer import generate_story_summary, run_deep_bias_scoring
from services.bias_classifier import classify_article, BIAS_CATEGORIES, OUTLET_PRIORS
from services.framing_analyzer import analyze_framing
from services.topic_tagger import tag_story_topic, compute_blindspot
from scrapers.rss_scraper import search_outlets, _fetch_full_article
from datetime import datetime
import json

router = APIRouter()
logger = logging.getLogger(__name__)

LEFT_LABELS  = {"Far Left", "Lean Left", "Left"}
RIGHT_LABELS = {"Far Right", "Lean Right", "Right"}


# ─── helpers ────────────────────────────────────────────────────────────────

def _article_to_dict(a: Article) -> dict:
    score = None
    if a.analysis and a.analysis.bias_score is not None:
        score = round(a.analysis.bias_score, 4)
    factuality = None
    if a.outlet:
        factuality = getattr(a.outlet, "factuality", None) or "Mixed"
    return {
        "article_id":   a.article_id,
        "title":        a.title,
        "url":          a.url,
        "image_url":    getattr(a, "image_url", None),
        "outlet":       a.outlet.name if a.outlet else "Unknown",
        "factuality":   factuality,
        "bias_label":   a.bias_label or "Center",
        "framing_tone": a.framing_tone or "Neutral",
        "bias_score":   score,
        "publish_date": a.publish_date.isoformat() if a.publish_date else None,
    }


def _build_story_dict(story_id: int, db: Session, include_articles: bool = True) -> dict | None:
    articles = (
        db.query(Article)
        .filter(Article.story_id == story_id)
        .order_by(Article.publish_date.desc())
        .all()
    )
    if not articles:
        return None

    summary   = db.query(StorySummary).filter(StorySummary.story_id == story_id).first()
    story_row = db.query(Story).filter(Story.story_id == story_id).first()

    outlet_positions: dict[str, dict] = {}
    left_count = center_count = right_count = 0
    outlet_article_count: dict[str, int] = {}
    capped_articles = []
    cover_image = None

    for a in articles:
        outlet_name = a.outlet.name if a.outlet else "Unknown"
        score = (a.analysis.bias_score if a.analysis and a.analysis.bias_score is not None else 0.0)
        label = a.bias_label or "Center"

        if cover_image is None:
            img = getattr(a, "image_url", None)
            if img:
                cover_image = img

        if outlet_name not in outlet_positions:
            outlet_positions[outlet_name] = {
                "outlet":      outlet_name,
                "bias_score":  round(score, 4),
                "bias_label":  label,
                "factuality":  getattr(a.outlet, "factuality", "Mixed") if a.outlet else "Mixed",
            }

        if label in LEFT_LABELS:
            left_count += 1
        elif label in RIGHT_LABELS:
            right_count += 1
        else:
            center_count += 1

        outlet_article_count[outlet_name] = outlet_article_count.get(outlet_name, 0) + 1
        if outlet_article_count[outlet_name] <= 2:
            capped_articles.append(a)

    sorted_positions = sorted(outlet_positions.values(), key=lambda x: x["bias_score"])

    story_title = (
        (summary.story_title if summary and summary.story_title else None)
        or articles[0].title
    )

    latest_date = None
    for a in articles:
        if a.publish_date:
            latest_date = a.publish_date.isoformat()
            break

    topic_tag = getattr(story_row, "topic_tag", "General") or "General"
    # Topics where political bias analysis is not meaningful
    bias_skip = topic_tag in {"Sports", "Technology", "Business"}

    result = {
        "story_id":       story_id,
        "story_title":    story_title,
        "cover_image":    cover_image,
        "topic_tag":      topic_tag,
        "bias_skip":      bias_skip,
        "blindspot_side": getattr(story_row, "blindspot_side", None),
        "outlets_covering": list(outlet_positions.keys()),
        "outlet_count":   len(outlet_positions),
        "article_count":  len(articles),
        "left_count":     left_count,
        "center_count":   center_count,
        "right_count":    right_count,
        "outlet_positions": sorted_positions,
        "has_summary":    summary is not None,
        "latest_date":    latest_date,
        "summary": {
            "story_title":     summary.story_title,
            "what_happened":   getattr(summary, "what_happened",  "") or "",
            "neutral_summary": summary.neutral_summary,
            "key_actors":      getattr(summary, "key_actors",     "") or "",
            "why_it_matters":  getattr(summary, "why_it_matters", "") or "",
            "left_framing":    summary.left_framing,
            "right_framing":   summary.right_framing,
            "generated_by":    summary.generated_by,
        } if summary else None,
    }

    if include_articles:
        result["articles"] = [_article_to_dict(a) for a in capped_articles]

    return result


# ─── endpoints ──────────────────────────────────────────────────────────────

@router.get("/blindspot")
def list_blindspot_stories(
    side:  Optional[str] = Query(None, description="'Left' or 'Right'"),
    limit: int = 20,
    skip:  int = 0,
    db: Session = Depends(get_db),
):
    """
    Return stories where coverage is heavily skewed to one political side.
    side='Left'  → stories dominated by right-wing outlets (left audience missing this)
    side='Right' → stories dominated by left-wing outlets (right audience missing this)
    """
    rows = (
        db.query(Article.story_id)
        .filter(Article.story_id.isnot(None))
        .group_by(Article.story_id)
        .having(func.count(func.distinct(Article.outlet_id)) >= 2)
        .order_by(func.max(Article.scraped_at).desc())
        .all()
    )

    stories = []
    for (story_id,) in rows:
        story_row = db.query(Story).filter(Story.story_id == story_id).first()
        if not story_row:
            continue
        bs = getattr(story_row, "blindspot_side", None)
        if bs is None:
            continue
        if side and bs != side:
            continue
        data = _build_story_dict(story_id, db, include_articles=False)
        if data:
            stories.append(data)

    return stories[skip: skip + limit]


@router.get("/")
def list_stories(
    limit: int = 30,
    skip:  int = 0,
    topic: Optional[str] = Query(None, description="Filter by topic tag"),
    db: Session = Depends(get_db),
):
    """
    Return stories covered by ≥3 outlets, sorted by most recent article.
    Supports optional ?topic=Politics|Economy|Security|… filter.
    Does NOT include individual articles (use /{story_id} for that).
    """
    rows = (
        db.query(Article.story_id)
        .filter(Article.story_id.isnot(None))
        .group_by(Article.story_id)
        .having(func.count(func.distinct(Article.outlet_id)) >= 2)
        .order_by(func.max(Article.scraped_at).desc())
        .all()
    )

    stories = []
    for (story_id,) in rows:
        if topic and topic != "All":
            story_row = db.query(Story).filter(Story.story_id == story_id).first()
            if not story_row:
                continue
            if (story_row.topic_tag or "General") != topic:
                continue

        data = _build_story_dict(story_id, db, include_articles=False)
        if data:
            stories.append(data)

    return stories[skip: skip + limit]


@router.get("/{story_id}")
def get_story(story_id: int, db: Session = Depends(get_db)):
    """Full story detail including all articles."""
    data = _build_story_dict(story_id, db, include_articles=True)
    if not data:
        raise HTTPException(status_code=404, detail="Story not found")
    return data


@router.post("/{story_id}/expand")
def expand_story(story_id: int, db: Session = Depends(get_db)):
    """
    Proactively search for more articles to add to this story.
    1. Search Google News for the story title.
    2. Fetch and analyze any new articles from supported outlets.
    3. Attach to story if similar enough.
    4. Automatically regenerate summary.
    """
    story = db.query(Story).filter(Story.story_id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    # Get existing articles to build a similarity profile
    existing_articles = db.query(Article).filter(Article.story_id == story_id).all()
    if not existing_articles:
        raise HTTPException(status_code=400, detail="Story has no articles")

    story_title = story.story_title or existing_articles[0].title
    logger.info(f"Expanding story {story_id}: '{story_title}'")

    # 1. Search Google News for more articles
    search_results = search_outlets(story_title, limit=10)
    
    new_found = 0
    for res in search_results:
        # Skip if already exists
        if db.query(Article).filter(Article.url == res["url"]).first():
            continue

        outlet = db.query(NewsOutlet).filter(NewsOutlet.name == res["outlet_name"]).first()
        if not outlet:
            continue

        # 2. Fetch full content and analyze
        content = _fetch_full_article(res["url"]) or ""
        if len(content) < 200:
            continue # Skip low quality/failed fetches
            
        bias = classify_article(res["title"], content, res["outlet_name"])
        framing = analyze_framing(res["title"], content)

        # 3. Create and attach article
        article = Article(
            title=res["title"],
            content=content,
            url=res["url"],
            publish_date=res["publish_date"],
            bias_label=bias["bias_label"],
            framing_tone=framing["framing_type"],
            outlet_id=outlet.outlet_id,
            story_id=story_id, # Attach directly
        )
        db.add(article)
        db.flush()

        result = AnalysisResult(
            bias_score=bias["bias_score"],
            sentiment_score=framing["sentiment_score"],
            framing_type=framing["framing_type"],
            confidence_score=bias["confidence_score"],
            zero_shot_scores=bias["zero_shot_scores"],
            article_id=article.article_id,
        )
        db.add(result)
        new_found += 1

    if new_found > 0:
        db.commit()
        logger.info(f"Found {new_found} new articles for story {story_id}")
        
        # Update story metadata (topic, blindspot)
        all_articles = db.query(Article).filter(Article.story_id == story_id).all()
        titles = [a.title for a in all_articles]
        labels = [a.bias_label or "Center" for a in all_articles]
        story.topic_tag = tag_story_topic(titles)
        story.blindspot_side = compute_blindspot(labels)
        db.commit()

    return _build_story_dict(story_id, db, include_articles=True)


@router.post("/{story_id}/summarize")
def summarize_story(story_id: int, db: Session = Depends(get_db)):
    """Generate (or regenerate) a Gemini summary for this story."""
    try:
        _run_story_summary(story_id, db)
        return _build_story_dict(story_id, db, include_articles=True)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Manual summary generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _run_story_summary(story_id: int, db: Session):
    """Internal helper to run the summary pipeline."""
    articles = (
        db.query(Article)
        .filter(Article.story_id == story_id)
        .all()
    )
    if not articles:
        raise HTTPException(status_code=404, detail="No articles found for story")

    # One article per outlet (best representative), sorted left → right
    seen_outlets: set = set()
    deduped = []
    for a in sorted(articles, key=lambda x: (x.analysis.bias_score if x.analysis and x.analysis.bias_score is not None else 0)):
        outlet_name = a.outlet.name if a.outlet else "Unknown"
        if outlet_name not in seen_outlets:
            seen_outlets.add(outlet_name)
            deduped.append(a)

    # 1. Cap articles to top 6 balanced by bias (2 L, 2 C, 2 R)
    lefts   = [a for a in articles if a.analysis and a.analysis.bias_score is not None and a.analysis.bias_score < -0.15]
    rights  = [a for a in articles if a.analysis and a.analysis.bias_score is not None and a.analysis.bias_score > 0.15]
    centers = [a for a in articles if a not in lefts and a not in rights]

    # Pick best representatives
    def get_top(arr, n): return sorted(arr, key=lambda x: x.scraped_at, reverse=True)[:n]
    balanced = get_top(lefts, 2) + get_top(centers, 2) + get_top(rights, 2)

    article_dicts = [
        {
            "outlet":     a.outlet.name if a.outlet else "Unknown",
            "title":      a.title,
            "content":    (a.content or "")[:150], # Reduced to 150 for tokens
            "bias_label": a.bias_label or "Center",
            "bias_score": (a.analysis.bias_score if a.analysis and a.analysis.bias_score is not None else 0.0),
            "url":        a.url,
        }
        for a in balanced
    ]

    result = generate_story_summary(article_dicts)

    # None means quota exceeded
    if result is None:
        raise HTTPException(
            status_code=503,
            detail="AI quota exceeded. Please try again in a minute.",
        )
        
    if result.get("generated_by") == "fallback":
        raise HTTPException(
            status_code=500,
            detail="AI generation failed. Please check your Narrative Engine key in the Railway dashboard.",
        )

    existing = db.query(StorySummary).filter(StorySummary.story_id == story_id).first()
    if existing:
        existing.story_title     = result["story_title"]
        existing.what_happened   = result.get("what_happened", "")
        existing.neutral_summary = result["neutral_summary"]
        existing.key_actors      = result.get("key_actors", "")
        existing.why_it_matters  = result.get("why_it_matters", "")
        existing.left_framing    = result["left_framing"]
        existing.right_framing   = result["right_framing"]
        existing.generated_by    = result["generated_by"]
    else:
        db.add(StorySummary(
            story_id        = story_id,
            story_title     = result["story_title"],
            what_happened   = result.get("what_happened", ""),
            neutral_summary = result["neutral_summary"],
            key_actors      = result.get("key_actors", ""),
            why_it_matters  = result.get("why_it_matters", ""),
            left_framing    = result["left_framing"],
            right_framing   = result["right_framing"],
            generated_by    = result["generated_by"],
        ))
    db.commit()


@router.post("/{story_id}/deep-bias", response_model=dict)
def run_deep_bias(story_id: int, db: Session = Depends(get_db)):
    story = db.query(Story).filter(Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    articles = db.query(Article).filter(Article.story_id == story_id).all()
    if not articles:
        raise HTTPException(status_code=404, detail="No articles found for story")

    # Limit to 10 for tokens
    article_dicts = []
    for a in articles[:10]:
        outlet_name = a.outlet.name if a.outlet else "Unknown"
        article_dicts.append({
            "id": str(a.id),
            "title": a.title,
            "outlet": outlet_name,
            "content": (a.content or "")[:200]
        })

    scores = run_deep_bias_scoring(article_dicts)

    if not scores:
        raise HTTPException(status_code=500, detail="Narrative Engine failed to analyze bias.")

    # Track changes
    for a in articles:
        str_id = str(a.id)
        if str_id in scores:
            try:
                ai_score = float(scores[str_id])
            except ValueError:
                continue
                
            outlet_name = a.outlet.name if a.outlet else "Unknown"
            prior_score = OUTLET_PRIORS.get(outlet_name, 0.0)
            
            # New stealth formula: 80% Narrative Engine, 20% Priors
            new_score = (ai_score * 0.8) + (prior_score * 0.2)
            
            if a.analysis:
                a.analysis.bias_score = new_score
            else:
                a.analysis = AnalysisResult(
                    article_id=a.article_id,
                    bias_score=new_score,
                    framing_type="Neutral"
                )
                db.add(a.analysis)
                
            label = "Center"
            for cat, r in BIAS_CATEGORIES.items():
                if r[0] <= new_score <= r[1]:
                    label = cat
                    break
            a.bias_label = label

    db.commit()

    labels = [a.bias_label for a in articles if a.bias_label]
    story.blindspot_side = compute_blindspot(labels)
    db.commit()

    return _build_story_dict(story_id, db, include_articles=True)
