import { cuid } from '../util/id.js';
import { nowIso, toLocalDate } from '../util/tz.js';
import { type Ctx, ServiceError } from './types.js';

export type DialysisSession = {
  id: string;
  ts: string;
  date: string;
  modality: string;
  duration_min: number | null;
  location: string | null;
  access_type: string | null;
  access_site: string | null;
  access_notes: string | null;
  pre_weight_kg: number | null;
  post_weight_kg: number | null;
  dry_weight_kg: number | null;
  ultrafiltration_ml: number | null;
  complications: string | null;
  symptoms: string | null;
  complication_notes: string | null;
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

export const logDialysis = (
  ctx: Ctx,
  args: {
    modality: string;
    duration_min?: number;
    location?: string;
    access_type?: string;
    access_site?: string;
    access_notes?: string;
    pre_weight_kg?: number;
    post_weight_kg?: number;
    dry_weight_kg?: number;
    ultrafiltration_ml?: number;
    complications?: string[];
    symptoms?: string[];
    complication_notes?: string;
    ts?: string;
    notes?: string;
  },
): DialysisSession => {
  const ts = args.ts ?? nowIso();
  const id = cuid();
  ctx.db
    .prepare(
      `INSERT INTO dialysis_sessions (id, ts, date, modality, duration_min, location,
        access_type, access_site, access_notes, pre_weight_kg, post_weight_kg,
        dry_weight_kg, ultrafiltration_ml, complications, symptoms, complication_notes, notes)
       VALUES (@id, @ts, @date, @modality, @duration_min, @location,
        @access_type, @access_site, @access_notes, @pre_weight_kg, @post_weight_kg,
        @dry_weight_kg, @ultrafiltration_ml, @complications, @symptoms, @complication_notes, @notes)`,
    )
    .run({
      id,
      ts,
      date: toLocalDate(ts, ctx.config.tz),
      modality: args.modality,
      duration_min: args.duration_min ?? null,
      location: args.location ?? null,
      access_type: args.access_type ?? null,
      access_site: args.access_site ?? null,
      access_notes: args.access_notes ?? null,
      pre_weight_kg: args.pre_weight_kg ?? null,
      post_weight_kg: args.post_weight_kg ?? null,
      dry_weight_kg: args.dry_weight_kg ?? null,
      ultrafiltration_ml: args.ultrafiltration_ml ?? null,
      complications: args.complications ? JSON.stringify(args.complications) : null,
      symptoms: args.symptoms ? JSON.stringify(args.symptoms) : null,
      complication_notes: args.complication_notes ?? null,
      notes: args.notes ?? null,
    });
  return ctx.db.prepare('SELECT * FROM dialysis_sessions WHERE id = ?').get(id) as DialysisSession;
};

export const listDialysis = (ctx: Ctx, args: DateRangeArgs): DialysisSession[] =>
  listByDateOrTsRange<DialysisSession>(ctx, 'dialysis_sessions', args);

export const getDialysis = (ctx: Ctx, id: string): DialysisSession => {
  const row = ctx.db.prepare('SELECT * FROM dialysis_sessions WHERE id = ?').get(id) as
    | DialysisSession
    | undefined;
  if (!row) {
    throw new ServiceError('dialysis_not_found', `dialysis session ${id} not found`, 404);
  }
  return row;
};

export const updateDialysis = (
  ctx: Ctx,
  args: {
    id: string;
    modality?: string;
    duration_min?: number | null;
    location?: string | null;
    access_type?: string | null;
    access_site?: string | null;
    access_notes?: string | null;
    pre_weight_kg?: number | null;
    post_weight_kg?: number | null;
    dry_weight_kg?: number | null;
    ultrafiltration_ml?: number | null;
    complications?: string[] | null;
    symptoms?: string[] | null;
    complication_notes?: string | null;
    notes?: string | null;
  },
): DialysisSession => {
  const existing = getDialysis(ctx, args.id);
  const sets: string[] = [];
  const params: Record<string, unknown> = { id: args.id };

  const setField = (col: string, val: unknown) => {
    sets.push(`${col} = @${col}`);
    params[col] = val;
  };

  if (args.modality !== undefined) setField('modality', args.modality);
  if (args.duration_min !== undefined) setField('duration_min', args.duration_min);
  if (args.location !== undefined) setField('location', args.location);
  if (args.access_type !== undefined) setField('access_type', args.access_type);
  if (args.access_site !== undefined) setField('access_site', args.access_site);
  if (args.access_notes !== undefined) setField('access_notes', args.access_notes);
  if (args.pre_weight_kg !== undefined) setField('pre_weight_kg', args.pre_weight_kg);
  if (args.post_weight_kg !== undefined) setField('post_weight_kg', args.post_weight_kg);
  if (args.dry_weight_kg !== undefined) setField('dry_weight_kg', args.dry_weight_kg);
  if (args.ultrafiltration_ml !== undefined) setField('ultrafiltration_ml', args.ultrafiltration_ml);
  if (args.complications !== undefined)
    setField('complications', args.complications ? JSON.stringify(args.complications) : null);
  if (args.symptoms !== undefined)
    setField('symptoms', args.symptoms ? JSON.stringify(args.symptoms) : null);
  if (args.complication_notes !== undefined) setField('complication_notes', args.complication_notes);
  if (args.notes !== undefined) setField('notes', args.notes);

  if (sets.length === 0) return existing;
  ctx.db
    .prepare(`UPDATE dialysis_sessions SET ${sets.join(', ')} WHERE id = @id`)
    .run(params);
  return getDialysis(ctx, args.id);
};

export const deleteDialysis = (ctx: Ctx, id: string): { id: string } => {
  const r = ctx.db.prepare('DELETE FROM dialysis_sessions WHERE id = ?').run(id);
  if (r.changes === 0) {
    throw new ServiceError('dialysis_not_found', `dialysis session ${id} not found`, 404);
  }
  return { id };
};
