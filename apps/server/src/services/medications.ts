import { cuid } from '../util/id.js';
import { nowIso, toLocalDate } from '../util/tz.js';
import { type Ctx, ServiceError } from './types.js';

export type Medication = {
  id: string;
  name: string;
  category: string | null;
  dose_amount: number | null;
  dose_unit: string | null;
  frequency: string | null;
  time_of_day: string | null;
  start_date: string | null;
  end_date: string | null;
  prescriber: string | null;
  indication: string | null;
  notes: string | null;
  active: number;
  created_at: string;
};

export type MedicationLogEntry = {
  id: string;
  medication_id: string;
  ts: string;
  date: string;
  dose_amount: number | null;
  dose_unit: string | null;
  taken: number;
  skipped: number;
  notes: string | null;
  created_at: string;
};

type DateRangeArgs = { date?: string; start?: string; end?: string; limit?: number };

export const createMedication = (
  ctx: Ctx,
  args: {
    name: string;
    category?: string;
    dose_amount?: number;
    dose_unit?: string;
    frequency?: string;
    time_of_day?: string[];
    start_date?: string;
    end_date?: string;
    prescriber?: string;
    indication?: string;
    notes?: string;
  },
): Medication => {
  const id = cuid();
  ctx.db
    .prepare(
      `INSERT INTO medications (id, name, category, dose_amount, dose_unit, frequency, time_of_day, start_date, end_date, prescriber, indication, notes)
       VALUES (@id, @name, @category, @dose_amount, @dose_unit, @frequency, @time_of_day, @start_date, @end_date, @prescriber, @indication, @notes)`,
    )
    .run({
      id,
      name: args.name,
      category: args.category ?? null,
      dose_amount: args.dose_amount ?? null,
      dose_unit: args.dose_unit ?? null,
      frequency: args.frequency ?? null,
      time_of_day: args.time_of_day ? JSON.stringify(args.time_of_day) : null,
      start_date: args.start_date ?? null,
      end_date: args.end_date ?? null,
      prescriber: args.prescriber ?? null,
      indication: args.indication ?? null,
      notes: args.notes ?? null,
    });
  return ctx.db.prepare('SELECT * FROM medications WHERE id = ?').get(id) as Medication;
};

export const listMedications = (ctx: Ctx, args: { active_only?: boolean } = {}): Medication[] => {
  const where = args.active_only ? 'WHERE active = 1' : '';
  return ctx.db
    .prepare(`SELECT * FROM medications ${where} ORDER BY created_at DESC LIMIT 200`)
    .all() as Medication[];
};

export const getMedication = (ctx: Ctx, id: string): Medication => {
  const row = ctx.db.prepare('SELECT * FROM medications WHERE id = ?').get(id) as Medication | undefined;
  if (!row) {
    throw new ServiceError('medication_not_found', `medication ${id} not found`, 404);
  }
  return row;
};

export const updateMedication = (
  ctx: Ctx,
  args: {
    id: string;
    name?: string;
    category?: string | null;
    dose_amount?: number | null;
    dose_unit?: string | null;
    frequency?: string | null;
    time_of_day?: string[] | null;
    start_date?: string | null;
    end_date?: string | null;
    prescriber?: string | null;
    indication?: string | null;
    notes?: string | null;
    active?: boolean;
  },
): Medication => {
  const existing = getMedication(ctx, args.id);
  const sets: string[] = [];
  const params: Record<string, unknown> = { id: args.id };

  const setField = (col: string, val: unknown) => {
    sets.push(`${col} = @${col}`);
    params[col] = val;
  };

  if (args.name !== undefined) setField('name', args.name);
  if (args.category !== undefined) setField('category', args.category);
  if (args.dose_amount !== undefined) setField('dose_amount', args.dose_amount);
  if (args.dose_unit !== undefined) setField('dose_unit', args.dose_unit);
  if (args.frequency !== undefined) setField('frequency', args.frequency);
  if (args.time_of_day !== undefined)
    setField('time_of_day', args.time_of_day ? JSON.stringify(args.time_of_day) : null);
  if (args.start_date !== undefined) setField('start_date', args.start_date);
  if (args.end_date !== undefined) setField('end_date', args.end_date);
  if (args.prescriber !== undefined) setField('prescriber', args.prescriber);
  if (args.indication !== undefined) setField('indication', args.indication);
  if (args.notes !== undefined) setField('notes', args.notes);
  if (args.active !== undefined) setField('active', args.active ? 1 : 0);

  if (sets.length === 0) return existing;
  ctx.db.prepare(`UPDATE medications SET ${sets.join(', ')} WHERE id = @id`).run(params);
  return getMedication(ctx, args.id);
};

export const deleteMedication = (ctx: Ctx, id: string): { id: string } => {
  const r = ctx.db.prepare('DELETE FROM medications WHERE id = ?').run(id);
  if (r.changes === 0) {
    throw new ServiceError('medication_not_found', `medication ${id} not found`, 404);
  }
  return { id };
};

export const logMedicationDose = (
  ctx: Ctx,
  args: {
    medication_id: string;
    dose_amount?: number;
    dose_unit?: string;
    taken?: boolean;
    skipped?: boolean;
    ts?: string;
    notes?: string;
  },
): MedicationLogEntry => {
  // Verify medication exists
  getMedication(ctx, args.medication_id);
  const ts = args.ts ?? nowIso();
  const id = cuid();
  const taken = args.skipped ? 0 : 1;
  const skipped = args.skipped ? 1 : 0;
  ctx.db
    .prepare(
      `INSERT INTO medication_log (id, medication_id, ts, date, dose_amount, dose_unit, taken, skipped, notes)
       VALUES (@id, @medication_id, @ts, @date, @dose_amount, @dose_unit, @taken, @skipped, @notes)`,
    )
    .run({
      id,
      medication_id: args.medication_id,
      ts,
      date: toLocalDate(ts, ctx.config.tz),
      dose_amount: args.dose_amount ?? null,
      dose_unit: args.dose_unit ?? null,
      taken,
      skipped,
      notes: args.notes ?? null,
    });
  return ctx.db
    .prepare('SELECT * FROM medication_log WHERE id = ?')
    .get(id) as MedicationLogEntry;
};

export const listMedicationLog = (
  ctx: Ctx,
  args: DateRangeArgs & { medication_id?: string },
): MedicationLogEntry[] => {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (args.medication_id) {
    conds.push('medication_id = ?');
    params.push(args.medication_id);
  }
  if (args.date) { conds.push('date = ?'); params.push(args.date); }
  if (args.start) { conds.push('ts >= ?'); params.push(args.start); }
  if (args.end) { conds.push('ts <= ?'); params.push(args.end); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  params.push(args.limit ?? 200);
  return ctx.db
    .prepare(`SELECT * FROM medication_log ${where} ORDER BY ts DESC LIMIT ?`)
    .all(...params) as MedicationLogEntry[];
};
