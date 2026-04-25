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


# ── Topics where political bias analysis is not meaningful ───────────────────
BIAS_SKIP_TOPICS = {"Sports", "Technology", "Business"}

# Quick keyword lists to detect non-political topics at article level
_SPORTS_KEYWORDS = [
    "cricket", "psl", "match", "t20", "odi", "test match", "pcb", "tournament",
    "stadium", "football", "hockey", "squash", "world cup", "innings", "wicket",
    "batsman", "bowler", "goal", "defeat", "win against", "semifinal", "final",
    "qualifier", "champions", "league", "cup", "batting", "bowling",
]
_TECH_KEYWORDS = [
    "technology", "software", "app ", "ai ", "artificial intelligence", "startup",
    "5g", "cybersecurity", "digital", "smartphone", "gadget", "review", "tech",
    "internet", "telecom", "google", "meta", "apple", "samsung", "huawei",
]
_BUSINESS_KEYWORDS = [
    "company", "corporation", "stock", "shares", "ipo", "startup", "merger",
    "acquisition", "quarterly", "profit", "loss", "ceo", "revenue", "brand",
]

def _detect_non_political_topic(title: str) -> str | None:
    """Quick check if an article title belongs to a non-political topic."""
    title_lower = title.lower()
    sports_hits = sum(1 for kw in _SPORTS_KEYWORDS if kw in title_lower)
    if sports_hits >= 2:
        return "Sports"
    tech_hits = sum(1 for kw in _TECH_KEYWORDS if kw in title_lower)
    if tech_hits >= 2:
        return "Technology"
    biz_hits = sum(1 for kw in _BUSINESS_KEYWORDS if kw in title_lower)
    if biz_hits >= 2:
        return "Business"
    return None


# ── Groq LLM bias scoring ────────────────────────────────────────────────────

_groq_client = None

def _get_groq_client():
    """Lazy-init Groq client using the same API key as the summarizer."""
    global _groq_client
    if _groq_client is not None:
        return _groq_client
    groq_key = os.getenv("GROQ_API_KEY", "")
    if not groq_key:
        return None
    try:
        from groq import Groq
        _groq_client = Groq(api_key=groq_key)
        return _groq_client
    except Exception as e:
        logger.warning(f"Groq client init failed: {e}")
        return None


def _groq_bias_score(title: str, content: str, outlet_name: str) -> float | None:
    """
    Use Groq (Llama 3.3 70B) to analyze political bias of a Pakistani news article.
    
    Returns a float in [-1.0, +1.0] where:
      -1.0 = strongly left/liberal/pro-civilian
      +1.0 = strongly right/pro-establishment/security-state
       0.0 = neutral/balanced
    
    Returns None if Groq is unavailable or rate-limited.
    """
    client = _get_groq_client()
    if not client:
        return None

    snippet = (content or "")[:500].replace("\n", " ").strip()

    prompt = f"""You are an expert Pakistani media analyst. Analyze the political bias of this news article from {outlet_name}.

Title: {title}
Content excerpt: {snippet}

In Pakistan's media landscape:
- LEFT/LIBERAL = pro-civilian government, critical of military establishment, emphasizes accountability, human rights, press freedom, opposition voices, democratic values
- RIGHT/CONSERVATIVE = pro-establishment, pro-military, emphasizes national security, law and order, state sovereignty, patriotic framing, anti-dissent

Rate the political bias of this article on a scale from -1.0 to +1.0:
  -1.0 = strongly left/liberal
  -0.5 = moderately left
   0.0 = neutral/balanced
  +0.5 = moderately right/pro-establishment
  +1.0 = strongly right/pro-establishment

Respond with ONLY a single JSON object, no other text:
{{"score": <number>, "reasoning": "<one sentence>"}}"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=100,
        )
        text = response.choices[0].message.content.strip()

        # Strip markdown code blocks if present
        if "```" in text:
            parts = text.split("```")
            for part in parts:
                stripped = part.strip()
                if stripped.startswith("json"):
                    stripped = stripped[4:].strip()
                if stripped.startswith("{"):
                    text = stripped
                    break

        result = json.loads(text)
        score = float(result.get("score", 0.0))
        score = max(-1.0, min(1.0, score))  # clamp
        reasoning = result.get("reasoning", "")
        logger.info(f"Groq bias: {score:+.2f} for '{title[:50]}' ({reasoning[:60]})")
        return score

    except Exception as e:
        err_str = str(e).lower()
        if "rate_limit" in err_str or "429" in err_str or "quota" in err_str:
            logger.warning("Groq rate limit — skipping LLM bias signal")
        else:
            logger.warning(f"Groq bias analysis failed: {e}")
        return None


def classify_article(title: str, content: str, outlet_name: str) -> dict:
    """
    Main classification function.
    Returns: {bias_score, bias_label, confidence_score, zero_shot_scores}

    Hybrid 4-signal approach:
      Score = 0.40 × Groq_LLM  +  0.25 × HuggingFace_ZS  +  0.20 × keywords  +  0.15 × outlet_prior
    
    Falls back gracefully when Groq or HuggingFace are unavailable.

    Articles detected as Sports, Technology, or Business are assigned
    neutral Center scores because political bias analysis is not meaningful.
    """
    # Skip bias for non-political topics — return neutral immediately
    non_political = _detect_non_political_topic(title)
    if non_political:
        logger.info(f"Skipping bias for {non_political} article: {title[:60]}")
        return {
            "bias_score": 0.0,
            "bias_label": "Center",
            "confidence_score": 1.0,
            "zero_shot_scores": None,
        }

    text = f"{title}. {content or ''}"
    prior = OUTLET_PRIORS.get(outlet_name, 0.0)
    kw_score = _keyword_score(text)
    zs_raw = None
    groq_score = None

    # Signal 1: Groq LLM (best for Pakistani political context)
    groq_score = _groq_bias_score(title, content, outlet_name)

    # Signal 2: HuggingFace zero-shot NLP
    if HF_API_KEY:
        zs_raw = _zero_shot_api(text)

    # ── Compute weighted final score ──────────────────────────────────────
    if groq_score is not None and zs_raw:
        # All 4 signals available: 40% Groq + 25% HF + 20% kw + 15% prior
        zs_score = zs_raw.get("right", 0.33) - zs_raw.get("left", 0.33)
        final_score = (0.40 * groq_score) + (0.25 * zs_score) + (0.20 * kw_score) + (0.15 * prior)
        confidence = 0.90
    elif groq_score is not None:
        # Groq + keywords + prior (no HuggingFace): 55% Groq + 25% kw + 20% prior
        final_score = (0.55 * groq_score) + (0.25 * kw_score) + (0.20 * prior)
        confidence = 0.80
    elif zs_raw:
        # HuggingFace + keywords + prior (no Groq): 50% HF + 30% kw + 20% prior
        zs_score = zs_raw.get("right", 0.33) - zs_raw.get("left", 0.33)
        final_score = (0.50 * zs_score) + (0.30 * kw_score) + (0.20 * prior)
        confidence = max(zs_raw.get("left", 0), zs_raw.get("center", 0), zs_raw.get("right", 0))
    else:
        # Keywords + prior only (no AI): 70% kw + 30% prior
        final_score = (0.70 * kw_score) + (0.30 * prior)
        confidence = 0.55

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


