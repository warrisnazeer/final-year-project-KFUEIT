from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class NewsOutlet(Base):
    __tablename__ = "news_outlets"

    outlet_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    rss_url = Column(String(500), nullable=False)
    website_url = Column(String(255))
    # -1.0 = Far Left, 0.0 = Centre, +1.0 = Far Right
    political_leaning_score = Column(Float, default=0.0)
    article_count = Column(Integer, default=0)
    # Journalistic quality: "High" | "Mixed" | "Low"
    factuality = Column(String(20), default="Mixed")

    articles = relationship("Article", back_populates="outlet")


class Story(Base):
    """A Story groups multiple articles from different outlets covering the same event."""
    __tablename__ = "stories"

    story_id = Column(Integer, primary_key=True, index=True)
    description = Column(Text)
    story_title = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Topic classification: Politics, Economy, Security, International, Sports, Business, Ceasefire
    topic_tag = Column(String(50), default="General")
    # Blindspot: which audience is missing this story ("Left" | "Right" | None)
    blindspot_side = Column(String(20), nullable=True)
    # Auto-summarize tracking
    has_summary = Column(Integer, default=0)  # 0/1 flag for SQLite compat
    summary_json = Column(Text, nullable=True)

    articles = relationship("Article", back_populates="story")


class Article(Base):
    __tablename__ = "articles"

    article_id = Column(Integer, primary_key=True, index=True)
    title = Column(String(1000), nullable=False)
    content = Column(Text)
    url = Column(String(1000), unique=True, nullable=False)
    image_url = Column(String(1000), nullable=True)
    publish_date = Column(DateTime)
    scraped_at = Column(DateTime, default=datetime.utcnow)

    # Analysis output
    bias_label = Column(String(20))    # "Far Left" | "Lean Left" | "Center" | "Lean Right" | "Far Right"
    framing_tone = Column(String(20))  # "Positive" | "Neutral" | "Negative"

    outlet_id = Column(Integer, ForeignKey("news_outlets.outlet_id"))
    story_id = Column(Integer, ForeignKey("stories.story_id"), nullable=True)

    outlet = relationship("NewsOutlet", back_populates="articles")
    story = relationship("Story", back_populates="articles")
    analysis = relationship("AnalysisResult", back_populates="article", uselist=False)


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    result_id = Column(Integer, primary_key=True, index=True)
    bias_score = Column(Float)         # -1.0 (Left) to +1.0 (Right)
    sentiment_score = Column(Float)    # -1.0 (Negative) to +1.0 (Positive)
    framing_type = Column(String(20))  # Positive / Neutral / Negative
    confidence_score = Column(Float)   # 0.0 to 1.0
    zero_shot_scores = Column(Text)    # JSON string of raw HF API scores
    created_at = Column(DateTime, default=datetime.utcnow)

    article_id = Column(Integer, ForeignKey("articles.article_id"), unique=True)
    article = relationship("Article", back_populates="analysis")


class StorySummary(Base):
    """Gemini-generated summary for a story cluster."""
    __tablename__ = "story_summaries"

    summary_id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("stories.story_id"), unique=True)
    story_title = Column(String(500))
    what_happened = Column(Text)       # 2-3 sentence core event overview
    neutral_summary = Column(Text)     # 6-8 pipe-separated bullet facts
    key_actors = Column(Text)          # pipe-separated actor/party names
    why_it_matters = Column(Text)      # 1-2 sentences on significance
    left_framing = Column(Text)
    right_framing = Column(Text)
    generated_by = Column(String(50), default="gemini")
    created_at = Column(DateTime, default=datetime.utcnow)

    story = relationship("Story", backref="summary")
