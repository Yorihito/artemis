export const MISSION_NAME = "Artemis II";
export const LAUNCH_EPOCH = new Date("2026-04-01T22:35:12Z");
export const EARTH_RADIUS_KM = 6371;
export const MOON_RADIUS_KM = 1737;
export const EARTH_MOON_DISTANCE_KM = 384_400;

export interface RefreshOption {
  label: string;
  value: number; // ms, 0 = manual
  approachOnly: boolean;
}

export const REFRESH_INTERVALS: RefreshOption[] = [
  { label: "5秒", value: 5_000, approachOnly: true },
  { label: "10秒", value: 10_000, approachOnly: true },
  { label: "30秒", value: 30_000, approachOnly: false },
  { label: "1分", value: 60_000, approachOnly: false },
  { label: "5分", value: 300_000, approachOnly: false },
  { label: "10分", value: 600_000, approachOnly: false },
  { label: "30分", value: 1_800_000, approachOnly: false },
  { label: "手動", value: 0, approachOnly: false },
];

export const DEFAULT_REFRESH_INTERVAL_MS = 1_800_000; // 30 min (cruise)
export const APPROACH_REFRESH_INTERVAL_MS = 60_000;   // 1 min (approaching)
