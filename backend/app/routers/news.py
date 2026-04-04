from fastapi import APIRouter

from app.models.news import NewsResponse
from app.services import news_store

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("", response_model=NewsResponse)
async def get_news() -> NewsResponse:
    items, last_crawled = news_store.get_latest(20)
    return NewsResponse(items=items, last_crawled=last_crawled)
