import { cuid } from '../util/id.js';
import { nowIso, toLocalDate } from '../util/tz.js';
import { type Ctx, ServiceError } from './types.js';

export type DiaryEntry = {
  id: string;
  ts: string;
  date: string;
  mood: number | null;
  energy: number | null;
  sleep_quality: number | null;
  appetite: number | null;
  symptoms: string | null;
  tags: string | null;
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

export const logDiary = (
  ctx: Ctx,
  args: {
    mood?: number;
    energy?: number;
    sleep_quality?: number;
    appetite?: number;
    symptoms?: string[];
    tags?: string[];
    ts?: string;
    notes?: string;
  },
): DiaryEntry => {
  const ts = args.ts ?? nowIso();
  const id = cuid();
  ctx.db
    .prepare(
      `INSERT INTO diary_entries (id, ts, date, mood, energy, sleep_quality, appetite, symptoms, tags, notes)
       VALUES (@id, @ts, @date, @mood, @energy, @sleep_quality, @appetite, @symptoms, @tags, @notes)`,
    )
    .run({
      id,
      ts,
      date: toLocalDate(ts, ctx.config.tz),
      mood: args.mood ?? null,
      energy: args.energy ?? null,
      sleep_quality: args.sleep_quality ?? null,
      appetite: args.appetite ?? null,
      symptoms: args.symptoms ? JSON.stringify(args.symptoms) : null,
      tags: args.tags ? JSON.stringify(args.tags) : null,
      notes: args.notes ?? null,
    });
  return ctx.db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(id) as DiaryEntry;
};

export const listDiary = (ctx: Ctx, args: DateRangeArgs): DiaryEntry[] =>
  listByDateOrTsRange<DiaryEntry>(ctx, 'diary_entries', args);

export const deleteDiary = (ctx: Ctx, id: string): { id: string } => {
  const r = ctx.db.prepare('DELETE FROM diary_entries WHERE id = ?').run(id);
  if (r.changes === 0) {
    throw new ServiceError('diary_not_found', `diary entry ${id} not found`, 404);
  }
  return { id };
};
