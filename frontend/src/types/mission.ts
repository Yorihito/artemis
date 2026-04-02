export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type MissionPhase =
  | "Prelaunch"
  | "Ascent"
  | "EarthParkingOrbit"
  | "TranslunarInjection"
  | "TranslunarCoast"
  | "LunarFlyby"
  | "ReturnCoast"
  | "Reentry"
  | "Splashdown"
  | "Complete"
  | "Unknown";

export interface MissionCurrentResponse {
  mission: string;
  source: string;
  timestamp: string;
  phase: MissionPhase;
  phase_label: string;
  distance_from_earth_km: number;
  distance_from_moon_km: number;
  relative_velocity_kms: number;
  position: Vector3D;
  velocity: Vector3D;
  mission_elapsed_seconds: number;
  last_success_at: string | null;
  is_approaching: boolean;
  approach_type: "moon" | "earth" | null;
  moon_position?: Vector3D;  // Real Moon position from Horizons
}

export interface TrajectoryPoint {
  timestamp: string;
  x: number;
  y: number;
  z: number;
}

export interface TrajectoryResponse {
  mission: string;
  source: string;
  frame: string;
  points: TrajectoryPoint[];
}

export type EventStatus = "completed" | "in_progress" | "upcoming" | "unknown";

export interface MissionEvent {
  event_id: string;
  name: string;
  planned_time: string;
  actual_time: string | null;
  status: EventStatus;
  description?: string;
}

export interface EventsResponse {
  mission: string;
  events: MissionEvent[];
}

export interface SourceInfo {
  name: string;
  status: "ok" | "error" | "degraded" | "standby";
  last_success_at: string | null;
  consecutive_errors: number;
  latency_ms?: number;
}

export interface SystemStatusResponse {
  sources: SourceInfo[];
  cache: {
    status: string;
    trajectory_points: number;
    oldest_point_at: string | null;
    newest_point_at: string | null;
  };
  is_approaching: boolean;
  approach_type: "moon" | "earth" | null;
  poll_interval_seconds: number;
  uptime_seconds: number;
}
