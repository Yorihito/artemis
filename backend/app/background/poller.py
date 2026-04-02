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
    On startup, fill the trajectory cache with historical data points
    from launch until now at 30-minute intervals.
    Mock mode: uses simulated data.
    Real mode: queries Horizons for each point (rate-limited).
    """
    from datetime import timedelta
    from dateutil.parser import parse as parse_dt
    from app.services.mock_data import generate_mock_state
    from app.models.mission import TrajectoryPoint
    import httpx

    launch = parse_dt(settings.MISSION_LAUNCH_EPOCH)
    now = datetime.now(timezone.utc)
    if now <= launch:
        logger.info("Pre-launch, skipping history pre-population")
        return

    if settings.USE_MOCK:
        # Mock: generate points every 5 minutes
        step = timedelta(minutes=5)
        t = launch
        points_added = 0
        while t <= now:
            _, position, velocity = generate_mock_state(at=t)
            pt = TrajectoryPoint(timestamp=t, x=position.x, y=position.y, z=position.z)
            cache_service.trajectory_points.append(pt)
            t += step
            points_added += 1
        logger.info(f"Pre-populated {points_added} mock trajectory points")
    else:
        # Real: fetch bulk history from Horizons at 30-min resolution
        start_str = launch.strftime("%Y-%b-%d %H:%M")
        stop_str = now.strftime("%Y-%b-%d %H:%M")
        params = {
            "format": "json",
            "COMMAND": f"'{settings.HORIZONS_TARGET_ID}'",
            "EPHEM_TYPE": "VECTORS",
            "CENTER": "'500@399'",
            "START_TIME": f"'{start_str}'",
            "STOP_TIME": f"'{stop_str}'",
            "STEP_SIZE": "'30m'",
            "OUT_UNITS": "'KM-S'",
            "VEC_TABLE": "2",
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(settings.HORIZONS_BASE_URL, params=params)
                resp.raise_for_status()
                raw = resp.json().get("result", "")
                from app.services.horizons_client import _parse_horizons_vectors
                # Parse all points from the block
                import re
                soe = raw.find("$$SOE")
                eoe = raw.find("$$EOE")
                if soe > 0 and eoe > 0:
                    block = raw[soe+5:eoe]
                    date_re = re.compile(r"(\d{4}-\w{3}-\d{2} \d{2}:\d{2}:\d{2}\.\d+)")
                    xyz_re  = re.compile(r"X\s*=\s*([\-\d.E+]+)\s+Y\s*=\s*([\-\d.E+]+)\s+Z\s*=\s*([\-\d.E+]+)")
                    dates = date_re.findall(block)
                    xyzs  = xyz_re.findall(block)
                    added = 0
                    for date_str, (x, y, z) in zip(dates, xyzs):
                        ts = datetime.strptime(date_str.strip(), "%Y-%b-%d %H:%M:%S.%f").replace(tzinfo=timezone.utc)
                        pt = TrajectoryPoint(timestamp=ts, x=float(x), y=float(y), z=float(z))
                        cache_service.trajectory_points.append(pt)
                        added += 1
                    logger.info(f"Pre-populated {added} real Horizons trajectory points")
                else:
                    logger.warning("Horizons history: no $$SOE/$$EOE in response")
        except Exception as e:
            logger.warning(f"Horizons history pre-population failed: {e}")


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
