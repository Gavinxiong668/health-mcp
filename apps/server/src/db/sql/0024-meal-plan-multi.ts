import type { Migration } from '../migrations.js';

// Remove UNIQUE(date, meal_type) from meal_plan_entries to allow
// multiple dishes per meal slot (e.g. lunch can have 2+ recipes).
const sql = `
CREATE TABLE meal_plan_entries_new (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  servings REAL NOT NULL DEFAULT 1,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','consumed','skipped')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO meal_plan_entries_new SELECT * FROM meal_plan_entries;
DROP TABLE meal_plan_entries;
ALTER TABLE meal_plan_entries_new RENAME TO meal_plan_entries;
CREATE INDEX meal_plan_date_idx ON meal_plan_entries(date);
`;

export const migration0024: Migration = { id: '0024-meal-plan-multi', sql };
