from pydantic import BaseModel
from typing import Optional, List
from enum import Enum
from datetime import datetime


class MissionPhase(str, Enum):
    Prelaunch = "Prelaunch"
    Ascent = "Ascent"
    EarthParkingOrbit = "EarthParkingOrbit"
    TranslunarInjection = "TranslunarInjection"
    TranslunarCoast = "TranslunarCoast"
    LunarFlyby = "LunarFlyby"
    ReturnCoast = "ReturnCoast"
    Reentry = "Reentry"
    Splashdown = "Splashdown"
    Complete = "Complete"
    Unknown = "Unknown"


PHASE_LABELS = {
    MissionPhase.Prelaunch: "Pre-launch",
    MissionPhase.Ascent: "Ascent",
    MissionPhase.EarthParkingOrbit: "Earth Parking Orbit",
    MissionPhase.TranslunarInjection: "Translunar Injection",
    MissionPhase.TranslunarCoast: "Translunar Coast",
    MissionPhase.LunarFlyby: "Lunar Flyby",
    MissionPhase.ReturnCoast: "Return Coast",
    MissionPhase.Reentry: "Re-entry",
    MissionPhase.Splashdown: "Splashdown",
    MissionPhase.Complete: "Mission Complete",
    MissionPhase.Unknown: "Unknown",
}


class Vector3D(BaseModel):
    x: float
    y: float
    z: float


class MissionCurrentResponse(BaseModel):
    mission: str = "Artemis II"
    source: str
    timestamp: datetime
    phase: MissionPhase
    phase_label: str
    distance_from_earth_km: float
    distance_from_moon_km: float
    relative_velocity_kms: float
    position: Vector3D
    velocity: Vector3D
    mission_elapsed_seconds: float
    last_success_at: Optional[datetime]
    is_approaching: bool = False
    approach_type: Optional[str] = None  # "moon" | "earth" | None


class TrajectoryPoint(BaseModel):
    timestamp: datetime
    x: float
    y: float
    z: float


class TrajectoryResponse(BaseModel):
    mission: str = "Artemis II"
    source: str
    frame: str = "EME2000"
    points: List[TrajectoryPoint]


class EventStatus(str, Enum):
    completed = "completed"
    in_progress = "in_progress"
    upcoming = "upcoming"
    unknown = "unknown"


class MissionEvent(BaseModel):
    event_id: str
    name: str
    planned_time: datetime
    actual_time: Optional[datetime] = None
    status: EventStatus
    description: Optional[str] = None


class EventsResponse(BaseModel):
    mission: str = "Artemis II"
    events: List[MissionEvent]
