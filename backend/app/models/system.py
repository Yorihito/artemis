from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SourceInfo(BaseModel):
    name: str
    status: str  # "ok" | "error" | "degraded" | "standby"
    last_success_at: Optional[datetime] = None
    consecutive_errors: int = 0
    latency_ms: Optional[float] = None


class CacheInfo(BaseModel):
    status: str
    trajectory_points: int
    oldest_point_at: Optional[datetime] = None
    newest_point_at: Optional[datetime] = None


class SystemStatusResponse(BaseModel):
    sources: List[SourceInfo]
    cache: CacheInfo
    is_approaching: bool = False
    approach_type: Optional[str] = None
    poll_interval_seconds: int
    uptime_seconds: float
