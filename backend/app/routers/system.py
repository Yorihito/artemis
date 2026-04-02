from fastapi import APIRouter
from app.services.cache_service import cache_service
from app.models.system import SystemStatusResponse
from app.config import settings

router = APIRouter(prefix="/api/system", tags=["system"])


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
