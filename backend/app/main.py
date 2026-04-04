import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import mission, system, dsn, news
from app.background.poller import polling_loop
from app.services import news_crawler, news_store

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
# Suppress verbose Azure SDK HTTP logging
logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(logging.WARNING)
logging.getLogger("azure.data.tables").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


NEWS_CRAWL_INTERVAL_SECONDS = 3600  # 1 hour


async def news_crawl_loop() -> None:
    """Crawl news feeds once on startup, then every hour."""
    logger.info("News crawl loop started")
    while True:
        try:
            items = await news_crawler.crawl()
            await news_store.save(items, datetime.now(timezone.utc))
        except Exception as e:
            logger.error(f"News crawl failed: {e}")
        await asyncio.sleep(NEWS_CRAWL_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting Artemis II API (mock={settings.USE_MOCK})")
    task        = asyncio.create_task(polling_loop())
    news_task   = asyncio.create_task(news_crawl_loop())
    yield
    for t in (task, news_task):
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass
    logger.info("Background tasks stopped")


app = FastAPI(
    title="Artemis II Mission API",
    description="Real-time tracking API for the Artemis II mission",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(mission.router)
app.include_router(system.router)
app.include_router(dsn.router)
app.include_router(news.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
