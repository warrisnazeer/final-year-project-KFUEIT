"""
Framing Analyzer — Detects tone/sentiment of articles.

Uses HuggingFace sentiment model when API key is available,
falls back to keyword-based scoring otherwise.

Output: framing_type (Positive/Neutral/Negative), sentiment_score (-1 to +1)
"""

import httpx
import os
import logging

logger = logging.getLogger(__name__)

_raw_key = os.getenv("HUGGINGFACE_API_KEY", "")
HF_API_KEY = _raw_key if (_raw_key.startswith("hf_") and len(_raw_key) > 15) else ""
SENTIMENT_URL = "https://router.huggingface.co/hf-inference/models/distilbert/distilbert-base-uncased-finetuned-sst-2-english"

POSITIVE_WORDS = [
    "progress", "success", "achievement", "growth", "improvement",
    "victory", "development", "hope", "solution", "positive", "relief",
    "celebrated", "approved", "launched", "agreed", "welcomed", "boost",
]

NEGATIVE_WORDS = [
    "crisis", "conflict", "violence", "corruption", "failure", "attack",
    "killed", "arrested", "banned", "protest", "tension", "collapse",
    "condemned", "rejected", "controversy", "scandal", "alleged", "accused",
]


def _keyword_framing(title: str, content: str) -> dict:
    text = (title + " " + (content or "")).lower()
    pos = sum(1 for w in POSITIVE_WORDS if w in text)
    neg = sum(1 for w in NEGATIVE_WORDS if w in text)
    total = pos + neg

    if total == 0:
        return {"framing_type": "Neutral", "sentiment_score": 0.0}

    score = (pos - neg) / total
    if score > 0.1:
        framing = "Positive"
    elif score < -0.1:
        framing = "Negative"
    else:
        framing = "Neutral"

    return {"framing_type": framing, "sentiment_score": round(score, 4)}


def analyze_framing(title: str, content: str) -> dict:
    """
    Analyze the tone/framing of an article.
    Returns framing_type and sentiment_score.
    """
    # Use title + first 300 chars of content
    text = f"{title}. {(content or '')[:300]}"

    if HF_API_KEY:
        try:
            response = httpx.post(
                SENTIMENT_URL,
                headers={"Authorization": f"Bearer {HF_API_KEY}"},
                json={"inputs": text[:512]},
                timeout=20.0,
            )
            data = response.json()

            # SST-2 returns [[{label, score}]] — unwrap nested list
            if isinstance(data, list) and data and isinstance(data[0], list):
                items = data[0]
            elif isinstance(data, list) and data and isinstance(data[0], dict):
                items = data
            else:
                return _keyword_framing(title, content)

            scores = {item["label"].upper(): item["score"] for item in items}
            pos = scores.get("POSITIVE", 0.0)
            neg = scores.get("NEGATIVE", 0.0)
            # SST-2 has no neutral — use margin to decide
            sentiment_score = round(pos - neg, 4)
            if sentiment_score > 0.2:
                framing = "Positive"
            elif sentiment_score < -0.2:
                framing = "Negative"
            else:
                framing = "Neutral"

            return {"framing_type": framing, "sentiment_score": sentiment_score}

        except Exception as e:
            logger.warning(f"Framing API call failed: {e}")

    return _keyword_framing(title, content)
