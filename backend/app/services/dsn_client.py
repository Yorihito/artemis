"""
Fetches and parses the NASA DSN Now real-time XML feed.
https://eyes.nasa.gov/dsn/data/dsn.xml  (updates every ~5s)

Artemis II / Orion appears as spacecraft="EM2", spacecraftID="-24".
"""
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.models.dsn import ComplexStatus, DSNDish, DSNSignalInfo, DSNStatus

logger = logging.getLogger(__name__)

SPACECRAFT_NAME = "EM2"
DSN_URL = "https://eyes.nasa.gov/dsn/data/dsn.xml"

COMPLEX_META = {
    "gdscc": {"name": "Goldstone", "location": "California, USA", "flag": "🇺🇸"},
    "mdscc": {"name": "Madrid",    "location": "Spain",           "flag": "🇪🇸"},
    "cdscc": {"name": "Canberra",  "location": "Australia",       "flag": "🇦🇺"},
}


def _safe_float(val: Optional[str], default: float = 0.0) -> float:
    try:
        return float(val) if val is not None else default
    except (ValueError, TypeError):
        return default


def _parse_signal(el: ET.Element) -> Optional[DSNSignalInfo]:
    if el.get("spacecraft") != SPACECRAFT_NAME:
        return None
    return DSNSignalInfo(
        active=el.get("active", "false").lower() == "true",
        band=el.get("band", ""),
        data_rate_bps=_safe_float(el.get("dataRate")),
        power_dbm=_safe_float(el.get("power")),
        signal_type=el.get("signalType", ""),
    )


def _parse_dsn_xml(text: str) -> DSNStatus:
    now = datetime.now(timezone.utc).isoformat()
    root = ET.fromstring(text)

    ts_el = root.find("timestamp")
    ts_ms = int(ts_el.text) if ts_el is not None and ts_el.text else None

    dishes: list[DSNDish] = []
    complex_dish_counts: dict[str, int] = {k: 0 for k in COMPLEX_META}

    for station in root.findall("station"):
        cid = station.get("name", "")
        meta = COMPLEX_META.get(cid, {"name": cid, "location": "", "flag": ""})

        for dish_el in station.findall("dish"):
            # Only process dishes that are pointed at EM2
            target_el = next(
                (t for t in dish_el.findall("target") if t.get("name") == SPACECRAFT_NAME),
                None,
            )
            if target_el is None:
                continue

            complex_dish_counts[cid] = complex_dish_counts.get(cid, 0) + 1

            down_sig = next(
                (s for s in (_parse_signal(el) for el in dish_el.findall("downSignal")) if s),
                None,
            )
            up_sig = next(
                (s for s in (_parse_signal(el) for el in dish_el.findall("upSignal")) if s),
                None,
            )

            has_active = (
                (down_sig is not None and down_sig.active)
                or (up_sig is not None and up_sig.active)
            )

            dishes.append(DSNDish(
                dish_name=dish_el.get("name", ""),
                complex_id=cid,
                complex_name=meta["name"],
                location=meta["location"],
                flag=meta["flag"],
                azimuth_deg=_safe_float(dish_el.get("azimuthAngle")),
                elevation_deg=_safe_float(dish_el.get("elevationAngle")),
                rtlt_sec=_safe_float(target_el.get("rtlt")),
                range_km=_safe_float(target_el.get("downlegRange")),
                activity=dish_el.get("activity", ""),
                down_signal=down_sig,
                up_signal=up_sig,
                has_active_signal=has_active,
            ))

    # Primary dish: prefer active signal, else first
    primary = next((d for d in dishes if d.has_active_signal), dishes[0] if dishes else None)

    complexes = [
        ComplexStatus(
            complex_id=cid,
            complex_name=COMPLEX_META[cid]["name"],
            flag=COMPLEX_META[cid]["flag"],
            is_tracking=complex_dish_counts.get(cid, 0) > 0,
            dish_count=complex_dish_counts.get(cid, 0),
        )
        for cid in ["gdscc", "mdscc", "cdscc"]
    ]

    return DSNStatus(
        is_tracking=len(dishes) > 0,
        dishes=dishes,
        primary_dish=primary,
        complexes=complexes,
        fetched_at=now,
        dsn_timestamp_ms=ts_ms,
    )


async def fetch_dsn_status() -> Optional[DSNStatus]:
    try:
        ts = int(datetime.now().timestamp())
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{DSN_URL}?r={ts}")
            r.raise_for_status()
        return _parse_dsn_xml(r.text)
    except Exception as exc:
        logger.warning("DSN fetch failed: %s", exc)
        return None


def mock_dsn_status() -> DSNStatus:
    """Mock data for USE_MOCK=true local dev."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    dish = DSNDish(
        dish_name="DSS-43",
        complex_id="cdscc",
        complex_name="Canberra",
        location="Australia",
        flag="🇦🇺",
        azimuth_deg=142.3,
        elevation_deg=23.1,
        rtlt_sec=2.34,
        range_km=350_432.0,
        activity="Spacecraft Telemetry, Tracking, and Command",
        down_signal=DSNSignalInfo(active=True, band="S", data_rate_bps=2000.0, power_dbm=-163.0, signal_type="data"),
        up_signal=DSNSignalInfo(active=True, band="S", data_rate_bps=500.0, power_dbm=20.0, signal_type="data"),
        has_active_signal=True,
    )
    return DSNStatus(
        is_tracking=True,
        dishes=[dish],
        primary_dish=dish,
        complexes=[
            ComplexStatus(complex_id="gdscc", complex_name="Goldstone", flag="🇺🇸", is_tracking=False, dish_count=0),
            ComplexStatus(complex_id="mdscc", complex_name="Madrid",    flag="🇪🇸", is_tracking=False, dish_count=0),
            ComplexStatus(complex_id="cdscc", complex_name="Canberra",  flag="🇦🇺", is_tracking=True,  dish_count=1),
        ],
        fetched_at=now,
        dsn_timestamp_ms=None,
    )
