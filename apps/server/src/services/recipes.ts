import { cuid } from '../util/id.js';
import {
  type Macros,
  accumulateMacros,
  emptyMacros,
  getFood,
  macrosForFoodGrams,
  scaleMacros,
} from './food.js';
import { logMeal } from './meals.js';
import { type Ctx, ServiceError } from './types.js';

export type Recipe = {
  id: string;
  name: string;
  servings: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeIngredient = {
  id: string;
  recipe_id: string;
  food_id: string | null;
  free_text_name: string | null;
  grams: number;
  notes: string | null;
};

type IngredientInput = {
  food_id?: string;
  free_text_name?: string;
  grams: number;
  notes?: string;
};

type RecipeMacros = Macros;

const insertIngredient = (ctx: Ctx, recipeId: string, ing: IngredientInput): RecipeIngredient => {
  if (Boolean(ing.food_id) === Boolean(ing.free_text_name)) {
    throw new ServiceError(
      'invalid_ingredient',
      'exactly one of food_id or free_text_name required',
      400,
    );
  }
  const id = cuid();
  ctx.db
    .prepare(
      'INSERT INTO recipe_ingredients (id, recipe_id, food_id, free_text_name, grams, notes) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      recipeId,
      ing.food_id ?? null,
      ing.free_text_name ?? null,
      ing.grams,
      ing.notes ?? null,
    );
  return ctx.db
    .prepare('SELECT * FROM recipe_ingredients WHERE id = ?')
    .get(id) as RecipeIngredient;
};

export const createRecipe = (
  ctx: Ctx,
  args: { name: string; servings: number; notes?: string; ingredients: IngredientInput[] },
): {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  total: RecipeMacros;
  per_serving: RecipeMacros;
} => {
  const id = cuid();
  const tx = ctx.db.transaction(() => {
    ctx.db
      .prepare('INSERT INTO recipes (id, name, servings, notes) VALUES (?, ?, ?, ?)')
      .run(id, args.name, args.servings, args.notes ?? null);
    for (const ing of args.ingredients) insertIngredient(ctx, id, ing);
  });
  tx();
  return getRecipe(ctx, id);
};

export const updateRecipe = (
  ctx: Ctx,
  args: {
    id: string;
    name?: string;
    servings?: number;
    notes?: string | null;
    ingredients?: IngredientInput[];
  },
): ReturnType<typeof getRecipe> => {
  const existing = ctx.db.prepare('SELECT * FROM recipes WHERE id = ?').get(args.id) as
    | Recipe
    | undefined;
  if (!existing) throw new ServiceError('recipe_not_found', `recipe ${args.id} not found`, 404);
  const tx = ctx.db.transaction(() => {
    ctx.db
      .prepare(
        `UPDATE recipes SET
          name = COALESCE(?, name),
          servings = COALESCE(?, servings),
          notes = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?`,
      )
      .run(
        args.name ?? null,
        args.servings ?? null,
        args.notes === undefined ? existing.notes : args.notes,
        args.id,
      );
    if (args.ingredients) {
      ctx.db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(args.id);
      for (const ing of args.ingredients) insertIngredient(ctx, args.id, ing);
    }
  });
  tx();
  return getRecipe(ctx, args.id);
};

export const deleteRecipe = (ctx: Ctx, id: string): { id: string } => {
  const r = ctx.db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  if (r.changes === 0) throw new ServiceError('recipe_not_found', `recipe ${id} not found`, 404);
  return { id };
};

export const listRecipes = (ctx: Ctx, args: { query?: string; limit?: number } = {}): Recipe[] => {
  const limit = args.limit ?? 50;
  if (args.query) {
    return ctx.db
      .prepare('SELECT * FROM recipes WHERE name LIKE ? COLLATE NOCASE ORDER BY name LIMIT ?')
      .all(`%${args.query}%`, limit) as Recipe[];
  }
  return ctx.db.prepare('SELECT * FROM recipes ORDER BY name LIMIT ?').all(limit) as Recipe[];
};

export const getRecipe = (
  ctx: Ctx,
  id: string,
): {
  recipe: Recipe;
  ingredients: Array<RecipeIngredient & { food_name: string | null }>;
  total: RecipeMacros;
  per_serving: RecipeMacros;
} => {
  const recipe = ctx.db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as Recipe | undefined;
  if (!recipe) throw new ServiceError('recipe_not_found', `recipe ${id} not found`, 404);
  const ingredients = ctx.db
    .prepare(
      `SELECT ri.*, f.name AS food_name
       FROM recipe_ingredients ri
       LEFT JOIN foods f ON f.id = ri.food_id
       WHERE ri.recipe_id = ?`,
    )
    .all(id) as Array<RecipeIngredient & { food_name: string | null }>;
  const total = computeRecipeTotal(ctx, ingredients);
  const per_serving = scaleMacros(total, 1 / recipe.servings);
  return { recipe, ingredients, total, per_serving };
};

const computeRecipeTotal = (
  ctx: Ctx,
  ingredients: Array<{ food_id: string | null; grams: number }>,
): RecipeMacros => {
  const totals = emptyMacros();
  for (const ing of ingredients) {
    if (!ing.food_id) continue;
    accumulateMacros(totals, macrosForFoodGrams(getFood(ctx, ing.food_id), ing.grams));
  }
  return totals;
};

export const recipeTotalsById = (ctx: Ctx, recipeId: string): Macros => {
  const ingredients = ctx.db
    .prepare('SELECT food_id, grams FROM recipe_ingredients WHERE recipe_id = ?')
    .all(recipeId) as Array<{ food_id: string | null; grams: number }>;
  return computeRecipeTotal(ctx, ingredients);
};

export type BatchTotals = Pick<
  Batch,
  | 'total_grams'
  | 'kcal_total'
  | 'protein_g_total'
  | 'carb_g_total'
  | 'fat_g_total'
  | 'fiber_g_total'
  | 'sugar_g_total'
  | 'sat_fat_g_total'
  | 'sodium_mg_total'
  | 'potassium_mg_total'
  | 'calcium_mg_total'
  | 'magnesium_mg_total'
  | 'iron_mg_total'
>;

export const batchMacrosForGrams = (batch: BatchTotals, grams: number): Macros =>
  scaleMacros(
    {
      kcal: batch.kcal_total,
      protein_g: batch.protein_g_total,
      carb_g: batch.carb_g_total,
      fat_g: batch.fat_g_total,
      fiber_g: batch.fiber_g_total,
      sugar_g: batch.sugar_g_total,
      sat_fat_g: batch.sat_fat_g_total,
      sodium_mg: batch.sodium_mg_total,
      potassium_mg: batch.potassium_mg_total,
      calcium_mg: batch.calcium_mg_total,
      magnesium_mg: batch.magnesium_mg_total,
      iron_mg: batch.iron_mg_total,
    },
    grams / batch.total_grams,
  );

export type Batch = {
  id: string;
  name: string | null;
  recipe_id: string | null;
  total_grams: number;
  remaining_grams: number;
  kcal_total: number;
  protein_g_total: number;
  carb_g_total: number;
  fat_g_total: number;
  fiber_g_total: number | null;
  sugar_g_total: number | null;
  sat_fat_g_total: number | null;
  sodium_mg_total: number | null;
  potassium_mg_total: number | null;
  calcium_mg_total: number | null;
  magnesium_mg_total: number | null;
  iron_mg_total: number | null;
  cooked_at: string;
  expires_at: string | null;
  notes: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
};

export const createBatch = (
  ctx: Ctx,
  args: {
    name?: string;
    recipe_id?: string;
    food_id?: string;
    total_grams: number;
    consumed_grams?: number;
    ingredients_override?: IngredientInput[];
    cooked_at?: string;
    expires_at?: string;
    notes?: string;
  },
): Batch => {
  let totals: RecipeMacros;
  if (args.recipe_id) {
    const { recipe, ingredients } = getRecipe(ctx, args.recipe_id);
    const recipeTotals = computeRecipeTotal(ctx, ingredients);
    const recipeGrams = ingredients.reduce((s, i) => s + i.grams, 0);
    if (recipeGrams === 0) {
      throw new ServiceError(
        'recipe_has_no_food_grams',
        `recipe ${recipe.id} has no food-backed grams to scale from`,
        400,
      );
    }
    totals = scaleMacros(recipeTotals, args.total_grams / recipeGrams);
  } else if (args.food_id) {
    const food = getFood(ctx, args.food_id);
    totals = macrosForFoodGrams(food, args.total_grams);
  } else if (args.ingredients_override) {
    totals = computeRecipeTotal(
      ctx,
      args.ingredients_override.map((ing) => ({ food_id: ing.food_id ?? null, grams: ing.grams })),
    );
  } else {
    throw new ServiceError(
      'missing_source',
      'one of recipe_id, food_id, or ingredients_override required',
      400,
    );
  }

  const id = cuid();
  const cooked_at = args.cooked_at ?? new Date().toISOString();
  const batchName = args.name ?? (args.food_id ? getFood(ctx, args.food_id).name : null);
  ctx.db
    .prepare(
      `INSERT INTO batches (
        id, name, recipe_id, total_grams, remaining_grams,
        kcal_total, protein_g_total, carb_g_total, fat_g_total,
        fiber_g_total, sugar_g_total, sat_fat_g_total, sodium_mg_total,
        potassium_mg_total, calcium_mg_total, magnesium_mg_total, iron_mg_total,
        cooked_at, expires_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      batchName,
      args.recipe_id ?? null,
      args.total_grams,
      args.total_grams,
      totals.kcal,
      totals.protein_g,
      totals.carb_g,
      totals.fat_g,
      totals.fiber_g,
      totals.sugar_g,
      totals.sat_fat_g,
      totals.sodium_mg,
      totals.potassium_mg,
      totals.calcium_mg,
      totals.magnesium_mg,
      totals.iron_mg,
      cooked_at,
      args.expires_at ?? null,
      args.notes ?? null,
    );

  // If consumed_grams is provided, immediately log a meal consuming from this batch
  if (args.consumed_grams && args.consumed_grams > 0) {
    logMeal(ctx, {
      ts: cooked_at,
      components: [{ ref: 'batch', batch_id: id, grams: args.consumed_grams }],
    });
  }

  return ctx.db.prepare('SELECT * FROM batches WHERE id = ?').get(id) as Batch;
};

export const listBatches = (ctx: Ctx, args: { active_only?: boolean } = {}): Batch[] => {
  if (args.active_only) {
    return ctx.db
      .prepare(
        'SELECT * FROM batches WHERE archived = 0 AND remaining_grams > 0 ORDER BY cooked_at DESC',
      )
      .all() as Batch[];
  }
  return ctx.db.prepare('SELECT * FROM batches ORDER BY cooked_at DESC').all() as Batch[];
};

export const getBatch = (ctx: Ctx, id: string): Batch => {
  const row = ctx.db.prepare('SELECT * FROM batches WHERE id = ?').get(id) as Batch | undefined;
  if (!row) throw new ServiceError('batch_not_found', `batch ${id} not found`, 404);
  return row;
};

export const archiveBatch = (ctx: Ctx, id: string): Batch => {
  const r = ctx.db
    .prepare(
      "UPDATE batches SET archived = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    )
    .run(id);
  if (r.changes === 0) throw new ServiceError('batch_not_found', `batch ${id} not found`, 404);
  return getBatch(ctx, id);
};

export const deleteBatch = (ctx: Ctx, id: string): { id: string } => {
  const r = ctx.db.prepare('DELETE FROM batches WHERE id = ?').run(id);
  if (r.changes === 0) throw new ServiceError('batch_not_found', `batch ${id} not found`, 404);
  return { id };
};
