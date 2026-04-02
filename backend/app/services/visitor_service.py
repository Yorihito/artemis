"""Simple in-memory visitor tracking (resets on container restart)."""
import threading
from datetime import datetime, timezone


class VisitorService:
    def __init__(self):
        self._lock = threading.Lock()
        self._unique_ids: set[str] = set()
        self._total_visits: int = 0
        self._since: datetime = datetime.now(timezone.utc)

    def record(self, session_id: str) -> None:
        with self._lock:
            self._unique_ids.add(session_id)
            self._total_visits += 1

    @property
    def unique_visitors(self) -> int:
        return len(self._unique_ids)

    @property
    def total_visits(self) -> int:
        return self._total_visits

    @property
    def since(self) -> datetime:
        return self._since


visitor_service = VisitorService()
