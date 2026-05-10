"""
Story Grouper — Clusters articles from different outlets covering the same event.

Uses TF-IDF vectorization + cosine similarity with average-linkage clustering.
Also enforces:
  1. Time proximity: articles must be published within 48 hours of a cluster member
  2. Title keyword overlap: articles must share at least 1 meaningful word in their
     titles before cosine similarity is even considered (prevents totally unrelated
     articles from clustering due to generic shared words in content)
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from datetime import datetime, timedelta
import re
import logging

logger = logging.getLogger(__name__)

# Minimum cosine similarity for two articles to be considered the same story
# Raised from 0.20 → 0.32 to prevent loosely-related clustering
SIMILARITY_THRESHOLD = 0.32

# Max articles per story cluster to avoid mega-clusters
MAX_CLUSTER_SIZE = 20

# Max time gap between any two articles in the same cluster
MAX_TIME_GAP = timedelta(hours=48)

# Words too generic to count as a meaningful title overlap
_TITLE_STOPWORDS = {
    "the", "a", "an", "in", "on", "at", "to", "for", "of", "and", "or",
    "but", "is", "are", "was", "were", "be", "been", "has", "have", "had",
    "will", "would", "could", "should", "may", "might", "can", "not",
    "with", "from", "by", "as", "this", "that", "it", "its", "he", "she",
    "his", "her", "they", "their", "we", "our", "you", "your", "after",
    "before", "over", "under", "new", "says", "said", "says", "amid",
    "about", "into", "out", "up", "down", "more", "than", "two", "three",
    "all", "one", "who", "what", "how", "when", "where", "why", "now",
    "still", "also", "just", "only", "first", "last", "next", "per",
}


def _title_keywords(title: str) -> set:
    """Extract meaningful words from a title (length >= 5, not a stopword)."""
    words = re.sub(r"[^\w\s]", " ", title.lower()).split()
    return {w for w in words if len(w) >= 5 and w not in _TITLE_STOPWORDS}


def _titles_share_keyword(title_a: str, title_b: str) -> bool:
    """Return True if two titles share at least 1 meaningful keyword."""
    kw_a = _title_keywords(title_a)
    kw_b = _title_keywords(title_b)
    return bool(kw_a & kw_b)


def group_articles(articles: list) -> dict:
    """
    Groups articles into stories using average-linkage clustering
    with time-proximity enforcement and title keyword pre-filtering.

    articles: list of dicts with keys: article_id, title, content, publish_date (optional)

    An article joins a cluster only if:
      1. It shares at least 1 meaningful title keyword with the cluster representative
      2. Its average text similarity to cluster members >= SIMILARITY_THRESHOLD
      3. It was published within 48 hours of at least one cluster member

    Returns: dict mapping article_id -> group_id (int)
    """
    if not articles:
        return {}

    if len(articles) == 1:
        return {articles[0]["article_id"]: 0}

    # Use title + snippet of content for TF-IDF
    texts = [f"{a['title']} {str(a.get('content', ''))[:300]}" for a in articles]

    # Extract publish dates
    dates = []
    for a in articles:
        d = a.get("publish_date")
        dates.append(d if isinstance(d, datetime) else None)

    try:
        vectorizer = TfidfVectorizer(
            max_features=600,
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True,
        )
        tfidf_matrix = vectorizer.fit_transform(texts)
        sim_matrix = cosine_similarity(tfidf_matrix)
    except Exception as e:
        logger.error(f"Story grouping failed: {e}")
        return {a["article_id"]: i for i, a in enumerate(articles)}

    n = len(articles)
    groups: list[list[int]] = []   # each entry: list of article indices
    group_titles: list[list[str]] = []  # parallel list of titles per group

    for i in range(n):
        best_group = None
        best_avg_sim = 0.0

        for g_idx, group in enumerate(groups):
            if len(group) >= MAX_CLUSTER_SIZE:
                continue

            # ── Gate 1: Title keyword overlap ────────────────────────────────
            # Article must share at least 1 meaningful word with the group's
            # first article (representative). This prevents generic content
            # similarity from creating nonsense clusters.
            rep_title = group_titles[g_idx][0]
            if not _titles_share_keyword(articles[i]["title"], rep_title):
                continue

            # ── Gate 2: TF-IDF cosine similarity ─────────────────────────────
            avg_sim = sum(sim_matrix[i][j] for j in group) / len(group)
            if avg_sim < SIMILARITY_THRESHOLD or avg_sim <= best_avg_sim:
                continue

            # ── Gate 3: Time proximity ────────────────────────────────────────
            if dates[i] is not None:
                time_ok = any(
                    dates[j] is None or
                    abs((dates[i] - dates[j]).total_seconds()) <= MAX_TIME_GAP.total_seconds()
                    for j in group
                )
                if not time_ok:
                    continue

            best_avg_sim = avg_sim
            best_group = g_idx

        if best_group is not None:
            groups[best_group].append(i)
            group_titles[best_group].append(articles[i]["title"])
        else:
            groups.append([i])
            group_titles.append([articles[i]["title"]])

    result = {}
    for group_id, indices in enumerate(groups):
        for idx in indices:
            result[articles[idx]["article_id"]] = group_id

    logger.info(f"Grouped {n} articles into {len(groups)} story clusters.")
    return result


