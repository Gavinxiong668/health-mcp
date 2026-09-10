import type { Migration } from '../migrations.js';

// Add `draft` column to lab_results so incomplete entries can be saved.
// Also drops the CHECK constraint that required at least one value, since
// draft results may legitimately have both value_numeric and value_text as NULL.
const sql = `
CREATE TABLE lab_results_new (
  id TEXT PRIMARY KEY,
  biomarker_id TEXT NOT NULL REFERENCES biomarkers(id) ON DELETE CASCADE,
  panel_id TEXT REFERENCES lab_panels(id) ON DELETE SET NULL,
  taken_at TEXT NOT NULL,
  value_numeric REAL,
  value_text TEXT,
  unit_ucum TEXT NOT NULL,
  ref_low REAL,
  ref_high REAL,
  ref_text TEXT,
  interpretation TEXT,
  notes TEXT,
  draft INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO lab_results_new (id, biomarker_id, panel_id, taken_at, value_numeric, value_text, unit_ucum, ref_low, ref_high, ref_text, interpretation, notes, created_at)
SELECT id, biomarker_id, panel_id, taken_at, value_numeric, value_text, unit_ucum, ref_low, ref_high, ref_text, interpretation, notes, created_at
FROM lab_results;

DROP TABLE lab_results;
ALTER TABLE lab_results_new RENAME TO lab_results;

CREATE INDEX lab_results_biomarker_taken_idx ON lab_results(biomarker_id, taken_at);
CREATE INDEX lab_results_taken_idx ON lab_results(taken_at);
CREATE INDEX lab_results_panel_idx ON lab_results(panel_id);
`;

export const migration0027: Migration = { id: '0027-lab-draft-support', sql };
