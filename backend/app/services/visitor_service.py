"""
Visitor tracking backed by Azure Table Storage.
Falls back to in-memory if AZURE_STORAGE_CONNECTION_STRING is not set.

Table schema (table name: "visitors"):
  PartitionKey="session", RowKey=<session_id>  — one row per unique visitor
  PartitionKey="stats",   RowKey="counters"    — {total_visits: int}
"""
import logging
import os
import threading
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

_PARTITION_SESSION = "session"
_PARTITION_STATS = "stats"
_ROW_COUNTERS = "counters"


class VisitorService:
    def __init__(self):
        self._lock = threading.Lock()
        self._since: datetime = datetime.now(timezone.utc)
        self._client = self._init_table_client()

        # In-memory fallback counters (used when Table Storage unavailable)
        self._mem_unique: set[str] = set()
        self._mem_total: int = 0

    def _init_table_client(self):
        conn_str = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
        if not conn_str:
            logger.warning("AZURE_STORAGE_CONNECTION_STRING not set — using in-memory visitor tracking")
            return None
        try:
            from azure.data.tables import TableClient
            client = TableClient.from_connection_string(conn_str, table_name="visitors")
            logger.info("Visitor tracking: Azure Table Storage initialized")
            return client
        except Exception as e:
            logger.warning(f"Visitor tracking: Table Storage init failed ({e}) — using in-memory")
            return None

    def record(self, session_id: str) -> None:
        with self._lock:
            if self._client is None:
                self._mem_unique.add(session_id)
                self._mem_total += 1
                return
            self._record_table(session_id)

    def _record_table(self, session_id: str) -> None:
        try:
            # Try to insert the session row (fails silently if already exists)
            is_new = False
            try:
                self._client.create_entity({
                    "PartitionKey": _PARTITION_SESSION,
                    "RowKey": session_id,
                    "first_visit": datetime.now(timezone.utc).isoformat(),
                })
                is_new = True
            except Exception:
                pass  # Already exists → returning visitor

            # Increment total_visits (and unique_visitors if new)
            try:
                entity = self._client.get_entity(_PARTITION_STATS, _ROW_COUNTERS)
                total = int(entity.get("total_visits", 0)) + 1
                unique = int(entity.get("unique_visitors", 0)) + (1 if is_new else 0)
                self._client.update_entity({
                    "PartitionKey": _PARTITION_STATS,
                    "RowKey": _ROW_COUNTERS,
                    "total_visits": total,
                    "unique_visitors": unique,
                }, mode="replace")
            except Exception:
                # Row doesn't exist yet — create it
                self._client.create_entity({
                    "PartitionKey": _PARTITION_STATS,
                    "RowKey": _ROW_COUNTERS,
                    "total_visits": 1,
                    "unique_visitors": 1 if is_new else 0,
                })
        except Exception as e:
            logger.warning(f"Visitor record error: {e}")
            # Fallback to in-memory
            self._mem_unique.add(session_id)
            self._mem_total += 1

    def get_stats(self) -> dict:
        if self._client is None:
            return {
                "unique_visitors": len(self._mem_unique),
                "total_visits": self._mem_total,
            }
        try:
            entity = self._client.get_entity(_PARTITION_STATS, _ROW_COUNTERS)
            return {
                "unique_visitors": int(entity.get("unique_visitors", 0)),
                "total_visits": int(entity.get("total_visits", 0)),
            }
        except Exception:
            return {"unique_visitors": 0, "total_visits": 0}

    @property
    def since(self) -> datetime:
        return self._since


visitor_service = VisitorService()
