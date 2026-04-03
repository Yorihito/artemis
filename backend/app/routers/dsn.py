from fastapi import APIRouter

from app.config import settings
from app.models.dsn import DSNStatus
from app.services import dsn_client

router = APIRouter(prefix="/api/dsn", tags=["dsn"])


@router.get("", response_model=DSNStatus)
async def get_dsn_status():
    if settings.USE_MOCK:
        return dsn_client.mock_dsn_status()
    status = await dsn_client.fetch_dsn_status()
    if status is None:
        # Return a not-tracking state rather than 500
        from datetime import datetime, timezone
        return DSNStatus(
            is_tracking=False,
            dishes=[],
            primary_dish=None,
            complexes=[],
            fetched_at=datetime.now(timezone.utc).isoformat(),
        )
    return status
