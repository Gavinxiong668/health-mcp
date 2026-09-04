import type { Migration } from '../migrations.js';

// Zepp Health (华米) provider tables
const sql = `
CREATE TABLE zepp_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  user_id TEXT NOT NULL,
  nickname TEXT,
  gender TEXT,
  birthday TEXT,
  height_cm REAL,
  weight_kg REAL,
  raw_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE zepp_sleep (
  id TEXT PRIMARY KEY,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  date TEXT NOT NULL,
  duration_s INTEGER NOT NULL,
  efficiency REAL,
  light_sleep_s INTEGER,
  deep_sleep_s INTEGER,
  rem_sleep_s INTEGER,
  awake_s INTEGER,
  awake_count INTEGER,
  hr_avg REAL,
  hr_min REAL,
  hr_max REAL,
  breathing_quality REAL,
  mattress_type TEXT,
  raw_json TEXT NOT NULL
);
CREATE INDEX zepp_sleep_date_idx ON zepp_sleep(date);

CREATE TABLE zepp_daily_readiness (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  score INTEGER,
  hrv_rmssd REAL,
  resting_hr REAL,
  spo2 REAL,
  skin_temp REAL,
  sleep_quality REAL,
  stress_level REAL,
  raw_json TEXT NOT NULL
);
CREATE INDEX zepp_daily_readiness_date_idx ON zepp_daily_readiness(date);

CREATE TABLE zepp_daily_activity (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  steps INTEGER,
  active_calories INTEGER,
  total_calories INTEGER,
  distance_m INTEGER,
  floors INTEGER,
  active_time_min INTEGER,
  stand_hours INTEGER,
  hr_avg REAL,
  raw_json TEXT NOT NULL
);
CREATE INDEX zepp_daily_activity_date_idx ON zepp_daily_activity(date);

CREATE TABLE zepp_workout (
  id TEXT PRIMARY KEY,
  type TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration_s INTEGER NOT NULL,
  calories INTEGER,
  distance_m REAL,
  elevation_gain_m REAL,
  hr_avg REAL,
  hr_max REAL,
  pace_avg REAL,
  steps INTEGER,
  sport_type TEXT,
  raw_json TEXT NOT NULL
);
CREATE INDEX zepp_workout_date_idx ON zepp_workout(substr(start_time, 1, 10));

CREATE TABLE zepp_heart_rate (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  date TEXT NOT NULL,
  heart_rate INTEGER NOT NULL,
  resting_hr REAL,
  hr_min REAL,
  hr_max REAL,
  raw_json TEXT NOT NULL
);
CREATE INDEX zepp_heart_rate_date_idx ON zepp_heart_rate(date);
CREATE INDEX zepp_heart_rate_ts_idx ON zepp_heart_rate(ts);

-- Register Zepp as a wearable provider
INSERT INTO wearable_providers (id, display_name, auth_strategy)
VALUES ('zepp', 'Zepp Health (华米)', 'oauth2')
ON CONFLICT(id) DO NOTHING;
`;

export const migration0021: Migration = { id: '0021-zepp-wearable-provider', sql };
