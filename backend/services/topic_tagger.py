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
        "ceasefire", "truce", "peace deal", "peace talks", "cease fire",
        "armistice", "peace agreement", "mediation", "de-escalation",
        "operation sindoor", "surgical strike", "loc", "line of control",
        "pakistan india war", "india pakistan war", "indo-pak", "indo pak",
        "cross-border", "cross border firing", "shelling", "warplane",
        "missile attack", "drone attack", "aerial attack", "border clash",
        "historic response", "marka", "marka-e-haq", "marka-i-haq",
    ],
    "Security": [
        "military", "army", "air force", "navy", "soldier", "bomb",
        "blast", "attack", "terrorist", "terrorism", "ctd", "isi",
        "counter-terrorism", "militant", "fatalities", "shootout",
        "ied", "security forces", "ttp", "killed", "martyred",
        "idf", "airstrike", "air strike", "missile", "drone", "jets",
        "garrison", "corps commander", "ispr", "fighter jet", "warship",
        "martyrs", "shaheed", "war", "warfare", "defense", "defence",
    ],
    "International": [
        "india", "china", "united states", "afghanistan", "iran",
        "united nations", "world bank", "nato", "sco", "saudi arabia",
        "foreign minister", "diplomat", "embassy", "sanctions", "bilateral",
        "trump", "modi", "xi jinping", "eu ", "european union",
        "imf", "international monetary fund", "global", "foreign policy",
        "british", "france", "russia", "ukraine", "israel", "gaza",
        "hormuz", "gulf", "middle east", "saarc", "asean",
    ],
    "Economy": [
        "economy", "gdp", "inflation", "rupee", "dollar", "budget",
        "fiscal", "tax", "revenue", "state bank", "interest rate",
        "exports", "imports", "current account", "debt", "poverty",
        "unemployment", "wages", "price hike", "petrol", "petroleum",
        "electricity", "power tariff", "load shedding", "subsidies",
        "imf loan", "bailout", "forex", "foreign reserves", "remittances",
        "sbp", "economic growth", "trade deficit", "balance of payments",
    ],
    "Business": [
        "company", "corporation", "stock", "kse", "psx", "shares",
        "market cap", "ipo", "investment", "trade", "commerce",
        "merger", "acquisition", "quarterly", "profit", "loss", "ceo",
        "privatization", "privatisation", "psmc", "pia", "ptcl",
    ],
    "Legal": [
        "court", "supreme court", "high court", "judge", "verdict",
        "conviction", "acquitted", "hearing", "petition", "lawyer",
        "attorney", "prosecution", "bail", "arrested", "indicted",
        "accountability", "nab", "fia", "pca", "fir", "case filed",
        "sentenced", "contempt", "judicial", "chief justice",
    ],
    "Politics": [
        "parliament", "national assembly", "senate", "prime minister",
        "president", "cabinet", "minister", "opposition", "pti", "pmln",
        "ppp", "mqm", "election", "vote", "political", "government",
        "party", "imran khan", "nawaz", "bilawal", "zardari", "shehbaz",
        "asim munir", "faiz hameed", "pdm", "coalition", "no-confidence",
        "by-election", "legislator", "chief minister", "governor",
    ],
    "Sports": [
        "cricket", "pcb", "match", "test match", "odi", "t20", "psl",
        "football", "hockey", "squash", "world cup", "tournament",
        "stadium", "wicket", "innings", "batting", "bowling", "century",
        "players", "champion", "qualifier", "semifinal", "final",
    ],
    "Technology": [
        "technology", "software", "artificial intelligence", "cybersecurity",
        "telecom", "5g", "internet", "digital", "startup", "tech giant",
        "google", "apple", "meta", "microsoft", "samsung", "huawei",
        "smartphone", "social media", "blockchain", "ecommerce",
    ],
    "Health": [
        "health", "hospital", "disease", "virus", "covid", "pandemic",
        "vaccine", "polio", "dengue", "cancer", "medicine", "doctor",
        "patient", "treatment", "surgery", "who ", "epidemic",
        "mental health", "nutrition", "mortality", "birth rate",
    ],
}

TOPIC_PRIORITY = [
    "Ceasefire", "Security", "International", "Legal", "Economy",
    "Business", "Politics", "Sports", "Technology", "Health",
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
