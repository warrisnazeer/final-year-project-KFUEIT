"""
Story Summarizer — uses Groq (Llama 3.3 70B) to generate:
  1. A neutral factual story title
  2. A neutral summary (what actually happened)
  3. Left-leaning framing (how left outlets report it)
  4. Right-leaning framing (how right outlets report it)

Free tier: 14,400 requests/day at console.groq.com
"""

import os
import json
import logging

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not GROQ_API_KEY:
        return None
    try:
        from groq import Groq
        _client = Groq(api_key=GROQ_API_KEY)
        return _client
    except Exception as e:
        logger.warning(f"Groq init failed: {e}")
        return None


def generate_story_summary(story_articles: list) -> dict:
    """
    Generate a Groq-powered story summary.

    story_articles: list of dicts — {outlet, title, bias_label, bias_score, url, content}

    Returns: {story_title, what_happened, neutral_summary, key_actors,
               why_it_matters, left_framing, right_framing, generated_by}
    """
    if not story_articles:
        return _fallback_summary(story_articles)

    client = _get_client()
    if not client:
        return _fallback_summary(story_articles)

    article_lines = []
    for a in story_articles:
        outlet = a.get("outlet", "Unknown")
        title = a.get("title", "")
        bias = a.get("bias_label", "Center")
        snippet = (a.get("content") or "").strip()
        snippet = snippet[:200].replace("\n", " ").strip()
        snippet_part = f' — "{snippet}..."' if len(snippet) > 30 else ""
        article_lines.append(f'- {outlet} [{bias}]: "{title}"{snippet_part}')

    articles_text = "\n".join(article_lines)

    prompt = f"""You are a neutral media analyst studying how Pakistani news outlets cover the same story with different political angles.

The following are headlines (and article snippets where available) from different Pakistani news outlets, all covering the SAME news event:

{articles_text}

Analyze these carefully and respond with ONLY a valid JSON object (no markdown, no backticks, no extra text) containing exactly these 7 keys:

{{
  "story_title": "A clear, neutral headline for this story (8-14 words, factual, no spin)",
  "what_happened": "Write 3-4 sentences giving a clear overview of the core event: what happened, who was involved, when/where, and the immediate outcome. Be factual and neutral.",
  "neutral_summary": "Write 6-8 key facts about this story, each fact separated by the | character. Each fact should be a complete, informative sentence covering different aspects: background, what happened, who is involved, reactions, implications, and significance. Do not repeat facts.",
  "key_actors": "List the main people, parties, organizations, or institutions involved in this story, separated by |. Examples: PTI | Imran Khan | Supreme Court of Pakistan | PMLN",
  "why_it_matters": "Write 2-3 sentences explaining why this story is significant for Pakistan — its political, economic, or social implications for ordinary Pakistanis.",
  "left_framing": "Write 3-4 sentences describing in detail how left-leaning, liberal, or opposition-sympathetic Pakistani outlets framed this story. Include: their tone, which aspects they emphasized, what language or framing they used, and what narrative they pushed.",
  "right_framing": "Write 3-4 sentences describing in detail how right-leaning, pro-establishment, or conservative Pakistani outlets framed this story. Include: their tone, which aspects they emphasized, what language or framing they used, and what narrative they pushed."
}}

If outlets all seem to frame it similarly (rare), note that honestly in the framing fields. Focus on Pakistani political context, parties (PTI, PMLN, PPP, MQM), military-civilian relations, and economic issues."""

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=1024,
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
        return {
            "story_title":     str(result.get("story_title", "")).strip(),
            "what_happened":   str(result.get("what_happened", "")).strip(),
            "neutral_summary": str(result.get("neutral_summary", "")).strip(),
            "key_actors":      str(result.get("key_actors", "")).strip(),
            "why_it_matters":  str(result.get("why_it_matters", "")).strip(),
            "left_framing":    str(result.get("left_framing", "")).strip(),
            "right_framing":   str(result.get("right_framing", "")).strip(),
            "generated_by":    "model",
        }

    except Exception as e:
        err_str = str(e)
        if "rate_limit" in err_str.lower() or "429" in err_str or "quota" in err_str.lower():
            logger.warning("Groq rate limit hit — returning None")
            return None
        logger.warning(f"Groq summary failed: {e}")
        return _fallback_summary(story_articles)


def _fallback_summary(story_articles: list) -> dict:
    """Simple fallback when Gemini is unavailable."""
    if not story_articles:
        return {
            "story_title":     "News Story",
            "what_happened":   "",
            "neutral_summary": "Multiple Pakistani outlets covered this story.",
            "key_actors":      "",
            "why_it_matters":  "",
            "left_framing":    "",
            "right_framing":   "",
            "generated_by":    "fallback",
        }

    first_title = story_articles[0].get("title", "News Story")
    outlets = list({a.get("outlet", "") for a in story_articles if a.get("outlet")})
    outlet_str = ", ".join(outlets[:3])
    if len(outlets) > 3:
        outlet_str += f" and {len(outlets) - 3} more"

    left_articles = [a for a in story_articles if a.get("bias_label") in ("Left", "Lean Left", "Far Left")]
    right_articles = [a for a in story_articles if a.get("bias_label") in ("Right", "Lean Right", "Far Right")]

    return {
        "story_title":     first_title[:120],
        "what_happened":   "",
        "neutral_summary": f"This story was covered by {outlet_str}. Multiple Pakistani news outlets reported on this event from different angles.",
        "key_actors":      "",
        "why_it_matters":  "",
        "left_framing":    left_articles[0]["title"] if left_articles else "Left-leaning coverage not available for this story.",
        "right_framing":   right_articles[0]["title"] if right_articles else "Right-leaning coverage not available for this story.",
        "generated_by":    "fallback",
    }
