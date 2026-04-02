import json
from pathlib import Path
from datetime import datetime, timezone
from typing import List

from app.models.mission import MissionEvent, EventStatus, EventsResponse
from dateutil.parser import parse as parse_dt


def _load_events() -> List[dict]:
    data_path = Path(__file__).parent.parent.parent / "data" / "mission_events.json"
    with open(data_path, "r") as f:
        raw = json.load(f)
    return raw["events"]


def get_events() -> EventsResponse:
    now = datetime.now(timezone.utc)
    raw_events = _load_events()
    events: List[MissionEvent] = []

    for raw in raw_events:
        planned = parse_dt(raw["planned_time"])
        actual = parse_dt(raw["actual_time"]) if raw.get("actual_time") else None

        if actual is not None:
            status = EventStatus.completed
        elif planned <= now:
            # Planned time passed but no actual time recorded — treat as completed
            status = EventStatus.completed
        else:
            # Check if this is the "next" event (first upcoming)
            status = EventStatus.upcoming

        events.append(
            MissionEvent(
                event_id=raw["event_id"],
                name=raw["name"],
                planned_time=planned,
                actual_time=actual,
                status=status,
                description=raw.get("description"),
            )
        )

    # Mark the first upcoming event as in_progress
    first_upcoming = next((e for e in events if e.status == EventStatus.upcoming), None)
    if first_upcoming:
        idx = events.index(first_upcoming)
        events[idx] = MissionEvent(
            **{**first_upcoming.model_dump(), "status": EventStatus.in_progress}
        )

    return EventsResponse(events=events)
