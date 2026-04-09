from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from database import get_db
from models import Article, NewsOutlet, AnalysisResult

router = APIRouter()


def _article_to_dict(a: Article) -> dict:
    return {
        "article_id": a.article_id,
        "title": a.title,
        "url": a.url,
        "publish_date": a.publish_date.isoformat() if a.publish_date else None,
        "scraped_at": a.scraped_at.isoformat() if a.scraped_at else None,
        "bias_label": a.bias_label,
        "framing_tone": a.framing_tone,
        "outlet": a.outlet.name if a.outlet else None,
        "story_id": a.story_id,
        "bias_score": round(a.analysis.bias_score, 4) if a.analysis and a.analysis.bias_score is not None else None,
        "sentiment_score": round(a.analysis.sentiment_score, 4) if a.analysis and a.analysis.sentiment_score is not None else None,
        "confidence": round(a.analysis.confidence_score, 4) if a.analysis and a.analysis.confidence_score is not None else None,
    }


@router.get("/")
def list_articles(
    outlet: Optional[str] = None,
    bias_label: Optional[str] = None,
    framing_tone: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    skip: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """List articles with optional filters."""
    query = db.query(Article).join(NewsOutlet)

    if outlet:
        query = query.filter(NewsOutlet.name == outlet)
    if bias_label:
        query = query.filter(Article.bias_label == bias_label)
    if framing_tone:
        query = query.filter(Article.framing_tone == framing_tone)

    total = query.count()
    articles = query.order_by(desc(Article.scraped_at)).offset(skip).limit(limit).all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "articles": [_article_to_dict(a) for a in articles],
    }


@router.get("/{article_id}")
def get_article(article_id: int, db: Session = Depends(get_db)):
    """Get single article with full analysis."""
    article = db.query(Article).filter(Article.article_id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    result = _article_to_dict(article)
    result["content"] = (article.content or "")[:500] + "..." if article.content else ""
    return result
