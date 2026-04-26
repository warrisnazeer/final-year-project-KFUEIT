"""
User Router — personal tracking features (reading history, bookmarks, bias diet).

POST /api/user/read/{story_id}       — mark story as read
GET  /api/user/reading-history       — list read stories
POST /api/user/bookmarks/{story_id}  — toggle bookmark
GET  /api/user/bookmarks             — list bookmarked stories
GET  /api/user/diversity             — personal bias diet stats
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import User, ReadingHistory, Bookmark, Story, Article, StorySummary
from routers.auth import require_user, get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

LEFT_LABELS = {"Far Left", "Lean Left"}
RIGHT_LABELS = {"Far Right", "Lean Right"}


# ── Reading History ─────────────────────────────────────────────────────────

@router.post("/read/{story_id}")
def mark_read(story_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    """Mark a story as read. Records bias snapshot for diversity tracking."""
    story = db.query(Story).filter(Story.story_id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    # Don't duplicate if already read
    existing = db.query(ReadingHistory).filter(
        ReadingHistory.user_id == user.user_id,
        ReadingHistory.story_id == story_id,
    ).first()
    if existing:
        return {"status": "already_read", "story_id": story_id}

    # Count bias distribution for this story
    articles = db.query(Article).filter(Article.story_id == story_id).all()
    left_count = sum(1 for a in articles if a.bias_label in LEFT_LABELS)
    right_count = sum(1 for a in articles if a.bias_label in RIGHT_LABELS)
    center_count = len(articles) - left_count - right_count

    entry = ReadingHistory(
        user_id=user.user_id,
        story_id=story_id,
        left_count=left_count,
        center_count=center_count,
        right_count=right_count,
    )
    db.add(entry)
    db.commit()

    return {"status": "recorded", "story_id": story_id}


@router.get("/reading-history")
def get_reading_history(
    limit: int = 20,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Return the user's reading history with story details."""
    entries = (
        db.query(ReadingHistory)
        .filter(ReadingHistory.user_id == user.user_id)
        .order_by(ReadingHistory.read_at.desc())
        .limit(limit)
        .all()
    )

    result = []
    for e in entries:
        story = db.query(Story).filter(Story.story_id == e.story_id).first()
        if not story:
            continue

        # Get story title from summary or first article
        story_title = story.story_title
        if not story_title:
            first_article = db.query(Article).filter(Article.story_id == e.story_id).first()
            story_title = first_article.title if first_article else "Untitled"

        outlet_count = (
            db.query(func.count(func.distinct(Article.outlet_id)))
            .filter(Article.story_id == e.story_id)
            .scalar()
        ) or 0

        result.append({
            "story_id": e.story_id,
            "story_title": story_title,
            "topic_tag": story.topic_tag or "General",
            "read_at": e.read_at.isoformat() if e.read_at else None,
            "left_count": e.left_count,
            "center_count": e.center_count,
            "right_count": e.right_count,
            "outlet_count": outlet_count,
        })

    return result


# ── Bookmarks ───────────────────────────────────────────────────────────────

@router.post("/bookmarks/{story_id}")
def toggle_bookmark(story_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    """Toggle bookmark on a story. Returns new bookmark state."""
    story = db.query(Story).filter(Story.story_id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    existing = db.query(Bookmark).filter(
        Bookmark.user_id == user.user_id,
        Bookmark.story_id == story_id,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        return {"bookmarked": False, "story_id": story_id}
    else:
        db.add(Bookmark(user_id=user.user_id, story_id=story_id))
        db.commit()
        return {"bookmarked": True, "story_id": story_id}


@router.get("/bookmarks")
def get_bookmarks(user: User = Depends(require_user), db: Session = Depends(get_db)):
    """Return all bookmarked stories."""
    bookmarks = (
        db.query(Bookmark)
        .filter(Bookmark.user_id == user.user_id)
        .order_by(Bookmark.created_at.desc())
        .all()
    )

    result = []
    for b in bookmarks:
        story = db.query(Story).filter(Story.story_id == b.story_id).first()
        if not story:
            continue

        story_title = story.story_title
        if not story_title:
            first_article = db.query(Article).filter(Article.story_id == b.story_id).first()
            story_title = first_article.title if first_article else "Untitled"

        outlet_count = (
            db.query(func.count(func.distinct(Article.outlet_id)))
            .filter(Article.story_id == b.story_id)
            .scalar()
        ) or 0

        result.append({
            "story_id": b.story_id,
            "story_title": story_title,
            "topic_tag": story.topic_tag or "General",
            "bookmarked_at": b.created_at.isoformat() if b.created_at else None,
            "outlet_count": outlet_count,
        })

    return result


@router.get("/bookmarks/ids")
def get_bookmark_ids(user: User = Depends(require_user), db: Session = Depends(get_db)):
    """Return just the story IDs that are bookmarked (for quick UI checks)."""
    ids = (
        db.query(Bookmark.story_id)
        .filter(Bookmark.user_id == user.user_id)
        .all()
    )
    return [row[0] for row in ids]


# ── Diversity / Bias Diet ───────────────────────────────────────────────────

@router.get("/diversity")
def get_diversity(user: User = Depends(require_user), db: Session = Depends(get_db)):
    """
    Compute the user's reading bias diet from their reading history.
    Returns L/C/R percentages and total stories read.
    """
    entries = db.query(ReadingHistory).filter(ReadingHistory.user_id == user.user_id).all()

    if not entries:
        return {"total_read": 0, "left": 0, "center": 0, "right": 0, "left_pct": 0, "center_pct": 0, "right_pct": 0}

    total_l = sum(e.left_count for e in entries)
    total_c = sum(e.center_count for e in entries)
    total_r = sum(e.right_count for e in entries)
    total_articles = total_l + total_c + total_r or 1

    return {
        "total_read": len(entries),
        "left": total_l,
        "center": total_c,
        "right": total_r,
        "left_pct": round(total_l / total_articles * 100),
        "center_pct": round(total_c / total_articles * 100),
        "right_pct": round(total_r / total_articles * 100),
    }

@router.get("/summary-history")
def get_summary_history(limit: int = 20, db: Session = Depends(get_db)):
    """Return stories that have been AI Summarized or Deep Bias Analyzed."""
    # We query StorySummary directly and join Story
    summaries = (
        db.query(StorySummary, Story)
        .join(Story, StorySummary.story_id == Story.story_id)
        .order_by(StorySummary.story_summary_id.desc())
        .limit(limit)
        .all()
    )

    result = []
    for summary, story in summaries:
        outlet_count = (
            db.query(func.count(func.distinct(Article.outlet_id)))
            .filter(Article.story_id == story.story_id)
            .scalar()
        ) or 0

        result.append({
            "story_id": story.story_id,
            "story_title": summary.story_title or "Untitled",
            "topic_tag": story.topic_tag or "General",
            "analyzed_at": story.created_at.isoformat() if story.created_at else None, # approximate
            "outlet_count": outlet_count,
            "generated_by": summary.generated_by
        })

    return result
