from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from database import get_db
from models import NewsOutlet, Article, AnalysisResult, Story

router = APIRouter()


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """Quick summary stats for the dashboard header."""
    total_articles = db.query(Article).count()
    total_outlets = db.query(NewsOutlet).filter(
        NewsOutlet.article_count > 0
    ).count()

    left = db.query(Article).filter(Article.bias_label.in_(["Left", "Lean Left", "Far Left"])).count()
    center = db.query(Article).filter(Article.bias_label == "Center").count()
    right = db.query(Article).filter(Article.bias_label.in_(["Right", "Lean Right", "Far Right"])).count()

    stories_with_multiple = (
        db.query(Article.story_id)
        .filter(Article.story_id.isnot(None))
        .group_by(Article.story_id)
        .having(func.count(Article.article_id) > 1)
        .count()
    )

    return {
        "total_articles": total_articles,
        "total_outlets": total_outlets,
        "total_stories": stories_with_multiple,
        "bias_distribution": {"Left": left, "Center": center, "Right": right},
    }


@router.get("/bias-overview")
def get_bias_overview(db: Session = Depends(get_db)):
    """
    Per-outlet bias data for the main Bias Spectrum chart.
    Returns outlets sorted Left → Right.
    """
    outlets = db.query(NewsOutlet).all()
    data = []

    for o in outlets:
        total = db.query(Article).filter(Article.outlet_id == o.outlet_id).count()
        if total == 0:
            continue

        avg_bias = (
            db.query(func.avg(AnalysisResult.bias_score))
            .join(Article)
            .filter(Article.outlet_id == o.outlet_id)
            .scalar()
        ) or 0.0

        left = db.query(Article).filter(Article.outlet_id == o.outlet_id, Article.bias_label.in_(["Left", "Lean Left", "Far Left"])).count()
        center = db.query(Article).filter(Article.outlet_id == o.outlet_id, Article.bias_label == "Center").count()
        right = db.query(Article).filter(Article.outlet_id == o.outlet_id, Article.bias_label.in_(["Right", "Lean Right", "Far Right"])).count()

        data.append({
            "outlet": o.name,
            "avg_bias_score": round(float(avg_bias), 4),
            "total_articles": total,
            "left_pct": round(left / total * 100, 1),
            "center_pct": round(center / total * 100, 1),
            "right_pct": round(right / total * 100, 1),
            "left_count": left,
            "center_count": center,
            "right_count": right,
        })

    return sorted(data, key=lambda x: x["avg_bias_score"])


@router.get("/stories")
def get_stories(
    limit: int = Query(default=10, le=50),
    db: Session = Depends(get_db),
):
    """
    Stories where multiple outlets covered the same event.
    This is the core cross-outlet comparison feature.
    """
    # Find story_ids that have articles from at least 2 different outlets
    multi_outlet_stories = (
        db.query(Article.story_id)
        .filter(Article.story_id.isnot(None))
        .group_by(Article.story_id)
        .having(func.count(func.distinct(Article.outlet_id)) >= 2)
        .order_by(func.max(Article.scraped_at).desc())
        .limit(limit)
        .all()
    )

    result = []
    for (story_id,) in multi_outlet_stories:
        articles = (
            db.query(Article)
            .filter(Article.story_id == story_id)
            .order_by(Article.publish_date.desc())
            .all()
        )

        outlets_covering = list({a.outlet.name for a in articles if a.outlet})

        result.append({
            "story_id": story_id,
            "outlets_covering": outlets_covering,
            "outlet_count": len(outlets_covering),
            "article_count": len(articles),
            "articles": [
                {
                    "article_id": a.article_id,
                    "title": a.title,
                    "url": a.url,
                    "outlet": a.outlet.name if a.outlet else None,
                    "bias_label": a.bias_label,
                    "framing_tone": a.framing_tone,
                    "bias_score": round(a.analysis.bias_score, 4) if a.analysis and a.analysis.bias_score is not None else None,
                    "publish_date": a.publish_date.isoformat() if a.publish_date else None,
                }
                for a in articles
            ],
        })

    return result


@router.get("/recent-articles")
def get_recent_articles(limit: int = Query(default=12, le=50), db: Session = Depends(get_db)):
    """Latest analyzed articles for the dashboard feed."""
    articles = (
        db.query(Article)
        .order_by(desc(Article.scraped_at))
        .limit(limit)
        .all()
    )

    return [
        {
            "article_id": a.article_id,
            "title": a.title,
            "url": a.url,
            "outlet": a.outlet.name if a.outlet else None,
            "bias_label": a.bias_label,
            "framing_tone": a.framing_tone,
            "bias_score": round(a.analysis.bias_score, 4) if a.analysis and a.analysis.bias_score is not None else None,
            "publish_date": a.publish_date.isoformat() if a.publish_date else None,
        }
        for a in articles
    ]


@router.get("/topic-trends")
def get_topic_trends(days: int = 7, db: Session = Depends(get_db)):
    """Return per-topic story count over the last N days, sorted by count desc."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(Story.topic_tag, func.count(Story.story_id))
        .filter(Story.created_at >= cutoff, Story.topic_tag.isnot(None))
        .group_by(Story.topic_tag)
        .order_by(func.count(Story.story_id).desc())
        .all()
    )
    return [{"topic": tag or "General", "count": count} for tag, count in rows if count > 0]
