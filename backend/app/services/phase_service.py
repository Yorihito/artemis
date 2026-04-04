from datetime import datetime, timezone
from app.models.mission import MissionPhase, Vector3D
from app.config import settings
from dateutil.parser import parse as parse_dt


def _dot(a: Vector3D, b: Vector3D) -> float:
    return a.x * b.x + a.y * b.y + a.z * b.z


def detect_phase(
    distance_from_earth_km: float,
    distance_from_moon_km: float,
    velocity_kms: float,
    mission_elapsed_seconds: float,
    position: Vector3D | None = None,
    velocity: Vector3D | None = None,
    moon_position: Vector3D | None = None,
) -> MissionPhase:
    met = mission_elapsed_seconds

    if met < 0:
        return MissionPhase.Prelaunch

    # Splashdown / Complete: near Earth, very slow
    if distance_from_earth_km < 6500:
        return MissionPhase.Splashdown

    # Re-entry: within 120 km altitude (Earth radius ~6371 km)
    if distance_from_earth_km < 6491:
        return MissionPhase.Reentry

    # Ascent: first 10 minutes of flight
    if met < 600:
        return MissionPhase.Ascent

    # Earth Parking Orbit: close to Earth, low velocity
    if distance_from_earth_km < 40_000 and velocity_kms < 10.0:
        return MissionPhase.EarthParkingOrbit

    # Translunar Injection: high velocity, still close to Earth
    if distance_from_earth_km < 100_000 and velocity_kms >= 10.0:
        return MissionPhase.TranslunarInjection

    # Lunar Flyby: within 50,000 km of Moon
    if distance_from_moon_km < 50_000:
        return MissionPhase.LunarFlyby

    # Determine direction using velocity dot product with moon direction vector.
    # If spacecraft is moving toward Moon → TranslunarCoast; away → ReturnCoast.
    if position is not None and velocity is not None and moon_position is not None:
        # Vector from spacecraft to Moon
        to_moon = Vector3D(
            x=moon_position.x - position.x,
            y=moon_position.y - position.y,
            z=moon_position.z - position.z,
        )
        # Positive dot: moving toward Moon (outbound); negative: moving away (return)
        if _dot(velocity, to_moon) >= 0:
            return MissionPhase.TranslunarCoast
        else:
            return MissionPhase.ReturnCoast

    return MissionPhase.Unknown


def detect_approach(
    distance_from_moon_km: float,
    distance_from_earth_km: float,
) -> tuple[bool, str | None]:
    """Returns (is_approaching, approach_type)"""
    if distance_from_moon_km < settings.MOON_APPROACH_THRESHOLD_KM:
        return True, "moon"
    if distance_from_earth_km < settings.EARTH_APPROACH_THRESHOLD_KM:
        return True, "earth"
    return False, None
