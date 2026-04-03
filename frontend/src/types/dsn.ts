export interface DSNSignalInfo {
  active: boolean;
  band: string;
  data_rate_bps: number;
  power_dbm: number;
  signal_type: string;
}

export interface DSNDish {
  dish_name: string;
  complex_id: string;
  complex_name: string;
  location: string;
  flag: string;
  azimuth_deg: number;
  elevation_deg: number;
  rtlt_sec: number;
  range_km: number;
  activity: string;
  down_signal: DSNSignalInfo | null;
  up_signal: DSNSignalInfo | null;
  has_active_signal: boolean;
}

export interface ComplexStatus {
  complex_id: string;
  complex_name: string;
  flag: string;
  is_tracking: boolean;
  dish_count: number;
}

export interface DSNStatus {
  is_tracking: boolean;
  dishes: DSNDish[];
  primary_dish: DSNDish | null;
  complexes: ComplexStatus[];
  fetched_at: string;
  dsn_timestamp_ms: number | null;
}
