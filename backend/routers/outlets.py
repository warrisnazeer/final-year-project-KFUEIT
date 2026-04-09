from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import NewsOutlet, Article, AnalysisResult, Story

router = APIRouter()


@router.get("/")
def list_outlets(db: Session = Depends(get_db)):
    """Return all outlets with bias stats, factuality, 5-level breakdown, and top topics."""
    outlets = db.query(NewsOutlet).all()
    result = []

    for o in outlets:
        total = db.query(Article).filter(Article.outlet_id == o.outlet_id).count()

        avg_bias = (
            db.query(func.avg(AnalysisResult.bias_score))
            .join(Article)
            .filter(Article.outlet_id == o.outlet_id)
            .scalar()
        )

        avg_sentiment = (
            db.query(func.avg(AnalysisResult.sentiment_score))
            .join(Article)
            .filter(Article.outlet_id == o.outlet_id)
            .scalar()
        )

        # 5-level bias breakdown
        far_left   = db.query(Article).filter(Article.outlet_id == o.outlet_id, Article.bias_label == "Far Left").count()
        lean_left  = db.query(Article).filter(Article.outlet_id == o.outlet_id, Article.bias_label == "Lean Left").count()
        center     = db.query(Article).filter(Article.outlet_id == o.outlet_id, Article.bias_label == "Center").count()
        lean_right = db.query(Article).filter(Article.outlet_id == o.outlet_id, Article.bias_label == "Lean Right").count()
        far_right  = db.query(Article).filter(Article.outlet_id == o.outlet_id, Article.bias_label == "Far Right").count()
        left       = far_left + lean_left
        right      = lean_right + far_right

        # Top topics this outlet covers
        topic_rows = (
            db.query(Story.topic_tag, func.count(Article.article_id))
            .join(Article, Article.story_id == Story.story_id)
            .filter(Article.outlet_id == o.outlet_id, Story.topic_tag.isnot(None))
            .group_by(Story.topic_tag)
            .order_by(func.count(Article.article_id).desc())
            .limit(4)
            .all()
        )
        top_topics = [t for t, _ in topic_rows if t]

        result.append({
            "outlet_id": o.outlet_id,
            "name": o.name,
            "website_url": o.website_url,
            "factuality": o.factuality or "Mixed",
            "total_articles": total,
            "avg_bias_score": round(float(avg_bias), 4) if avg_bias is not None else 0.0,
            "avg_sentiment_score": round(float(avg_sentiment), 4) if avg_sentiment is not None else 0.0,
            "bias_distribution": {"Left": left, "Center": center, "Right": right},
            "bias_5level": {
                "Far Left":   far_left,
                "Lean Left":  lean_left,
                "Center":     center,
                "Lean Right": lean_right,
                "Far Right":  far_right,
            },
            "top_topics": top_topics,
        })

    result.sort(key=lambda x: x["avg_bias_score"])
    return result
