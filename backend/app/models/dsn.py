from pydantic import BaseModel
from typing import Optional, List


class DSNSignalInfo(BaseModel):
    active: bool
    band: str
    data_rate_bps: float
    power_dbm: float
    signal_type: str


class DSNDish(BaseModel):
    dish_name: str
    complex_id: str       # "gdscc" | "mdscc" | "cdscc"
    complex_name: str     # "Goldstone" | "Madrid" | "Canberra"
    location: str
    flag: str
    azimuth_deg: float
    elevation_deg: float
    rtlt_sec: float
    range_km: float
    activity: str
    down_signal: Optional[DSNSignalInfo] = None
    up_signal: Optional[DSNSignalInfo] = None
    has_active_signal: bool


class ComplexStatus(BaseModel):
    complex_id: str
    complex_name: str
    flag: str
    is_tracking: bool
    dish_count: int        # number of dishes on EM2 at this complex


class DSNStatus(BaseModel):
    is_tracking: bool
    dishes: List[DSNDish]
    primary_dish: Optional[DSNDish] = None
    complexes: List[ComplexStatus]
    fetched_at: str
    dsn_timestamp_ms: Optional[int] = None
