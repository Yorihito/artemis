from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.services.cache_service import cache_service
from app.services.event_service import get_events
from app.models.mission import MissionCurrentResponse, TrajectoryResponse, EventsResponse
from app.background.poller import _fetch_and_update

router = APIRouter(prefix="/api/mission", tags=["mission"])


@router.get("/current", response_model=MissionCurrentResponse)
async def get_current():
    data = cache_service.get_current()
    if data is None:
        raise HTTPException(
            status_code=503,
            detail="No data available yet. The polling loop may still be initializing.",
        )
    return data


@router.get("/trajectory", response_model=TrajectoryResponse)
async def get_trajectory(
    range: str = Query(default="1h", regex="^(10m|1h|mission)$"),
    source: Optional[str] = Query(default=None),
):
    current = cache_service.get_current()
    src = current.source if current else "Unknown"
    points = cache_service.get_trajectory(range)
    return TrajectoryResponse(source=src, points=points)


@router.get("/events", response_model=EventsResponse)
async def get_events_endpoint():
    return get_events()


@router.post("/poll-now")
async def poll_now():
    """Manually trigger a data fetch (used by frontend refresh button)."""
    success = await _fetch_and_update()
    if not success:
        raise HTTPException(status_code=503, detail="Data fetch failed")
    data = cache_service.get_current()
    return {"status": "ok", "timestamp": data.timestamp if data else None}
