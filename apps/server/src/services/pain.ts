import { cuid } from '../util/id.js';
import { nowIso, toLocalDate } from '../util/tz.js';
import { type Ctx, ServiceError } from './types.js';

export type PainEntry = {
  id: string;
  ts: string;
  date: string;
  score: number;
  location: string | null;
  type: string | null;
  duration_min: number | null;
  triggers: string | null;
  relief_methods: string | null;
  notes: string | null;
  created_at: string;
};

type DateRangeArgs = { date?: string; start?: string; end?: string; limit?: number };

const listByDateOrTsRange = <T>(ctx: Ctx, table: string, args: DateRangeArgs): T[] => {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (args.date) { conds.push('date = ?'); params.push(args.date); }
  if (args.start) { conds.push('ts >= ?'); params.push(args.start); }
  if (args.end) { conds.push('ts <= ?'); params.push(args.end); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  params.push(args.limit ?? 200);
  return ctx.db
    .prepare(`SELECT * FROM ${table} ${where} ORDER BY ts DESC LIMIT ?`)
    .all(...params) as T[];
};

export const logPain = (
  ctx: Ctx,
  args: {
    score: number;
    location?: string;
    type?: string;
    duration_min?: number;
    triggers?: string[];
    relief_methods?: string[];
    ts?: string;
    notes?: string;
  },
): PainEntry => {
  const ts = args.ts ?? nowIso();
  const id = cuid();
  ctx.db
    .prepare(
      `INSERT INTO pain_entries (id, ts, date, score, location, type, duration_min, triggers, relief_methods, notes)
       VALUES (@id, @ts, @date, @score, @location, @type, @duration_min, @triggers, @relief_methods, @notes)`,
    )
    .run({
      id,
      ts,
      date: toLocalDate(ts, ctx.config.tz),
      score: args.score,
      location: args.location ?? null,
      type: args.type ?? null,
      duration_min: args.duration_min ?? null,
      triggers: args.triggers ? JSON.stringify(args.triggers) : null,
      relief_methods: args.relief_methods ? JSON.stringify(args.relief_methods) : null,
      notes: args.notes ?? null,
    });
  return ctx.db.prepare('SELECT * FROM pain_entries WHERE id = ?').get(id) as PainEntry;
};

export const listPain = (ctx: Ctx, args: DateRangeArgs): PainEntry[] =>
  listByDateOrTsRange<PainEntry>(ctx, 'pain_entries', args);

export const deletePain = (ctx: Ctx, id: string): { id: string } => {
  const r = ctx.db.prepare('DELETE FROM pain_entries WHERE id = ?').run(id);
  if (r.changes === 0) {
    throw new ServiceError('pain_not_found', `pain entry ${id} not found`, 404);
  }
  return { id };
};
