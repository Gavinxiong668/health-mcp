import type { Logger } from '../logger.js';
import type { Db } from './client.js';
import { migration0001 } from './sql/0001-init.js';
import { migration0010 } from './sql/0010-relax-meal-components-custom-check.js';
import { migration0011 } from './sql/0011-goal-tracking-and-nutrients.js';
import { migration0012 } from './sql/0012-food-micros-aliases-external-id.js';
import { migration0013 } from './sql/0013-weight-source-and-day-strain.js';
import { migration0014 } from './sql/0014-backfill-day-strain.js';
import { migration0015 } from './sql/0015-backfill-biomarker-ranges.js';
import { migration0020 } from './sql/0020-clinical-extensions.js';

export type Migration = {
  id: string;
  sql?: string;
  run?: (db: Db) => void;
};

const migrations: Migration[] = [
  migration0001,
  migration0010,
  migration0011,
  migration0012,
  migration0013,
  migration0014,
  migration0015,
  migration0020,
];

const ensureTable = (db: Db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
};

export const runMigrations = (db: Db, logger: Logger): { applied: string[] } => {
  ensureTable(db);
  const applied: string[] = [];
  const existing = db
    .prepare('SELECT id FROM _migrations')
    .all()
    .map((r) => (r as { id: string }).id);
  const done = new Set(existing);
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    const tx = db.transaction(() => {
      if (m.sql) db.exec(m.sql);
      if (m.run) m.run(db);
      db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(m.id);
    });
    tx();
    applied.push(m.id);
    logger.info('migration applied', { id: m.id });
  }
  return { applied };
};

export const listMigrations = (): string[] => migrations.map((m) => m.id);

export { migrations };
