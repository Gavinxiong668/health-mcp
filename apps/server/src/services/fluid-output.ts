import { cuid } from '../util/id.js';
import { nowIso, toLocalDate } from '../util/tz.js';
import { type Ctx, ServiceError } from './types.js';

export type FluidOutputEntry = {
  id: string;
  ts: string;
  date: string;
  kind: string;
  ml: number;
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

export const logFluidOutput = (
  ctx: Ctx,
  args: { kind: string; ml: number; ts?: string; notes?: string },
): FluidOutputEntry => {
  const ts = args.ts ?? nowIso();
  const id = cuid();
  ctx.db
    .prepare(
      `INSERT INTO fluid_output_entries (id, ts, date, kind, ml, notes)
       VALUES (@id, @ts, @date, @kind, @ml, @notes)`,
    )
    .run({
      id,
      ts,
      date: toLocalDate(ts, ctx.config.tz),
      kind: args.kind,
      ml: args.ml,
      notes: args.notes ?? null,
    });
  return ctx.db.prepare('SELECT * FROM fluid_output_entries WHERE id = ?').get(id) as FluidOutputEntry;
};

export const listFluidOutput = (ctx: Ctx, args: DateRangeArgs): FluidOutputEntry[] =>
  listByDateOrTsRange<FluidOutputEntry>(ctx, 'fluid_output_entries', args);

export const deleteFluidOutput = (ctx: Ctx, id: string): { id: string } => {
  const r = ctx.db.prepare('DELETE FROM fluid_output_entries WHERE id = ?').run(id);
  if (r.changes === 0) {
    throw new ServiceError('fluid_output_not_found', `fluid output entry ${id} not found`, 404);
  }
  return { id };
};
