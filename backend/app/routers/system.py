from fastapi import APIRouter
from pydantic import BaseModel
from pydantic import Field
from app.services.cache_service import cache_service
from app.services.visitor_service import visitor_service
from app.models.system import SystemStatusResponse
from app.config import settings

router = APIRouter(prefix="/api/system", tags=["system"])


class VisitRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)


class VisitorStatsResponse(BaseModel):
    unique_visitors: int
    total_visits: int
    since: str


@router.post("/visit", status_code=204)
async def record_visit(body: VisitRequest):
    visitor_service.record(body.session_id)


@router.get("/visitors", response_model=VisitorStatsResponse)
async def get_visitors():
    stats = visitor_service.get_stats()
    return VisitorStatsResponse(
        unique_visitors=stats["unique_visitors"],
        total_visits=stats["total_visits"],
        since=visitor_service.since.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


@router.get("/status", response_model=SystemStatusResponse)
async def get_status():
    sources = list(cache_service.source_status.values())
    poll_interval = (
        settings.POLL_INTERVAL_APPROACH_SECONDS
        if cache_service.is_approaching
        else settings.POLL_INTERVAL_NORMAL_SECONDS
    )
    return SystemStatusResponse(
        sources=sources,
        cache=cache_service.get_cache_info(),
        is_approaching=cache_service.is_approaching,
        approach_type=cache_service.approach_type,
        poll_interval_seconds=poll_interval,
        uptime_seconds=cache_service.get_uptime(),
    )
