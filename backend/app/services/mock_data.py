"""
Mock data generator for development and testing.
Simulates Artemis II trajectory from launch to lunar flyby and return.
"""
import math
from datetime import datetime, timezone
from dateutil.parser import parse as parse_dt

from app.models.mission import Vector3D
from app.config import settings


LAUNCH_EPOCH = parse_dt(settings.MISSION_LAUNCH_EPOCH)

# Simplified trajectory waypoints [MET_hours, earth_distance_km, angle_deg]
# Artemis II free-return trajectory approximation
TRAJECTORY_WAYPOINTS = [
    (0.0, 6_471, 0),       # Launch (LEO altitude)
    (0.2, 6_600, 2),       # Max-Q / Ascent
    (0.5, 7_000, 5),       # Stage separation
    (1.5, 10_000, 15),     # Earth parking orbit
    (3.0, 50_000, 40),     # TLI burn complete
    (24.0, 150_000, 90),   # 1 day out
    (48.0, 280_000, 150),  # 2 days out
    (60.0, 340_000, 165),  # Approaching Moon
    (66.0, 380_000, 172),  # Near Moon
    (70.0, 350_000, 175),  # Lunar flyby closest approach
    (96.0, 300_000, 185),  # Return coast
    (144.0, 200_000, 210), # Midway home
    (192.0, 80_000, 250),  # Approaching Earth
    (210.0, 20_000, 270),  # Pre re-entry
    (212.0, 6_471, 275),   # Re-entry / Splashdown
]


def _interpolate(met_hours: float) -> tuple[float, float]:
    """Interpolate earth_distance and angle for given MET in hours."""
    wps = TRAJECTORY_WAYPOINTS
    if met_hours <= wps[0][0]:
        return wps[0][1], wps[0][2]
    if met_hours >= wps[-1][0]:
        return wps[-1][1], wps[-1][2]

    for i in range(len(wps) - 1):
        t0, d0, a0 = wps[i]
        t1, d1, a1 = wps[i + 1]
        if t0 <= met_hours <= t1:
            frac = (met_hours - t0) / (t1 - t0)
            return d0 + (d1 - d0) * frac, a0 + (a1 - a0) * frac

    return wps[-1][1], wps[-1][2]


def generate_mock_state(at: datetime | None = None) -> tuple[datetime, Vector3D, Vector3D]:
    """Generate a mock spacecraft state for the given time (default: now)."""
    now = at or datetime.now(timezone.utc)
    met_seconds = (now - LAUNCH_EPOCH).total_seconds()
    met_hours = met_seconds / 3600.0

    # Post-splashdown: Orion at rest on Earth's surface (Pacific Ocean)
    if met_hours >= TRAJECTORY_WAYPOINTS[-1][0]:
        last_angle_rad = math.radians(TRAJECTORY_WAYPOINTS[-1][2])
        r = 6371.0  # Earth radius km (surface)
        position = Vector3D(
            x=r * math.cos(last_angle_rad),
            y=r * math.sin(last_angle_rad),
            z=0.0,
        )
        velocity = Vector3D(x=0.0, y=0.0, z=0.0)
        return now, position, velocity

    earth_dist_km, angle_deg = _interpolate(met_hours)
    angle_rad = math.radians(angle_deg)

    # Position in XY plane (ecliptic approximation)
    x = earth_dist_km * math.cos(angle_rad)
    y = earth_dist_km * math.sin(angle_rad)
    z = earth_dist_km * math.sin(math.radians(5.0)) * math.sin(angle_rad)

    position = Vector3D(x=x, y=y, z=z)

    # Approximate velocity from trajectory gradient
    # Speed varies from ~9 km/s (LEO) to ~1 km/s (near Moon) and back
    speed = _estimate_speed(earth_dist_km, met_hours)
    dx = -math.sin(angle_rad) * speed
    dy = math.cos(angle_rad) * speed
    dz = 0.0

    velocity = Vector3D(x=dx, y=dy, z=dz)

    return now, position, velocity


def _estimate_speed(earth_dist_km: float, met_hours: float) -> float:
    """Rough speed estimate based on position (vis-viva approximation)."""
    MU = 398_600.4418  # km^3/s^2
    if earth_dist_km < 6_500:
        return 7.8
    v = math.sqrt(MU * (2 / earth_dist_km - 1 / 300_000))
    return max(0.5, min(v, 12.0))
