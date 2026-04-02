from datetime import datetime, timezone
from app.models.mission import MissionPhase
from app.config import settings
from dateutil.parser import parse as parse_dt


def detect_phase(
    distance_from_earth_km: float,
    distance_from_moon_km: float,
    velocity_kms: float,
    mission_elapsed_seconds: float,
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

    # Determine direction: if Earth distance decreasing while far from Moon
    # We approximate by checking timing relative to launch
    # Lunar flyby expected ~60h after launch
    hours_elapsed = met / 3600

    if hours_elapsed < 70:
        # Still heading toward Moon
        if distance_from_earth_km > 10_000:
            return MissionPhase.TranslunarCoast
    else:
        # Heading back to Earth
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
