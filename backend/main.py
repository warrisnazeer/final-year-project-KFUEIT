import os
import json
import logging
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

load_dotenv()

from database import engine, Base, SessionLocal
from models import NewsOutlet, Article, AnalysisResult, Story, StorySummary, User
from scrapers.rss_scraper import scrape_all_outlets, OUTLETS
from services.bias_classifier import classify_article
from services.framing_analyzer import analyze_framing
from services.story_grouper import group_articles
from services.topic_tagger import tag_story_topic, compute_blindspot
from routers import articles, outlets, dashboard
from routers import stories
from routers import auth as auth_router
from routers import user as user_router
from services.story_summarizer import generate_story_summary

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Create all DB tables ─────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)


def migrate_db():
    """Add new columns to existing tables without losing data (SQLite ALTER TABLE)."""
    import sqlite3
    db_path = os.path.join(os.path.dirname(__file__), "news_narrative.db")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    migrations = [
        ("news_outlets",   "factuality",      "TEXT DEFAULT 'Mixed'"),
        ("stories",        "topic_tag",       "TEXT DEFAULT 'General'"),
        ("stories",        "blindspot_side",  "TEXT"),
        ("stories",        "story_title",     "TEXT"),
        ("stories",        "has_summary",     "INTEGER DEFAULT 0"),
        ("stories",        "summary_json",    "TEXT"),
        ("articles",       "image_url",       "TEXT"),
        ("story_summaries","what_happened",   "TEXT"),
        ("story_summaries","key_actors",      "TEXT"),
        ("story_summaries","why_it_matters",  "TEXT"),
    ]

    for table, column, col_def in migrations:
        try:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}")
            logger.info(f"Migration: added {table}.{column}")
        except sqlite3.OperationalError:
            pass  # column already exists

    conn.commit()
    conn.close()


migrate_db()

# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="News Narrative API",
    description="AI-powered Pakistani news bias detection and analysis",
    version="1.0.0",
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(articles.router, prefix="/api/articles", tags=["Articles"])
app.include_router(outlets.router, prefix="/api/outlets", tags=["Outlets"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(stories.router, prefix="/api/stories", tags=["Stories"])
app.include_router(auth_router.router, prefix="/api/auth", tags=["Auth"])
app.include_router(user_router.router, prefix="/api/user", tags=["User"])


# ── Outlet seeding ──────────────────────────────────────────────────────────
OUTLET_FACTUALITY = {
    "Dawn":                   "High",
    "Express Tribune":        "High",
    "The News International": "High",
    "Business Recorder":      "High",
    "Daily Times":            "High",
    "The Friday Times":       "High",
    "Geo News":               "Mixed",
    "Samaa News":             "Mixed",
    "Dunya News":             "Mixed",
    "ARY News":               "Mixed",
    "BOL News":               "Mixed",
    "Hum News":               "Mixed",
    "92 News HD":             "Mixed",
    "Aaj News":               "Mixed",
    "Pakistan Today":         "Mixed",
    "The Nation":             "Mixed",
    "Pakistan Observer":      "Mixed",
    "Naya Daur":              "Mixed",
}

def seed_outlets():
    """Insert outlet records if they don't exist yet, update factuality if missing."""
    db = SessionLocal()
    try:
        for o in OUTLETS:
            existing = db.query(NewsOutlet).filter(NewsOutlet.name == o["name"]).first()
            if not existing:
                db.add(NewsOutlet(
                    name=o["name"],
                    rss_url=o["rss_url"],
                    website_url=o["website_url"],
                    factuality=OUTLET_FACTUALITY.get(o["name"], "Mixed"),
                ))
            else:
                # Backfill factuality if not set
                if not existing.factuality or existing.factuality == "Mixed":
                    existing.factuality = OUTLET_FACTUALITY.get(o["name"], "Mixed")
        db.commit()
        logger.info("Outlets seeded.")
    finally:
        db.close()


def seed_user():
    """Create the default user account if it doesn't exist."""
    from passlib.hash import bcrypt
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == "amjad").first()
        if not existing:
            db.add(User(
                username="amjad",
                email="amjad@newsnarrative.com",
                password_hash=bcrypt.hash("newsnarrative2026"),
            ))
            db.commit()
            logger.info("Default user 'amjad' created.")
        else:
            logger.info("User 'amjad' already exists.")
    finally:
        db.close()


# ── Core pipeline ────────────────────────────────────────────────────────────
def _group_recent_stories(db):
    """Group recently scraped articles that don't have a story yet."""
    cutoff = datetime.utcnow() - timedelta(hours=48)
    recent = db.query(Article).filter(
        Article.scraped_at >= cutoff,
        Article.story_id.is_(None),
    ).all()

    if len(recent) < 2:
        return

    article_dicts = [
        {
            "article_id": a.article_id,
            "title": a.title,
            "content": a.content or "",
            "publish_date": a.publish_date,
        }
        for a in recent
    ]

    grouping = group_articles(article_dicts)   # {article_id: group_id}

    group_to_story_id = {}
    for article_id, group_id in grouping.items():
        if group_id not in group_to_story_id:
            story = Story(
                description=f"Story cluster {group_id}",
                created_at=datetime.utcnow(),
            )
            db.add(story)
            db.flush()
            group_to_story_id[group_id] = story.story_id

        article = db.query(Article).filter(Article.article_id == article_id).first()
        if article:
            article.story_id = group_to_story_id[group_id]

    db.commit()

    # Tag topic + compute blindspot for each story
    for story_id in group_to_story_id.values():
        story_obj = db.query(Story).filter(Story.story_id == story_id).first()
        if not story_obj:
            continue
        story_articles = db.query(Article).filter(Article.story_id == story_id).all()
        titles = [a.title for a in story_articles]
        labels = [a.bias_label or "Center" for a in story_articles]
        story_obj.topic_tag = tag_story_topic(titles)
        story_obj.blindspot_side = compute_blindspot(labels)

    db.commit()

    # Auto-summarize: only runs if AUTO_SUMMARIZE=true in environment
    # Set AUTO_SUMMARIZE=true in Railway Variables when presenting/demoing
    # Leave unset (or false) to conserve Groq tokens
    if os.getenv("AUTO_SUMMARIZE", "false").lower() == "true":
        auto_done = 0
        for sid in set(group_to_story_id.values()):
            story_obj = db.query(Story).filter(Story.story_id == sid).first()
            if not story_obj or story_obj.has_summary:
                continue
            story_articles_data = [
                {
                    "outlet":      a.outlet.name if a.outlet else "Unknown",
                    "title":       a.title,
                    "bias_label":  a.bias_label or "Center",
                    "bias_score":  0.0,
                    "url":         a.url,
                    "content":     a.content or "",
                }
                for a in db.query(Article).filter(Article.story_id == sid).all()
            ]
            result = generate_story_summary(story_articles_data)
            if result and result.get("what_happened"):
                story_obj.story_title    = result["story_title"]    or story_obj.story_title
                story_obj.summary_json   = json.dumps(result)
                story_obj.has_summary    = True
                auto_done += 1
                if auto_done >= 10:
                    break
        if auto_done:
            db.commit()
            logger.info(f"Auto-summarized {auto_done} new stories via Groq.")
    else:
        logger.info("Auto-summarize disabled (set AUTO_SUMMARIZE=true to enable).")

    logger.info(f"Grouped {len(recent)} articles into {len(group_to_story_id)} stories.")


def run_pipeline():
    """Scrape → Analyze → Group. Runs on startup and every hour."""
    logger.info("━━━ Pipeline started ━━━")
    db = SessionLocal()

    try:
        raw_articles = scrape_all_outlets(fetch_full=True)
        new_count = 0

        for art in raw_articles:
            # Skip duplicates
            if db.query(Article).filter(Article.url == art["url"]).first():
                continue

            outlet = db.query(NewsOutlet).filter(NewsOutlet.name == art["outlet_name"]).first()
            if not outlet:
                continue

            # Classify bias
            bias = classify_article(art["title"], art["content"], art["outlet_name"])
            # Analyze framing/tone
            framing = analyze_framing(art["title"], art["content"])

            article = Article(
                title=art["title"],
                content=art["content"],
                url=art["url"],
                image_url=art.get("image_url"),
                publish_date=art.get("publish_date") or datetime.utcnow(),
                bias_label=bias["bias_label"],
                framing_tone=framing["framing_type"],
                outlet_id=outlet.outlet_id,
            )
            db.add(article)
            db.flush()

            result = AnalysisResult(
                bias_score=bias["bias_score"],
                sentiment_score=framing["sentiment_score"],
                framing_type=framing["framing_type"],
                confidence_score=bias["confidence_score"],
                zero_shot_scores=bias["zero_shot_scores"],
                article_id=article.article_id,
            )
            db.add(result)

            # Update outlet article count
            outlet.article_count = (outlet.article_count or 0) + 1

            new_count += 1

        db.commit()
        logger.info(f"Pipeline: {new_count} new articles added.")

        # Group articles into stories
        _group_recent_stories(db)

    except Exception as e:
        logger.error(f"Pipeline error: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()

    logger.info("━━━ Pipeline complete ━━━")


# ── Scheduler ────────────────────────────────────────────────────────────────
scheduler = BackgroundScheduler(daemon=True)


@app.on_event("startup")
def startup():
    import threading
    seed_outlets()
    seed_user()
    # Run the initial pipeline in a background thread so it doesn't block server startup
    t = threading.Thread(target=run_pipeline, daemon=True)
    t.start()
    scheduler.add_job(run_pipeline, "interval", hours=1, id="pipeline")
    scheduler.start()
    logger.info("Scheduler started — pipeline will run every hour.")


@app.on_event("shutdown")
def shutdown():
    scheduler.shutdown(wait=False)


# ── Utility endpoints ────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {"status": "running", "name": "News Narrative API", "version": "1.0.0"}


@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/scrape", tags=["Admin"])
def trigger_scrape():
    """Manually trigger the scrape + analysis pipeline."""
    import threading
    t = threading.Thread(target=run_pipeline, daemon=True)
    t.start()
    return {"message": "Pipeline triggered in background."}


def _reanalyze_all():
    """Re-run AI analysis on every article in DB (overwrites existing scores)."""
    logger.info("Re-analysis started...")
    db = SessionLocal()
    try:
        articles = db.query(Article).all()
        updated = 0
        for article in articles:
            bias = classify_article(article.title, article.content or "", article.outlet.name if article.outlet else "")
            framing = analyze_framing(article.title, article.content or "")

            article.bias_label = bias["bias_label"]
            article.framing_tone = framing["framing_type"]

            result = article.analysis
            if result:
                result.bias_score = bias["bias_score"]
                result.sentiment_score = framing["sentiment_score"]
                result.framing_type = framing["framing_type"]
                result.confidence_score = bias["confidence_score"]
                result.zero_shot_scores = bias["zero_shot_scores"]
            else:
                db.add(AnalysisResult(
                    bias_score=bias["bias_score"],
                    sentiment_score=framing["sentiment_score"],
                    framing_type=framing["framing_type"],
                    confidence_score=bias["confidence_score"],
                    zero_shot_scores=bias["zero_shot_scores"],
                    article_id=article.article_id,
                ))
            updated += 1

        db.commit()
        logger.info(f"Re-analysis complete: {updated} articles updated.")
    except Exception as e:
        logger.error(f"Re-analysis error: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


@app.post("/api/reanalyze", tags=["Admin"])
def trigger_reanalyze():
    """Re-run AI analysis on ALL existing articles with the current model."""
    import threading
    t = threading.Thread(target=_reanalyze_all, daemon=True)
    t.start()
    return {"message": "Re-analysis started in background. Check /api/health for completion."}
