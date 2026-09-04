import type { Migration } from '../migrations.js';

// Add zepp_heart_rate table for watch-side push ingestion
const sql = `
CREATE TABLE IF NOT EXISTS zepp_heart_rate (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  date TEXT NOT NULL,
  heart_rate INTEGER NOT NULL,
  resting_hr REAL,
  hr_min REAL,
  hr_max REAL,
  raw_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS zepp_heart_rate_date_idx ON zepp_heart_rate(date);
CREATE INDEX IF NOT EXISTS zepp_heart_rate_ts_idx ON zepp_heart_rate(ts);
`;

export const migration0022: Migration = { id: '0022-zepp-heart-rate-table', sql };
