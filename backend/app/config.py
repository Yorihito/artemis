from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001", "*"]

    # Mock mode (use simulated data instead of real Horizons API)
    USE_MOCK: bool = True

    # JPL Horizons
    HORIZONS_BASE_URL: str = "https://ssd.jpl.nasa.gov/api/horizons.api"
    # Artemis II NAIF ID — TBD after launch confirmation.
    # Use Moon (-301) for pre-mission testing, or a placeholder.
    HORIZONS_TARGET_ID: str = "-1024"  # Artemis II (confirmed NAIF ID)
    HORIZONS_MOON_ID: str = "301"
    HORIZONS_TIMEOUT_SECONDS: float = 15.0
    HORIZONS_MAX_RETRIES: int = 3

    # Polling intervals (seconds)
    POLL_INTERVAL_NORMAL_SECONDS: int = 1800   # 30 min during cruise
    POLL_INTERVAL_APPROACH_SECONDS: int = 60   # 1 min during approach (backend floor)

    # Approach thresholds
    MOON_APPROACH_THRESHOLD_KM: float = 100_000.0
    EARTH_APPROACH_THRESHOLD_KM: float = 50_000.0

    # Mission definition
    MISSION_LAUNCH_EPOCH: str = "2026-04-01T22:35:12Z"

    # Cache
    TRAJECTORY_MAX_POINTS: int = 2880  # 24h at 30-second resolution

    class Config:
        env_file = ".env"


settings = Settings()
