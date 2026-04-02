import math
from datetime import datetime, timezone
from typing import Optional
from dateutil.parser import parse as parse_dt

from app.models.mission import MissionCurrentResponse, MissionPhase, Vector3D, PHASE_LABELS
from app.services.phase_service import detect_phase, detect_approach
from app.config import settings

# Moon's approximate position in EME2000 at a fixed reference
# In reality we'd query Horizons for the Moon, but for MVP we use a simplified model.
# Moon average distance from Earth: 384,400 km
# We'll compute actual moon distance from spacecraft position by approximating Moon position.

EARTH_RADIUS_KM = 6371.0
MOON_MEAN_DISTANCE_KM = 384_400.0


def _get_moon_position_approx(timestamp: datetime) -> Vector3D:
    """
    Approximate Moon position in EME2000 frame.
    Moon orbits Earth in ~27.3 days. We compute a rough position based on epoch.
    This is a simplified approximation for MVP visualization.
    """
    epoch = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    dt_seconds = (timestamp - epoch).total_seconds()
    # Moon orbital period: 27.3217 days in seconds
    moon_period = 27.3217 * 86400
    angle_rad = (2 * math.pi * dt_seconds / moon_period)
    # Moon orbital inclination ~5.1 degrees — simplified to ecliptic plane
    x = MOON_MEAN_DISTANCE_KM * math.cos(angle_rad)
    y = MOON_MEAN_DISTANCE_KM * math.sin(angle_rad) * math.cos(math.radians(5.1))
    z = MOON_MEAN_DISTANCE_KM * math.sin(angle_rad) * math.sin(math.radians(5.1))
    return Vector3D(x=x, y=y, z=z)


def _distance(a: Vector3D, b: Vector3D) -> float:
    return math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)


def _magnitude(v: Vector3D) -> float:
    return math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2)


def _get_mission_elapsed_seconds(timestamp: datetime) -> float:
    launch_epoch = parse_dt(settings.MISSION_LAUNCH_EPOCH)
    return (timestamp - launch_epoch).total_seconds()


def normalize(
    source: str,
    timestamp: datetime,
    position: Vector3D,
    velocity: Vector3D,
    moon_position: Optional[Vector3D] = None,
) -> MissionCurrentResponse:
    distance_from_earth_km = _magnitude(position)
    moon_pos = moon_position if moon_position is not None else _get_moon_position_approx(timestamp)
    distance_from_moon_km = _distance(position, moon_pos)
    velocity_kms = _magnitude(velocity)
    met = _get_mission_elapsed_seconds(timestamp)

    phase = detect_phase(
        distance_from_earth_km=distance_from_earth_km,
        distance_from_moon_km=distance_from_moon_km,
        velocity_kms=velocity_kms,
        mission_elapsed_seconds=met,
    )
    is_approaching, approach_type = detect_approach(
        distance_from_moon_km=distance_from_moon_km,
        distance_from_earth_km=distance_from_earth_km,
    )

    return MissionCurrentResponse(
        source=source,
        timestamp=timestamp,
        phase=phase,
        phase_label=PHASE_LABELS[phase],
        distance_from_earth_km=round(distance_from_earth_km, 1),
        distance_from_moon_km=round(distance_from_moon_km, 1),
        relative_velocity_kms=round(velocity_kms, 4),
        position=position,
        velocity=velocity,
        mission_elapsed_seconds=round(met, 1),
        last_success_at=timestamp,
        is_approaching=is_approaching,
        approach_type=approach_type,
        moon_position=moon_pos,
    )
