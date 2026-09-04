import type { Migration } from '../migrations.js';

// Add meal_plan_entries table for weekly meal planning & tracking
const sql = `
CREATE TABLE meal_plan_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  servings REAL NOT NULL DEFAULT 1,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','consumed','skipped')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(date, meal_type)
);
CREATE INDEX meal_plan_date_idx ON meal_plan_entries(date);
`;

export const migration0023: Migration = { id: '0023-meal-plan', sql };
