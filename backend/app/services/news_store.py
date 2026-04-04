"""
Persists crawled news items to a local JSON file.
Thread-safe via asyncio.Lock.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.models.news import NewsItem

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent.parent.parent / "data"
_NEWS_FILE = _DATA_DIR / "news.json"
_MAX_STORED = 200   # keep up to 200 items on disk; API returns top 20

_lock = asyncio.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_raw() -> dict:
    if not _NEWS_FILE.exists():
        return {"last_crawled": None, "items": []}
    try:
        return json.loads(_NEWS_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"Failed to read news file: {e}")
        return {"last_crawled": None, "items": []}


async def save(items: list[NewsItem], last_crawled: datetime) -> None:
    async with _lock:
        raw = _load_raw()
        existing: dict[str, dict] = {i["id"]: i for i in raw.get("items", [])}

        for item in items:
            existing[item.id] = item.model_dump(mode="json")

        # Sort newest first, keep at most _MAX_STORED
        sorted_items = sorted(
            existing.values(),
            key=lambda x: x.get("published", ""),
            reverse=True,
        )[:_MAX_STORED]

        _DATA_DIR.mkdir(parents=True, exist_ok=True)
        _NEWS_FILE.write_text(
            json.dumps(
                {"last_crawled": last_crawled.isoformat(), "items": sorted_items},
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        logger.info(f"News store updated: {len(sorted_items)} items total")


def get_latest(n: int = 20) -> tuple[list[NewsItem], Optional[datetime]]:
    raw = _load_raw()
    last_crawled_str = raw.get("last_crawled")
    last_crawled = (
        datetime.fromisoformat(last_crawled_str) if last_crawled_str else None
    )
    items = []
    for d in raw.get("items", [])[:n]:
        try:
            items.append(NewsItem.model_validate(d))
        except Exception:
            pass
    return items, last_crawled
