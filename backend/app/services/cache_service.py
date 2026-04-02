from collections import deque
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import asyncio
import time

from app.models.mission import MissionCurrentResponse, TrajectoryPoint
from app.models.system import SourceInfo, CacheInfo
from app.config import settings


class CacheService:
    def __init__(self):
        self.current_data: Optional[MissionCurrentResponse] = None
        self.trajectory_points: deque[TrajectoryPoint] = deque(
            maxlen=settings.TRAJECTORY_MAX_POINTS
        )
        self.source_status: dict[str, SourceInfo] = {
            "Horizons": SourceInfo(name="Horizons", status="standby"),
        }
        self.consecutive_errors: int = 0
        self.is_approaching: bool = False
        self.approach_type: Optional[str] = None
        self._lock = asyncio.Lock()
        self._start_time = time.time()

    async def update(self, data: MissionCurrentResponse) -> None:
        async with self._lock:
            self.current_data = data
            self.consecutive_errors = 0
            self.is_approaching = data.is_approaching
            self.approach_type = data.approach_type

            point = TrajectoryPoint(
                timestamp=data.timestamp,
                x=data.position.x,
                y=data.position.y,
                z=data.position.z,
            )
            # Skip duplicate timestamps
            if not self.trajectory_points or self.trajectory_points[-1].timestamp != point.timestamp:
                self.trajectory_points.append(point)

            self.source_status[data.source] = SourceInfo(
                name=data.source,
                status="ok",
                last_success_at=data.timestamp,
                consecutive_errors=0,
            )

    async def record_error(self, source: str, error_msg: str) -> None:
        async with self._lock:
            self.consecutive_errors += 1
            if source in self.source_status:
                info = self.source_status[source]
                self.source_status[source] = SourceInfo(
                    name=source,
                    status="error" if self.consecutive_errors >= 3 else "degraded",
                    last_success_at=info.last_success_at,
                    consecutive_errors=self.consecutive_errors,
                )

    def get_current(self) -> Optional[MissionCurrentResponse]:
        return self.current_data

    def get_trajectory(self, range_str: str) -> List[TrajectoryPoint]:
        now = datetime.now(timezone.utc)
        points = list(self.trajectory_points)

        if range_str == "1h":
            cutoff = now - timedelta(hours=1)
        elif range_str == "2h":
            cutoff = now - timedelta(hours=2)
        elif range_str == "8h":
            cutoff = now - timedelta(hours=8)
        elif range_str == "mission":
            return points
        else:
            cutoff = now - timedelta(hours=1)

        return [p for p in points if p.timestamp >= cutoff]

    def get_cache_info(self) -> CacheInfo:
        pts = list(self.trajectory_points)
        return CacheInfo(
            status="ok" if pts else "empty",
            trajectory_points=len(pts),
            oldest_point_at=pts[0].timestamp if pts else None,
            newest_point_at=pts[-1].timestamp if pts else None,
        )

    def get_uptime(self) -> float:
        return time.time() - self._start_time


cache_service = CacheService()
