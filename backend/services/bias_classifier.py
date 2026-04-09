"""
Bias Classifier — Hybrid approach:

  Score = 0.6 × zero_shot_NLP  +  0.3 × keyword_score  +  0.1 × outlet_prior

When no HuggingFace API key is present, falls back to:
  Score = 0.7 × keyword_score  +  0.3 × outlet_prior

The score is in range [-1.0, +1.0]:
  < -0.15  = Left
  -0.15 to 0.15 = Center
  > 0.15   = Right
"""

import httpx
import json
import os
import logging
import time

logger = logging.getLogger(__name__)

_raw_key = os.getenv("HUGGINGFACE_API_KEY", "")
# Only treat as valid if it looks like a real key (not the placeholder)
HF_API_KEY = _raw_key if (_raw_key.startswith("hf_") and len(_raw_key) > 15) else ""
ZS_API_URL = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"

# ── Outlet priors based on known Pakistani media landscape ──────────────────
# Sources: journalism studies, RSF index, local media analysis
# Scale: -1.0 (Far Left/Liberal) to +1.0 (Far Right/Pro-establishment)
OUTLET_PRIORS = {
    "Dawn": -0.25,               # Liberal, often critical of establishment
    "Express Tribune": -0.20,    # Liberal, international perspective
    "The News International": 0.00,  # Centrist
    "Naya Daur": -0.35,          # Progressive/left-liberal
    "The Friday Times": -0.30,   # Liberal/progressive weekly
    "Daily Times": -0.15,        # Centre-left, pro-democracy
    "Business Recorder": 0.00,   # Business-focused, centrist
    "Pakistan Today": -0.10,     # Slightly left-centre
    "The Nation": 0.15,          # Slightly right/conservative
    "Pakistan Observer": 0.20,   # Pro-establishment conservative
    "Geo News": 0.05,            # Mild pro-mainstream
    "Samaa News": 0.10,          # Slightly conservative
    "Aaj News": 0.10,            # Mainstream/slightly conservative
    "Hum News": 0.15,            # Mainstream, slightly pro-establishment
    "92 News HD": 0.25,          # Pro-establishment, conservative
    "BOL News": 0.30,            # Pro-PTI, right-leaning
    "Dunya News": 0.25,          # Pro-establishment leaning
    "ARY News": 0.30,            # Right-leaning, pro-establishment
}

# ── Pakistani political context keywords ────────────────────────────────────
LEFT_SIGNALS = [
    "civilian supremacy", "accountability", "transparency", "civil liberties",
    "human rights", "minority rights", "press freedom", "free speech",
    "democratic", "opposition", "dissent", "protest", "crackdown",
    "arrested", "detained", "censorship", "marginalized", "oppressed",
    "workers rights", "poverty", "inequality", "judicial independence",
]

RIGHT_SIGNALS = [
    "national security", "state sovereignty", "stability", "law and order",
    "national interest", "foreign conspiracy", "anti-state", "enemy of state",
    "security forces", "military operation", "counterterrorism",
    "foreign interference", "hybrid war", "discipline", "strategic depth",
    "fifth generation", "propaganda campaign",
]


def _keyword_score(text: str) -> float:
    """Returns -1.0 to +1.0 based on Left/Right keyword presence."""
    text_lower = text.lower()
    left_hits = sum(1 for kw in LEFT_SIGNALS if kw in text_lower)
    right_hits = sum(1 for kw in RIGHT_SIGNALS if kw in text_lower)
    total = left_hits + right_hits
    if total == 0:
        return 0.0
    return (right_hits - left_hits) / total


def _zero_shot_api(text: str) -> dict:
    """
    Calls HuggingFace Inference API for zero-shot classification.
    Returns {"left": float, "center": float, "right": float}
    """
    try:
        response = httpx.post(
            ZS_API_URL,
            headers={"Authorization": f"Bearer {HF_API_KEY}"},
            json={
                "inputs": text[:1500],
                "parameters": {
                    "candidate_labels": [
                        "left wing liberal political bias",
                        "right wing conservative political bias",
                        "neutral centrist balanced reporting",
                    ],
                    "multi_label": False,
                },
            },
            timeout=30.0,
        )

        if response.status_code == 503:
            # Model is loading — wait and retry once
            time.sleep(10)
            response = httpx.post(
                ZS_API_URL,
                headers={"Authorization": f"Bearer {HF_API_KEY}"},
                json={
                    "inputs": text[:1500],
                    "parameters": {
                        "candidate_labels": [
                            "left wing liberal political bias",
                            "right wing conservative political bias",
                            "neutral centrist balanced reporting",
                        ]
                    },
                },
                timeout=30.0,
            )

        data = response.json()

        if "labels" not in data or "scores" not in data:
            return None

        result = {}
        for label, score in zip(data["labels"], data["scores"]):
            if "left" in label:
                result["left"] = score
            elif "right" in label:
                result["right"] = score
            else:
                result["center"] = score

        return result

    except Exception as e:
        logger.warning(f"HuggingFace API call failed: {e}")
        return None


def classify_article(title: str, content: str, outlet_name: str) -> dict:
    """
    Main classification function.
    Returns: {bias_score, bias_label, confidence_score, zero_shot_scores}
    """
    text = f"{title}. {content or ''}"
    prior = OUTLET_PRIORS.get(outlet_name, 0.0)
    kw_score = _keyword_score(text)
    zs_raw = None

    if HF_API_KEY:
        zs_raw = _zero_shot_api(text)

    if zs_raw:
        # Full hybrid: 60% NLP + 30% keywords + 10% prior
        zs_score = zs_raw.get("right", 0.33) - zs_raw.get("left", 0.33)
        final_score = (0.60 * zs_score) + (0.30 * kw_score) + (0.10 * prior)
        confidence = max(zs_raw.get("left", 0), zs_raw.get("center", 0), zs_raw.get("right", 0))
    else:
        # Keyword-only fallback: 70% keywords + 30% prior
        final_score = (0.70 * kw_score) + (0.30 * prior)
        confidence = 0.55  # lower confidence without AI model

    # Clamp to [-1, 1]
    final_score = max(-1.0, min(1.0, final_score))

    # 5-level label thresholds
    if final_score < -0.45:
        label = "Far Left"
    elif final_score < -0.15:
        label = "Lean Left"
    elif final_score > 0.45:
        label = "Far Right"
    elif final_score > 0.15:
        label = "Lean Right"
    else:
        label = "Center"

    return {
        "bias_score": round(final_score, 4),
        "bias_label": label,
        "confidence_score": round(confidence, 4),
        "zero_shot_scores": json.dumps(zs_raw) if zs_raw else None,
    }
