"""
Story Grouper — Clusters articles from different outlets covering the same event.

Uses TF-IDF vectorization + cosine similarity with complete-linkage clustering.
This prevents the "chaining" problem where unrelated articles end up in the same
cluster due to transitive similarity links.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import logging

logger = logging.getLogger(__name__)

# Minimum similarity for two articles to be considered the same story
SIMILARITY_THRESHOLD = 0.35
# Max articles per story cluster to avoid mega-clusters
MAX_CLUSTER_SIZE = 20


def group_articles(articles: list) -> dict:
    """
    Groups articles into stories using complete-linkage clustering.

    An article joins a cluster only if its similarity to EVERY existing
    member of the cluster is >= SIMILARITY_THRESHOLD (no chaining).

    articles: list of dicts with keys: article_id, title, content

    Returns: dict mapping article_id -> group_id (int)
    """
    if not articles:
        return {}

    if len(articles) == 1:
        return {articles[0]["article_id"]: 0}

    # Use titles only — more distinctive than title+content for short news
    texts = [a["title"] for a in articles]

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

            # Complete linkage: new article must be similar to ALL members
            min_sim = min(sim_matrix[i][j] for j in group)
            if min_sim >= SIMILARITY_THRESHOLD and min_sim > best_avg_sim:
                best_avg_sim = min_sim
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
