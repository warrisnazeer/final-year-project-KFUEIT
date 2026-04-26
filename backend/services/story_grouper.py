"""
Story Grouper — Clusters articles from different outlets covering the same event.

Uses TF-IDF vectorization + cosine similarity with average-linkage clustering.
Also enforces time proximity: articles must be published within 48 hours of
at least one cluster member to prevent stale articles from being mis-grouped.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# Minimum similarity for two articles to be considered the same story
SIMILARITY_THRESHOLD = 0.20
# Max articles per story cluster to avoid mega-clusters
MAX_CLUSTER_SIZE = 20
# Max time gap between any two articles in the same cluster
MAX_TIME_GAP = timedelta(hours=48)


def group_articles(articles: list) -> dict:
    """
    Groups articles into stories using average-linkage clustering
    with time-proximity enforcement.

    articles: list of dicts with keys: article_id, title, content, publish_date (optional)

    An article joins a cluster only if:
      1. Its average text similarity to cluster members >= SIMILARITY_THRESHOLD
      2. It was published within 48 hours of at least one cluster member

    Returns: dict mapping article_id -> group_id (int)
    """
    if not articles:
        return {}

    if len(articles) == 1:
        return {articles[0]["article_id"]: 0}

    # Use titles and a snippet of content to improve matching context
    texts = [f"{a['title']} {str(a.get('content', ''))[:200]}" for a in articles]

    # Extract publish dates (fall back to None if missing)
    dates = []
    for a in articles:
        d = a.get("publish_date")
        if isinstance(d, datetime):
            dates.append(d)
        else:
            dates.append(None)

    try:
        vectorizer = TfidfVectorizer(
            max_features=500,
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
    groups: list[list[int]] = []  # each entry is a list of article indices

    for i in range(n):
        best_group = None
        best_avg_sim = 0.0

        for g_idx, group in enumerate(groups):
            if len(group) >= MAX_CLUSTER_SIZE:
                continue

            # Text similarity check
            avg_sim = sum(sim_matrix[i][j] for j in group) / len(group)
            if avg_sim < SIMILARITY_THRESHOLD or avg_sim <= best_avg_sim:
                continue

            # Time proximity check: article must be within 48h of at least
            # one existing member. Skip check if dates are missing.
            if dates[i] is not None:
                time_ok = False
                for j in group:
                    if dates[j] is None:
                        time_ok = True  # can't verify, allow it
                        break
                    if abs((dates[i] - dates[j]).total_seconds()) <= MAX_TIME_GAP.total_seconds():
                        time_ok = True
                        break
                if not time_ok:
                    continue
            # If date is None for this article, we skip the time check (allow it)

            best_avg_sim = avg_sim
            best_group = g_idx

        if best_group is not None:
            groups[best_group].append(i)
        else:
            groups.append([i])

    result = {}
    for group_id, indices in enumerate(groups):
        for idx in indices:
            result[articles[idx]["article_id"]] = group_id

    logger.info(f"Grouped {n} articles into {len(groups)} story clusters.")
    return result
