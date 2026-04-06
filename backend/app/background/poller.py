"""
Background polling loop.
- Normal cruise: polls every POLL_INTERVAL_NORMAL_SECONDS (30 min)
- Approach phase: polls every POLL_INTERVAL_APPROACH_SECONDS (1 min)

Data source priority (real mode):
  1. NASA OEM file — official JSC flight-dynamics ephemeris, updated ~daily
  2. JPL Horizons  — fallback if OEM unavailable
"""
import asyncio
import logging
import re
from datetime import datetime, timezone, timedelta

import httpx
from dateutil.parser import parse as parse_dt

from app.config import settings
from app.services.cache_service import cache_service
from app.services import horizons_client
from app.services import nasa_oem_client
from app.services import telemetry_normalizer
from app.services.mock_data import generate_mock_state
from app.services.trajectory_store import trajectory_store
from app.models.mission import TrajectoryPoint

logger = logging.getLogger(__name__)


async def _fetch_and_update() -> bool:
    """Fetch data from source, update cache, and persist the new point."""
    try:
        if settings.USE_MOCK:
            now, position, velocity = generate_mock_state()
            source = "Mock"
        else:
            source = None
            now = position = velocity = None

            # --- Primary: NASA OEM file ---
            if not settings.OEM_DISABLED:
                oem_raw = await nasa_oem_client.fetch_current_state()
                if oem_raw is not None:
                    now = oem_raw.timestamp
                    position = oem_raw.position
                    velocity = oem_raw.velocity
                    source = "NASA OEM"
                else:
                    logger.warning("NASA OEM returned no data, falling back to Horizons")

            # --- Fallback: JPL Horizons ---
            if source is None:
                raw = await horizons_client.fetch_current_state()
                if raw is None:
                    logger.warning("Horizons returned no data")
                    await cache_service.record_error("Horizons", "No data returned")
                    return False
                now = raw.timestamp
                position = raw.position
                velocity = raw.velocity
                source = "Horizons"

        moon_position = None
        if not settings.USE_MOCK:
            moon_position = await horizons_client.fetch_moon_position(now)
            if moon_position:
                logger.info(f"Moon position: x={moon_position.x:.0f} y={moon_position.y:.0f} z={moon_position.z:.0f} km")

        normalized = telemetry_normalizer.normalize(
            source=source,
            timestamp=now,
            position=position,
            velocity=velocity,
            moon_position=moon_position,
        )
        await cache_service.update(normalized)

        # Persist new point to Table Storage (skip if same timestamp as latest stored)
        if not settings.USE_MOCK:
            latest = trajectory_store.latest_timestamp()
            if latest is None or now > latest:
                pt = TrajectoryPoint(timestamp=now, x=position.x, y=position.y, z=position.z)
                trajectory_store.save(pt)

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
    On startup, fill the trajectory cache.
    - Mock mode: generate points from launch to now at 5-min intervals.
    - Real mode: load stored points from Table Storage first, then fetch
      only the gap (stored_latest → now) from Horizons.
    """
    launch = parse_dt(settings.MISSION_LAUNCH_EPOCH)
    now = datetime.now(timezone.utc)
    if now <= launch:
        logger.info("Pre-launch, skipping history pre-population")
        return

    if settings.USE_MOCK:
        step = timedelta(minutes=5)
        t = launch
        count = 0
        while t <= now:
            _, position, velocity = generate_mock_state(at=t)
            pt = TrajectoryPoint(timestamp=t, x=position.x, y=position.y, z=position.z)
            cache_service.trajectory_points.append(pt)
            t += step
            count += 1
        logger.info(f"Pre-populated {count} mock trajectory points")
        return

    # ── Real mode ──────────────────────────────────────────────────────────

    # 1. Load persisted points into the deque
    stored = trajectory_store.load_all()
    for pt in stored:
        cache_service.trajectory_points.append(pt)

    latest_stored = trajectory_store.latest_timestamp()

    # 2a. Try to fill history from NASA OEM file (preferred: denser data, official source)
    if not settings.OEM_DISABLED:
        oem_vectors = await nasa_oem_client.fetch_latest_oem()
        if oem_vectors:
            oem_start = oem_vectors[0][0]
            oem_end = oem_vectors[-1][0]
            now_utc = datetime.now(timezone.utc)
            new_points = []
            for ts, pos, _ in oem_vectors:
                if ts > now_utc:
                    continue  # Skip future predictions
                if latest_stored is not None and ts <= latest_stored:
                    continue  # Already stored
                pt = TrajectoryPoint(timestamp=ts, x=pos.x, y=pos.y, z=pos.z)
                cache_service.trajectory_points.append(pt)
                new_points.append(pt)
            if new_points:
                trajectory_store.save_batch(new_points)
            logger.info(
                f"Pre-populated {len(new_points)} new points from NASA OEM "
                f"({oem_start.isoformat()} → {oem_end.isoformat()}, "
                f"total in cache: {len(cache_service.trajectory_points)})"
            )
            # Update latest_stored so Horizons gap-fill below uses the right start
            latest_stored = trajectory_store.latest_timestamp()

    # 2b. Fill any remaining gap (after OEM coverage) from Horizons
    ephemeris_start = parse_dt(settings.HORIZONS_EPHEMERIS_START)

    if latest_stored is None:
        fetch_from = ephemeris_start
    else:
        fetch_from = latest_stored + timedelta(minutes=30)

    if fetch_from >= now:
        logger.info(f"TrajectoryStore up-to-date (latest: {latest_stored}), no Horizons fetch needed")
        return

    # 3. Fetch the gap from Horizons
    start_str = fetch_from.strftime("%Y-%b-%d %H:%M")
    stop_str = now.strftime("%Y-%b-%d %H:%M")
    logger.info(f"Fetching gap from Horizons: {start_str} → {stop_str}")

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

        soe = raw.find("$$SOE")
        eoe = raw.find("$$EOE")
        if soe < 0 or eoe < 0:
            logger.warning("Horizons history: no $$SOE/$$EOE in response")
            return

        block = raw[soe + 5:eoe]
        date_re = re.compile(r"(\d{4}-\w{3}-\d{2} \d{2}:\d{2}:\d{2}\.\d+)")
        xyz_re = re.compile(
            r"X\s*=\s*([\-\d.E+]+)\s+Y\s*=\s*([\-\d.E+]+)\s+Z\s*=\s*([\-\d.E+]+)"
        )
        dates = date_re.findall(block)
        xyzs = xyz_re.findall(block)

        new_points = []
        for date_str, (x, y, z) in zip(dates, xyzs):
            ts = datetime.strptime(date_str.strip(), "%Y-%b-%d %H:%M:%S.%f").replace(
                tzinfo=timezone.utc
            )
            pt = TrajectoryPoint(timestamp=ts, x=float(x), y=float(y), z=float(z))
            cache_service.trajectory_points.append(pt)
            new_points.append(pt)

        trajectory_store.save_batch(new_points)
        logger.info(
            f"Pre-populated {len(new_points)} new points from Horizons "
            f"(total in cache: {len(cache_service.trajectory_points)})"
        )

    except Exception as e:
        logger.warning(f"Horizons history pre-population failed: {e}")


async def polling_loop():
    """Main polling loop. Adjusts interval based on approach state."""
    logger.info("Background polling loop started")

    await _prepopulate_history()
    await _fetch_and_update()

    while True:
        interval = (
            settings.POLL_INTERVAL_APPROACH_SECONDS
            if cache_service.is_approaching
            else settings.POLL_INTERVAL_NORMAL_SECONDS
        )
        logger.debug(f"Next poll in {interval}s (approaching={cache_service.is_approaching})")
        await asyncio.sleep(interval)
        await _fetch_and_update()
