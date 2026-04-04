from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NewsItem(BaseModel):
    id: str          # SHA-256 (first 16 hex chars) of the URL
    title: str
    url: str
    published: datetime
    source: str      # "NASA", "SpaceflightNow", "SpaceNews", etc.
    is_nasa: bool


class NewsResponse(BaseModel):
    items: list[NewsItem]
    last_crawled: Optional[datetime] = None
