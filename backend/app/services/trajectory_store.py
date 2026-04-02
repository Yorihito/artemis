"""
Azure Table Storage persistence for trajectory points.
Table: "trajectory"
  PartitionKey: "points"
  RowKey: ISO timestamp (sorts lexicographically = chronologically)
  Columns: x, y, z (float)
Falls back to no-op if AZURE_STORAGE_CONNECTION_STRING is not set.
"""
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from app.models.mission import TrajectoryPoint

logger = logging.getLogger(__name__)

_PARTITION = "points"


class TrajectoryStore:
    def __init__(self):
        self._client = self._init_client()

    def _init_client(self):
        conn_str = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
        if not conn_str:
            logger.warning("TrajectoryStore: no connection string, persistence disabled")
            return None
        try:
            from azure.data.tables import TableClient
            client = TableClient.from_connection_string(conn_str, table_name="trajectory")
            logger.info("TrajectoryStore: Azure Table Storage initialized")
            return client
        except Exception as e:
            logger.warning(f"TrajectoryStore: init failed ({e}), persistence disabled")
            return None

    def load_all(self) -> list[TrajectoryPoint]:
        """Load all stored points, sorted chronologically."""
        if self._client is None:
            return []
        try:
            entities = self._client.list_entities(
                select=["RowKey", "x", "y", "z"]
            )
            points = []
            for e in entities:
                ts = datetime.fromisoformat(e["RowKey"].replace("Z", "+00:00"))
                points.append(TrajectoryPoint(
                    timestamp=ts,
                    x=float(e["x"]),
                    y=float(e["y"]),
                    z=float(e["z"]),
                ))
            points.sort(key=lambda p: p.timestamp)
            logger.info(f"TrajectoryStore: loaded {len(points)} points from Table Storage")
            return points
        except Exception as e:
            logger.warning(f"TrajectoryStore: load failed ({e})")
            return []

    def latest_timestamp(self) -> Optional[datetime]:
        """Return the timestamp of the most recently stored point."""
        if self._client is None:
            return None
        try:
            # RowKeys sort lexicographically = chronologically for ISO format.
            # List all and take max (Table Storage doesn't support ORDER BY DESC + TOP 1 easily).
            entities = list(self._client.list_entities(select=["RowKey"]))
            if not entities:
                return None
            latest_key = max(e["RowKey"] for e in entities)
            return datetime.fromisoformat(latest_key.replace("Z", "+00:00"))
        except Exception as e:
            logger.warning(f"TrajectoryStore: latest_timestamp failed ({e})")
            return None

    def save(self, point: TrajectoryPoint) -> None:
        """Upsert a single trajectory point."""
        if self._client is None:
            return
        try:
            row_key = point.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ")
            self._client.upsert_entity({
                "PartitionKey": _PARTITION,
                "RowKey": row_key,
                "x": point.x,
                "y": point.y,
                "z": point.z,
            })
        except Exception as e:
            logger.warning(f"TrajectoryStore: save failed ({e})")

    def save_batch(self, points: list[TrajectoryPoint]) -> None:
        """Save multiple points efficiently."""
        for point in points:
            self.save(point)
        if points:
            logger.info(f"TrajectoryStore: saved {len(points)} points")


trajectory_store = TrajectoryStore()
