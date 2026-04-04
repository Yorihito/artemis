"""
NASA OEM (Orbital Ephemeris Message) client for Artemis II.

NASA's Flight Dynamics team at JSC publishes a CCSDS OEM file on the official
Artemis II tracking page, updated approximately once per day. Each file contains
state vectors at 4-minute intervals (2-second during maneuvers) from mission
start through Entry Interface.

This is mission-control-sourced "real" trajectory data — more authoritative than
JPL Horizons (which reconstructs the trajectory from tracking data with some lag).

Reference: https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/
CCSDS OEM spec: https://ccsds.org/Pubs/502x0b3e1.pdf
"""
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple

import httpx

from app.models.mission import Vector3D

logger = logging.getLogger(__name__)

# NASA tracking page that links to OEM downloads
NASA_TRACKING_PAGE = (
    "https://www.nasa.gov/missions/artemis/artemis-2/"
    "track-nasas-artemis-ii-mission-in-real-time/"
)

# Known filename pattern: Artemis_II_OEM_YYYY_MM_DD_to_EI[_vN].asc
# Hosted under NASA's wp-content/uploads directory
_OEM_FILENAME_RE = re.compile(
    r'Artemis_II_OEM_\d{4}_\d{2}_\d{2}_to_EI(?:_v\d+)?\.asc',
    re.IGNORECASE,
)
_NASA_WP_BASE = "https://www.nasa.gov/wp-content/uploads"

# In-memory cache to avoid hammering NASA servers
_cached_url: Optional[str] = None
_cached_vectors: Optional[List[Tuple[datetime, Vector3D, Vector3D]]] = None
_cache_fetched_at: Optional[datetime] = None
_CACHE_TTL_SECONDS = 3600  # Re-fetch OEM file at most once per hour


class OEMRawData:
    def __init__(self, timestamp: datetime, position: Vector3D, velocity: Vector3D):
        self.timestamp = timestamp
        self.position = position
        self.velocity = velocity


def _parse_oem_text(text: str) -> List[Tuple[datetime, Vector3D, Vector3D]]:
    """
    Parse a CCSDS OEM 2.0 file into a list of (timestamp, position, velocity) tuples.

    Data lines format (whitespace-separated, after META_STOP):
        YYYY-MM-DDTHH:MM:SS.fff  X  Y  Z  VX  VY  VZ

    Position in km, velocity in km/s, frame EME2000/J2000.
    """
    vectors: List[Tuple[datetime, Vector3D, Vector3D]] = []

    # Find data section (after last META_STOP or COMMENT block)
    in_data = False
    for line in text.splitlines():
        stripped = line.strip()

        if not stripped or stripped.startswith("COMMENT"):
            continue
        if stripped.startswith("META_STOP"):
            in_data = True
            continue
        if stripped.startswith("META_START") or stripped.startswith("CCSDS_OEM"):
            in_data = False
            continue

        if not in_data:
            continue

        # Data line: timestamp + 6 floats
        parts = stripped.split()
        if len(parts) < 7:
            continue
        try:
            ts_str = parts[0]
            # Handle both ".fff" and no-fractional-seconds
            if '.' in ts_str:
                ts = datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%S.%f")
            else:
                ts = datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%S")
            ts = ts.replace(tzinfo=timezone.utc)

            x, y, z = float(parts[1]), float(parts[2]), float(parts[3])
            vx, vy, vz = float(parts[4]), float(parts[5]), float(parts[6])

            vectors.append((
                ts,
                Vector3D(x=x, y=y, z=z),
                Vector3D(x=vx, y=vy, z=vz),
            ))
        except (ValueError, IndexError):
            continue

    return vectors


def _candidate_urls(now: datetime) -> List[str]:
    """
    Build a list of candidate OEM file URLs to try, from newest to oldest.
    NASA uploads files under wp-content/uploads/YYYY/MM/.
    We try today and the past 3 days (in case of weekend/holiday gaps),
    and also versioned filenames (_v2, _v3) for the most recent dates.
    """
    urls = []
    for delta in range(4):
        d = (now - timedelta(days=delta)).strftime("%Y_%m_%d")
        year = (now - timedelta(days=delta)).strftime("%Y")
        month = (now - timedelta(days=delta)).strftime("%m")
        base = f"{_NASA_WP_BASE}/{year}/{month}/Artemis_II_OEM_{d}_to_EI"
        # Try versioned first, then unversioned (for recent dates)
        if delta < 2:
            for v in ("_v3", "_v2", ""):
                urls.append(f"{base}{v}.asc")
        else:
            urls.append(f"{base}.asc")
    return urls


async def _discover_oem_url_from_page(client: httpx.AsyncClient) -> Optional[str]:
    """
    Fetch the NASA tracking page and extract the most recent OEM download link.
    Falls back gracefully if the page is unavailable.
    """
    try:
        resp = await client.get(
            NASA_TRACKING_PAGE,
            headers={"User-Agent": "ArtemisTracker/1.0 (+https://github.com/yorihito/artemis)"},
            follow_redirects=True,
            timeout=15.0,
        )
        if resp.status_code != 200:
            logger.debug(f"NASA tracking page returned {resp.status_code}")
            return None
        html = resp.text

        # Find all OEM filename occurrences in the HTML
        matches = _OEM_FILENAME_RE.findall(html)
        if not matches:
            return None

        # Pick the lexicographically latest filename (highest date/version)
        latest = sorted(set(matches))[-1]
        logger.info(f"Discovered OEM filename from NASA page: {latest}")

        # Try to extract the full URL from href
        href_re = re.compile(rf'href=["\']([^"\']*{re.escape(latest)})["\']', re.IGNORECASE)
        href_match = href_re.search(html)
        if href_match:
            url = href_match.group(1)
            if url.startswith("http"):
                return url
            return f"https://www.nasa.gov{url}"

        # Fallback: construct wp-content URL from the date embedded in the filename
        date_match = re.search(r'(\d{4})_(\d{2})_\d{2}', latest)
        if date_match:
            year, month = date_match.group(1), date_match.group(2)
            return f"{_NASA_WP_BASE}/{year}/{month}/{latest}"

    except Exception as e:
        logger.debug(f"Could not discover OEM URL from page: {e}")
    return None


async def _fetch_oem_file(url: str, client: httpx.AsyncClient) -> Optional[str]:
    """Download an OEM .asc file and return its text content."""
    try:
        resp = await client.get(
            url,
            headers={"User-Agent": "ArtemisTracker/1.0 (+https://github.com/yorihito/artemis)"},
            follow_redirects=True,
            timeout=30.0,
        )
        if resp.status_code == 200 and resp.text.strip():
            return resp.text
        logger.debug(f"OEM fetch {url} returned {resp.status_code}")
    except Exception as e:
        logger.debug(f"OEM fetch {url} failed: {e}")
    return None


async def fetch_latest_oem() -> Optional[List[Tuple[datetime, Vector3D, Vector3D]]]:
    """
    Fetch and parse the latest NASA OEM file.

    Returns a list of (timestamp, position_km, velocity_kms) tuples in
    EME2000/J2000 Earth-centered frame, sorted chronologically.
    Returns None if no OEM file could be fetched.

    Results are cached for up to 1 hour.
    """
    global _cached_url, _cached_vectors, _cache_fetched_at

    now = datetime.now(timezone.utc)

    # Return cache if fresh
    if (
        _cached_vectors is not None
        and _cache_fetched_at is not None
        and (now - _cache_fetched_at).total_seconds() < _CACHE_TTL_SECONDS
    ):
        logger.debug("OEM: returning cached vectors")
        return _cached_vectors

    async with httpx.AsyncClient() as client:
        # 1. Try to discover URL from the NASA page
        discovered_url = await _discover_oem_url_from_page(client)
        candidates = []
        if discovered_url:
            candidates.append(discovered_url)
        # 2. Add pattern-based fallback candidates
        candidates.extend(_candidate_urls(now))

        # Deduplicate while preserving order
        seen = set()
        ordered = []
        for u in candidates:
            if u not in seen:
                seen.add(u)
                ordered.append(u)

        for url in ordered:
            text = await _fetch_oem_file(url, client)
            if text is None:
                continue

            # Quick sanity check
            if "META_STOP" not in text and "CCSDS_OEM" not in text:
                logger.debug(f"OEM: {url} does not look like a valid OEM file")
                continue

            vectors = _parse_oem_text(text)
            if not vectors:
                logger.warning(f"OEM: parsed 0 vectors from {url}")
                continue

            vectors.sort(key=lambda t: t[0])
            _cached_url = url
            _cached_vectors = vectors
            _cache_fetched_at = now
            logger.info(
                f"OEM: loaded {len(vectors)} vectors from {url} "
                f"({vectors[0][0].isoformat()} → {vectors[-1][0].isoformat()})"
            )
            return vectors

    logger.warning("OEM: could not fetch any OEM file")
    return None


async def fetch_current_state() -> Optional[OEMRawData]:
    """
    Fetch the OEM file and return the state vector closest to (but not after) now.
    Returns None if no OEM data is available.
    """
    vectors = await fetch_latest_oem()
    if not vectors:
        return None

    now = datetime.now(timezone.utc)

    # Find the last vector whose timestamp ≤ now
    best: Optional[Tuple[datetime, Vector3D, Vector3D]] = None
    for ts, pos, vel in vectors:
        if ts <= now:
            best = (ts, pos, vel)
        else:
            break

    if best is None:
        # All vectors are in the future — pick earliest
        best = vectors[0]

    ts, pos, vel = best
    logger.info(f"OEM: current state at {ts.isoformat()} (age={(now - ts).total_seconds()/60:.1f} min)")
    return OEMRawData(timestamp=ts, position=pos, velocity=vel)


def get_cached_oem_url() -> Optional[str]:
    """Return the URL of the last successfully fetched OEM file (for status display)."""
    return _cached_url


def get_cached_oem_age_minutes() -> Optional[float]:
    """Return how many minutes ago the OEM cache was last refreshed."""
    if _cache_fetched_at is None:
        return None
    return (datetime.now(timezone.utc) - _cache_fetched_at).total_seconds() / 60
