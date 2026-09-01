import { cuid } from '../util/id.js';
import { nowIso, toLocalDate } from '../util/tz.js';
import { type Ctx, ServiceError } from './types.js';

export type BloodPressureEntry = {
  id: string;
  ts: string;
  date: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  position: string | null;
  arm: string | null;
  notes: string | null;
  created_at: string;
};

type DateRangeArgs = { date?: string; start?: string; end?: string; limit?: number };

const listByDateOrTsRange = <T>(
  ctx: Ctx,
  table: string,
  args: DateRangeArgs,
): T[] => {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (args.date) {
    conds.push('date = ?');
    params.push(args.date);
  }
  if (args.start) {
    conds.push('ts >= ?');
    params.push(args.start);
  }
  if (args.end) {
    conds.push('ts <= ?');
    params.push(args.end);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  params.push(args.limit ?? 200);
  return ctx.db
    .prepare(`SELECT * FROM ${table} ${where} ORDER BY ts DESC LIMIT ?`)
    .all(...params) as T[];
};

export const logBloodPressure = (
  ctx: Ctx,
  args: {
    systolic: number;
    diastolic: number;
    pulse?: number;
    position?: string;
    arm?: string;
    ts?: string;
    notes?: string;
  },
): BloodPressureEntry => {
  const ts = args.ts ?? nowIso();
  const id = cuid();
  ctx.db
    .prepare(
      `INSERT INTO blood_pressure_entries (id, ts, date, systolic, diastolic, pulse, position, arm, notes)
       VALUES (@id, @ts, @date, @systolic, @diastolic, @pulse, @position, @arm, @notes)`,
    )
    .run({
      id,
      ts,
      date: toLocalDate(ts, ctx.config.tz),
      systolic: args.systolic,
      diastolic: args.diastolic,
      pulse: args.pulse ?? null,
      position: args.position ?? null,
      arm: args.arm ?? null,
      notes: args.notes ?? null,
    });
  return ctx.db.prepare('SELECT * FROM blood_pressure_entries WHERE id = ?').get(id) as BloodPressureEntry;
};

export const listBloodPressure = (ctx: Ctx, args: DateRangeArgs): BloodPressureEntry[] =>
  listByDateOrTsRange<BloodPressureEntry>(ctx, 'blood_pressure_entries', args);

export const deleteBloodPressure = (ctx: Ctx, id: string): { id: string } => {
  const r = ctx.db.prepare('DELETE FROM blood_pressure_entries WHERE id = ?').run(id);
  if (r.changes === 0) {
    throw new ServiceError('blood_pressure_not_found', `blood pressure entry ${id} not found`, 404);
  }
  return { id };
};
