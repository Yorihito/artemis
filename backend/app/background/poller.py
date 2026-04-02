"""
Background polling loop.
- Normal cruise: polls every POLL_INTERVAL_NORMAL_SECONDS (30 min)
- Approach phase: polls every POLL_INTERVAL_APPROACH_SECONDS (1 min)
"""
import asyncio
import logging
from datetime import datetime, timezone

from app.config import settings
from app.services.cache_service import cache_service
from app.services import horizons_client
from app.services import telemetry_normalizer
from app.services.mock_data import generate_mock_state
from app.models.mission import Vector3D

logger = logging.getLogger(__name__)


async def _fetch_and_update() -> bool:
    """Fetch data from source and update cache. Returns True on success."""
    try:
        if settings.USE_MOCK:
            now, position, velocity = generate_mock_state()
            source = "Mock"
        else:
            raw = await horizons_client.fetch_current_state()
            if raw is None:
                logger.warning("Horizons returned no data")
                await cache_service.record_error("Horizons", "No data returned")
                return False
            now = raw.timestamp
            position = raw.position
            velocity = raw.velocity
            source = "Horizons"

        normalized = telemetry_normalizer.normalize(
            source=source,
            timestamp=now,
            position=position,
            velocity=velocity,
        )
        await cache_service.update(normalized)

        logger.info(
            f"[{source}] Updated: "
            f"phase={normalized.phase.value} "
            f"earth={normalized.distance_from_earth_km:.0f}km "
            f"moon={normalized.distance_from_moon_km:.0f}km "
            f"v={normalized.relative_velocity_kms:.2f}km/s "
            f"approaching={normalized.is_approaching}"
        )
        return True

    except Exception as e:
        logger.error(f"Poller error: {e}")
        await cache_service.record_error("Horizons", str(e))
        return False


async def _prepopulate_history():
    """
    On startup, fill the trajectory cache with historical mock data points
    from launch until now at 5-minute intervals. This makes the trajectory
    visible immediately without waiting for real polling cycles.
    Only runs in mock mode.
    """
    if not settings.USE_MOCK:
        return
    from datetime import timedelta
    from dateutil.parser import parse as parse_dt
    from app.services.mock_data import generate_mock_state
    from app.services import telemetry_normalizer
    from app.models.mission import TrajectoryPoint

    launch = parse_dt(settings.MISSION_LAUNCH_EPOCH)
    now = datetime.now(timezone.utc)
    if now <= launch:
        return  # Pre-launch, nothing to populate

    step = timedelta(minutes=5)
    t = launch
    points_added = 0
    while t <= now:
        _, position, velocity = generate_mock_state(at=t)
        normalized = telemetry_normalizer.normalize(
            source="Mock",
            timestamp=t,
            position=position,
            velocity=velocity,
        )
        # Directly append trajectory point without updating current_data
        pt = TrajectoryPoint(timestamp=t, x=position.x, y=position.y, z=position.z)
        cache_service.trajectory_points.append(pt)
        t += step
        points_added += 1

    logger.info(f"Pre-populated {points_added} historical trajectory points from launch to now")


async def polling_loop():
    """Main polling loop. Adjusts interval based on approach state."""
    logger.info("Background polling loop started")

    # Pre-populate historical trajectory for mock mode
    await _prepopulate_history()

    # Initial fetch immediately on startup
    await _fetch_and_update()

    while True:
        if cache_service.is_approaching:
            interval = settings.POLL_INTERVAL_APPROACH_SECONDS
        else:
            interval = settings.POLL_INTERVAL_NORMAL_SECONDS

        logger.debug(f"Next poll in {interval}s (approaching={cache_service.is_approaching})")
        await asyncio.sleep(interval)
        await _fetch_and_update()
