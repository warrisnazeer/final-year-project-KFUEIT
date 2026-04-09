"""
Topic Tagger — keyword-based topic classification for story clusters.

Topics: Politics, Economy, Security, International, Sports,
        Business, Ceasefire, Technology, Legal, General
"""

import logging
import re

logger = logging.getLogger(__name__)

# Each topic has weighted keywords (signal strength matters)
TOPIC_KEYWORDS: dict[str, list[str]] = {
    "Ceasefire": [
        "ceasefire", "truce", "peace deal", "peace talks", "negotiations",
        "armistice", "conflict end", "peace agreement", "mediation",
    ],
    "Security": [
        "military", "army", "air force", "navy", "navy", "soldier", "bomb",
        "blast", "attack", "terrorist", "terrorism", "ctd", "isi",
        "counter-terrorism", "operation", "militant", "fatalities",
        "killed in", "shootout", "ied", "security forces", "ttp",
    ],
    "International": [
        "india", "china", "usa", "united states", "afghanistan", "iran",
        "sco", "un ", "united nations", "imf ", "world bank", "nato",
        "foreign minister", "diplomat", "embassy", "sanctions", "bilateral",
        "negotiations with", "trump", "modi", "xi jinping",
    ],
    "Economy": [
        "economy", "gdp", "inflation", "rupee", "dollar", "budget",
        "fiscal", "tax", "revenue", "sbp", "state bank", "interest rate",
        "exports", "imports", "current account", "debt", "poverty",
        "unemployment", "wages", "price hike",
    ],
    "Business": [
        "company", "corporation", "stock", "kse", "psx", "shares",
        "market", "ipo", "investment", "startup", "trade", "commerce",
        "merger", "acquisition", "quarterly", "profit", "loss", "ceo",
    ],
    "Legal": [
        "court", "supreme court", "high court", "judge", "verdict",
        "conviction", "acquitted", "hearing", "petition", "lawyer",
        "attorney", "prosecution", "bail", "arrested", "indicted",
        "accountability", "nab", "fia", "pca",
    ],
    "Politics": [
        "parliament", "national assembly", "senate", "prime minister",
        "president", "cabinet", "minister", "opposition", "pti", "pmln",
        "ppp", "mqm", "election", "vote", "political", "government",
        "party", "imran khan", "nawaz", "bilawal", "zardari",
    ],
    "Sports": [
        "cricket", "pcb", "pakistan team", "match", "test match",
        "odi ", "t20 ", "psl", "football", "hockey", "squash",
        "world cup", "players", "tournament", "stadium",
    ],
    "Technology": [
        "technology", "tech", "software", "ai ", "artificial intelligence",
        "meta", "google", "telecom", "5g", "internet", "cybersecurity",
        "digital ", "app ", "mobile", "startup",
    ],
}

TOPIC_PRIORITY = [
    "Ceasefire", "Security", "International", "Legal", "Economy",
    "Business", "Politics", "Sports", "Technology",
]


def tag_story_topic(titles: list[str]) -> str:
    """
    Assign a topic to a story cluster based on combined titles.

    Returns the highest-scoring topic name, or "General" if none match.
    """
    if not titles:
        return "General"

    combined = " ".join(titles).lower()
    combined = re.sub(r"[^\w\s]", " ", combined)

    scores: dict[str, int] = {}
    for topic, keywords in TOPIC_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw.lower() in combined)
        if score > 0:
            scores[topic] = score

    if not scores:
        return "General"

    # Resolve ties using priority order
    best_score = max(scores.values())
    candidates = [t for t in TOPIC_PRIORITY if scores.get(t, 0) == best_score]
    if candidates:
        return candidates[0]

    return max(scores, key=scores.get)


# ── Blindspot helpers ────────────────────────────────────────────────────────

LEFT_LABELS  = {"Far Left", "Lean Left", "Left"}
RIGHT_LABELS = {"Far Right", "Lean Right", "Right"}
BLINDSPOT_THRESHOLD = 0.70  # 70% one-sided → blindspot


def compute_blindspot(bias_labels: list[str]) -> str | None:
    """
    Determine which audience is in a blindspot.

    Returns:
      "Left"  — left-leaning audience should see this (right media dominates)
      "Right" — right-leaning audience should see this (left media dominates)
      None    — balanced enough, no blindspot
    """
    if not bias_labels:
        return None

    total = len(bias_labels)
    left_count  = sum(1 for l in bias_labels if l in LEFT_LABELS)
    right_count = sum(1 for l in bias_labels if l in RIGHT_LABELS)

    if right_count / total >= BLINDSPOT_THRESHOLD:
        # Mostly right-wing coverage → left readers are missing it
        return "Left"
    if left_count / total >= BLINDSPOT_THRESHOLD:
        # Mostly left-wing coverage → right readers are missing it
        return "Right"
    return None
