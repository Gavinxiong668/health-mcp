import { cuid } from '../util/id.js';
import { type Ctx, ServiceError } from './types.js';

export type MealPlanEntry = {
  id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipe_id: string | null;
  name: string;
  servings: number;
  notes: string | null;
  status: 'planned' | 'consumed' | 'skipped';
  created_at: string;
};

type ListArgs = { start?: string; end?: string };

export const listMealPlanEntries = (ctx: Ctx, args: ListArgs): MealPlanEntry[] => {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (args.start) {
    conds.push('date >= ?');
    params.push(args.start);
  }
  if (args.end) {
    conds.push('date <= ?');
    params.push(args.end);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return ctx.db
    .prepare(`SELECT * FROM meal_plan_entries ${where} ORDER BY date ASC, meal_type ASC`)
    .all(...params) as MealPlanEntry[];
};

export const getMealPlanEntry = (ctx: Ctx, id: string): MealPlanEntry => {
  const row = ctx.db.prepare('SELECT * FROM meal_plan_entries WHERE id = ?').get(id) as
    | MealPlanEntry
    | undefined;
  if (!row) {
    throw new ServiceError('meal_plan_not_found', `meal plan entry ${id} not found`, 404);
  }
  return row;
};

export const createMealPlanEntry = (
  ctx: Ctx,
  args: {
    date: string;
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    recipe_id?: string | null;
    name: string;
    servings?: number;
    notes?: string | null;
  },
): MealPlanEntry => {
  const id = cuid();
  ctx.db
    .prepare(
      `INSERT INTO meal_plan_entries (id, date, meal_type, recipe_id, name, servings, notes)
       VALUES (@id, @date, @meal_type, @recipe_id, @name, @servings, @notes)`,
    )
    .run({
      id,
      date: args.date,
      meal_type: args.meal_type,
      recipe_id: args.recipe_id ?? null,
      name: args.name,
      servings: args.servings ?? 1,
      notes: args.notes ?? null,
    });
  return getMealPlanEntry(ctx, id);
};

export const updateMealPlanEntry = (
  ctx: Ctx,
  args: {
    id: string;
    recipe_id?: string | null;
    name?: string;
    servings?: number;
    notes?: string | null;
    status?: 'planned' | 'consumed' | 'skipped';
  },
): MealPlanEntry => {
  const existing = getMealPlanEntry(ctx, args.id);
  ctx.db
    .prepare(
      `UPDATE meal_plan_entries
       SET recipe_id = @recipe_id, name = @name, servings = @servings, notes = @notes, status = @status
       WHERE id = @id`,
    )
    .run({
      id: args.id,
      recipe_id: args.recipe_id !== undefined ? (args.recipe_id ?? null) : existing.recipe_id,
      name: args.name ?? existing.name,
      servings: args.servings ?? existing.servings,
      notes: args.notes !== undefined ? (args.notes ?? null) : existing.notes,
      status: args.status ?? existing.status,
    });
  return getMealPlanEntry(ctx, args.id);
};

export const deleteMealPlanEntry = (ctx: Ctx, id: string): { id: string } => {
  const r = ctx.db.prepare('DELETE FROM meal_plan_entries WHERE id = ?').run(id);
  if (r.changes === 0) {
    throw new ServiceError('meal_plan_not_found', `meal plan entry ${id} not found`, 404);
  }
  return { id };
};
