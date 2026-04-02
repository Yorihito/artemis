"""
JPL Horizons API client for fetching Orion spacecraft state vectors.

API docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html
"""
import asyncio
import math
import re
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

from app.config import settings
from app.models.mission import Vector3D

logger = logging.getLogger(__name__)


class HorizonsRawData:
    def __init__(
        self,
        timestamp: datetime,
        position: Vector3D,
        velocity: Vector3D,
    ):
        self.timestamp = timestamp
        self.position = position
        self.velocity = velocity


def _parse_horizons_vectors(text: str) -> Optional[HorizonsRawData]:
    """
    Parse the $$SOE...$$EOE block from a Horizons VECTORS response.
    Format per line: JDTDB, Calendar Date (TDB), X, Y, Z, VX, VY, VZ
    """
    soe = text.find("$$SOE")
    eoe = text.find("$$EOE")
    if soe == -1 or eoe == -1:
        logger.warning("Horizons: $$SOE/$$EOE markers not found in response")
        return None

    block = text[soe + 5: eoe].strip()
    lines = [l.strip() for l in block.splitlines() if l.strip()]

    # Horizons returns multiple rows; we take the first one closest to now
    # Each vector entry is 2 lines:
    #   Line 1: JDTDB = ... A.D. YYYY-Mon-DD HH:MM:SS.fff
    #   Line 2: X = val Y = val Z = val
    #   Line 3: VX = val VY = val VZ = val
    #   Line 4: LT = ... RG = ... RR = ...
    try:
        # Find first date line
        date_pattern = re.compile(
            r"(\d{4}-\w{3}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)"
        )
        xyz_pattern = re.compile(
            r"X\s*=\s*([\-\d.E+]+)\s+Y\s*=\s*([\-\d.E+]+)\s+Z\s*=\s*([\-\d.E+]+)"
        )
        vxyz_pattern = re.compile(
            r"VX\s*=\s*([\-\d.E+]+)\s+VY\s*=\s*([\-\d.E+]+)\s+VZ\s*=\s*([\-\d.E+]+)"
        )

        timestamp = None
        position = None
        velocity = None

        full_block = "\n".join(lines)
        date_match = date_pattern.search(full_block)
        xyz_match = xyz_pattern.search(full_block)
        vxyz_match = vxyz_pattern.search(full_block)

        if date_match:
            date_str = date_match.group(1)
            # Parse "2026-Apr-02 18:50:00.000"
            timestamp = datetime.strptime(date_str.strip(), "%Y-%b-%d %H:%M:%S.%f")
            timestamp = timestamp.replace(tzinfo=timezone.utc)

        if xyz_match:
            position = Vector3D(
                x=float(xyz_match.group(1)),
                y=float(xyz_match.group(2)),
                z=float(xyz_match.group(3)),
            )

        if vxyz_match:
            velocity = Vector3D(
                x=float(vxyz_match.group(1)),
                y=float(vxyz_match.group(2)),
                z=float(vxyz_match.group(3)),
            )

        if timestamp and position and velocity:
            return HorizonsRawData(timestamp=timestamp, position=position, velocity=velocity)

    except Exception as e:
        logger.error(f"Horizons parse error: {e}")

    return None


async def fetch_current_state() -> Optional[HorizonsRawData]:
    """Fetch the current state vector from JPL Horizons with retry."""
    now = datetime.now(timezone.utc)
    start = now.strftime("%Y-%b-%d %H:%M")
    stop = (now + timedelta(hours=1)).strftime("%Y-%b-%d %H:%M")

    params = {
        "format": "json",
        "COMMAND": f"'{settings.HORIZONS_TARGET_ID}'",
        "EPHEM_TYPE": "VECTORS",
        "CENTER": "'500@399'",
        "START_TIME": f"'{start}'",
        "STOP_TIME": f"'{stop}'",
        "STEP_SIZE": "'1m'",
        "OUT_UNITS": "'KM-S'",
        "VEC_TABLE": "2",
    }

    for attempt in range(settings.HORIZONS_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=settings.HORIZONS_TIMEOUT_SECONDS) as client:
                response = await client.get(settings.HORIZONS_BASE_URL, params=params)
                response.raise_for_status()
                body = response.json()
                raw_text = body.get("result", "")
                result = _parse_horizons_vectors(raw_text)
                if result:
                    return result
                logger.warning(f"Horizons: parse returned None on attempt {attempt+1}. Snippet: {raw_text[:200]}")
        except Exception as e:
            wait = 2 ** attempt
            logger.warning(f"Horizons attempt {attempt+1} failed: {e}. Retrying in {wait}s")
            if attempt < settings.HORIZONS_MAX_RETRIES - 1:
                await asyncio.sleep(wait)

    return None
