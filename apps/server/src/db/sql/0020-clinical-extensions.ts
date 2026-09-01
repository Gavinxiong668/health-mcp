import type { Migration } from '../migrations.js';

// Clinical extensions: adds 7 tables for blood pressure, dialysis, pain,
// medications, diary, and fluid output tracking.
const sql = `
CREATE TABLE blood_pressure_entries (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  date TEXT NOT NULL,
  systolic INTEGER NOT NULL CHECK (systolic BETWEEN 40 AND 300),
  diastolic INTEGER NOT NULL CHECK (diastolic BETWEEN 20 AND 200),
  pulse INTEGER CHECK (pulse BETWEEN 20 AND 250),
  position TEXT CHECK (position IN ('sitting','standing','lying')),
  arm TEXT CHECK (arm IN ('left','right')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE dialysis_sessions (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  date TEXT NOT NULL,
  modality TEXT NOT NULL CHECK (modality IN ('hemodialysis','peritoneal','hdf','hf','online_hdf')),
  duration_min INTEGER CHECK (duration_min > 0),
  location TEXT,
  access_type TEXT CHECK (access_type IN ('avf','avg','cvc','pd_catheter','other')),
  access_site TEXT,
  access_notes TEXT,
  pre_weight_kg REAL CHECK (pre_weight_kg > 0),
  post_weight_kg REAL CHECK (post_weight_kg > 0),
  dry_weight_kg REAL CHECK (dry_weight_kg > 0),
  ultrafiltration_ml REAL,
  complications TEXT,
  symptoms TEXT,
  complication_notes TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE pain_entries (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  date TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 10),
  location TEXT,
  type TEXT CHECK (type IN ('sharp','dull','aching','burning','throbbing','stabbing','tingling','other')),
  duration_min INTEGER,
  triggers TEXT,
  relief_methods TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE medications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('prescription','otc','supplement','vitamin','mineral','herbal','other')),
  dose_amount REAL,
  dose_unit TEXT,
  frequency TEXT,
  time_of_day TEXT,
  start_date TEXT,
  end_date TEXT,
  prescriber TEXT,
  indication TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE medication_log (
  id TEXT PRIMARY KEY,
  medication_id TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  ts TEXT NOT NULL,
  date TEXT NOT NULL,
  dose_amount REAL,
  dose_unit TEXT,
  taken INTEGER NOT NULL DEFAULT 1,
  skipped INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE diary_entries (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  date TEXT NOT NULL,
  mood INTEGER CHECK (mood BETWEEN 1 AND 5),
  energy INTEGER CHECK (energy BETWEEN 1 AND 5),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
  appetite INTEGER CHECK (appetite BETWEEN 1 AND 5),
  symptoms TEXT,
  tags TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE fluid_output_entries (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('urine','sweat','vomit','drain','stool','other')),
  ml INTEGER NOT NULL CHECK (ml > 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

export const migration0020: Migration = { id: '0020-clinical-extensions', sql };
