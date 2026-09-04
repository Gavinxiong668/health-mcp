import type {
  CustomFoodInput,
  CustomFoodSpec,
  FoodSearchHitDto,
  UpdateCustomFoodInput,
} from '@health-mcp/shared';
import { fetchOffByBarcode } from '../providers/openfoodfacts.js';
import { fetchUsdaSearch } from '../providers/usda.js';
import { cuid } from '../util/id.js';
import {
  CLEAR_WINNER_SCORE,
  RELEVANCE_FLOOR,
  STRONG_MATCH_SCORE,
  TAIL_FRACTION,
  buildFtsMatch,
  isExactMatch,
  normalizeTokens,
  scoreFood,
} from './food-search.js';
import { type Ctx, ServiceError } from './types.js';

export type FoodRow = {
  id: string;
  source: 'usda' | 'off' | 'manual';
  source_id: string | null;
  external_id: string | null;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_grams: number | null;
  kcal_per_100g: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
  potassium_mg: number | null;
  calcium_mg: number | null;
  magnesium_mg: number | null;
  iron_mg: number | null;
  aliases: string | null;
  category: string | null;
  created_at: string;
};

// FTS recall pool reranked in JS; bm25 already front-loads the most relevant rows.
const CANDIDATE_POOL = 200;
// When every query token is a typo, FTS recalls nothing; rerank a bounded window instead.
const FUZZY_SCAN_CAP = 2000;

const toHit = (food: FoodRow, score: number, queryTokens: string[]): FoodSearchHitDto => ({
  ...food,
  score: Math.round(score * 1000) / 1000,
  exact: isExactMatch(queryTokens, food),
});

// Score the pool, drop sub-floor noise, and — when a near-exact winner exists — trim
// the loose tail beneath it. The result is "tight when there's a clear answer, still
// permissive when there isn't", with a `score` the caller can act on.
const rankFoods = (tokens: string[], pool: FoodRow[], limit: number): FoodSearchHitDto[] => {
  const scored = pool
    .map((food) => ({ food, score: scoreFood(tokens, food) }))
    .filter((s) => s.score >= RELEVANCE_FLOOR)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.food.source === 'manual') - Number(a.food.source === 'manual') ||
        a.food.name.length - b.food.name.length,
    );
  const top = scored[0]?.score ?? 0;
  const cutoff =
    top >= CLEAR_WINNER_SCORE ? Math.max(RELEVANCE_FLOOR, top * TAIL_FRACTION) : RELEVANCE_FLOOR;
  return scored
    .filter((s) => s.score >= cutoff)
    .slice(0, limit)
    .map((s) => toHit(s.food, s.score, tokens));
};

export const searchFoodLocal = (ctx: Ctx, query: string, limit = 20): FoodSearchHitDto[] => {
  const tokens = normalizeTokens(query);
  if (tokens.length === 0) return [];
  const candidates = ctx.db
    .prepare(
      `SELECT f.* FROM foods_fts JOIN foods f ON f.rowid = foods_fts.rowid
       WHERE foods_fts MATCH ? ORDER BY rank LIMIT ?`,
    )
    .all(buildFtsMatch(tokens), CANDIDATE_POOL) as FoodRow[];
  if (candidates.length > 0) return rankFoods(tokens, candidates, limit);
  const recent = ctx.db
    .prepare(`SELECT * FROM foods ORDER BY source = 'manual' DESC, created_at DESC LIMIT ?`)
    .all(FUZZY_SCAN_CAP) as FoodRow[];
  return rankFoods(tokens, recent, limit);
};

type FoodInsert = Omit<FoodRow, 'id' | 'created_at'> & { raw_json?: string };

const insertFood = (ctx: Ctx, row: FoodInsert): FoodRow => {
  const id = cuid();
  ctx.db
    .prepare(
      `INSERT INTO foods (id, source, source_id, external_id, name, brand, barcode, serving_grams,
        kcal_per_100g, protein_g, carb_g, fat_g, fiber_g, sugar_g, sat_fat_g, sodium_mg,
        potassium_mg, calcium_mg, magnesium_mg, iron_mg, aliases, category, raw_json)
       VALUES (@id, @source, @source_id, @external_id, @name, @brand, @barcode, @serving_grams,
        @kcal_per_100g, @protein_g, @carb_g, @fat_g, @fiber_g, @sugar_g, @sat_fat_g, @sodium_mg,
        @potassium_mg, @calcium_mg, @magnesium_mg, @iron_mg, @aliases, @category, @raw_json)`,
    )
    .run({
      id,
      source: row.source,
      source_id: row.source_id,
      external_id: row.external_id ?? null,
      name: row.name,
      brand: row.brand ?? null,
      barcode: row.barcode ?? null,
      serving_grams: row.serving_grams ?? null,
      kcal_per_100g: row.kcal_per_100g,
      protein_g: row.protein_g,
      carb_g: row.carb_g,
      fat_g: row.fat_g,
      fiber_g: row.fiber_g ?? null,
      sugar_g: row.sugar_g ?? null,
      sat_fat_g: row.sat_fat_g ?? null,
      sodium_mg: row.sodium_mg ?? null,
      potassium_mg: row.potassium_mg ?? null,
      calcium_mg: row.calcium_mg ?? null,
      magnesium_mg: row.magnesium_mg ?? null,
      iron_mg: row.iron_mg ?? null,
      aliases: row.aliases ?? null,
      category: row.category ?? null,
      raw_json: row.raw_json ?? null,
    });
  return getFood(ctx, id);
};

// Provider ingestion (USDA/OFF): dedupe on (source, source_id); first write wins.
export const upsertFood = (ctx: Ctx, row: FoodInsert): FoodRow => {
  if (row.source_id) {
    const existing = ctx.db
      .prepare('SELECT * FROM foods WHERE source = ? AND source_id = ?')
      .get(row.source, row.source_id) as FoodRow | undefined;
    if (existing) return existing;
  }
  return insertFood(ctx, row);
};

// USDA/OFF normalized results already match the catalog's nutrient shape; only
// source, barcode, and the (always-null on ingest) external_id/aliases differ.
const providerInsert = (
  source: 'usda' | 'off',
  n: Omit<FoodInsert, 'source' | 'external_id' | 'barcode' | 'aliases'>,
  barcode: string | null,
): FoodInsert => ({ ...n, source, external_id: null, barcode, aliases: null });

export const getFood = (ctx: Ctx, id: string): FoodRow => {
  const row = ctx.db.prepare('SELECT * FROM foods WHERE id = ?').get(id) as FoodRow | undefined;
  if (!row) throw new ServiceError('food_not_found', `food ${id} not found`, 404);
  return row;
};

const WIKILINK_RE = /^\[\[(.+?)\]\]$/;

// Tolerate Obsidian-style references: "[[slug|Display]]" / "[[slug]]" → "slug". A
// naive importer that passed the whole wikilink as the key dropped rows; this lets
// external_id writes and lookups resolve either form to the same key.
export const normalizeExternalId = (raw: string): string => {
  const trimmed = raw.trim();
  const inner = trimmed.match(WIKILINK_RE)?.[1] ?? trimmed;
  return inner.split('|')[0]!.trim();
};

export const getFoodByExternalId = (ctx: Ctx, externalId: string): FoodRow => {
  const key = normalizeExternalId(externalId);
  const row = ctx.db.prepare('SELECT * FROM foods WHERE external_id = ?').get(key) as
    | FoodRow
    | undefined;
  if (!row)
    throw new ServiceError('food_not_found', `food with external_id "${key}" not found`, 404);
  return row;
};

export const getFoodByRef = (ctx: Ctx, ref: { id?: string; external_id?: string }): FoodRow => {
  if (ref.id) return getFood(ctx, ref.id);
  if (ref.external_id) return getFoodByExternalId(ctx, ref.external_id);
  throw new ServiceError('bad_request', 'provide id or external_id', 400);
};

export const searchFood = async (
  ctx: Ctx,
  args: { query: string; source?: 'usda' | 'off' | 'manual'; limit?: number },
): Promise<FoodSearchHitDto[]> => {
  const limit = args.limit ?? 5;
  const local = searchFoodLocal(ctx, args.query, limit);
  const hasStrongLocal = local.some((h) => h.score >= STRONG_MATCH_SCORE);
  // Only reach for USDA when the local catalog has no strong answer — filling out to
  // `limit` with remote keyword hits is what dragged in garbage before.
  if (hasStrongLocal || local.length >= limit) return local;
  if (args.source === 'manual') return local;
  if (args.source && args.source !== 'usda') return local;
  if (!ctx.config.usdaApiKey) return local;
  try {
    const tokens = normalizeTokens(args.query);
    const remote = await fetchUsdaSearch(args.query, ctx.config.usdaApiKey, limit);
    const merged: FoodSearchHitDto[] = [...local];
    const seen = new Set(local.map((h) => h.id));
    for (const r of remote) {
      const row = upsertFood(ctx, providerInsert('usda', r, null));
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(toHit(row, scoreFood(tokens, row), tokens));
      if (merged.length >= limit) break;
    }
    return merged;
  } catch (err) {
    ctx.logger.warn('usda search failed', { error: (err as Error).message });
    return local;
  }
};

export type FoodQueryResult = { query: string; results: FoodSearchHitDto[] };

export const searchFoods = async (
  ctx: Ctx,
  args: { queries: string[]; source?: 'usda' | 'off' | 'manual'; limit?: number },
): Promise<FoodQueryResult[]> => {
  const unique = Array.from(new Set(args.queries));
  const settled = await Promise.all(
    unique.map((query) => searchFood(ctx, { query, source: args.source, limit: args.limit })),
  );
  const byQuery = new Map(unique.map((q, i) => [q, settled[i]!]));
  return args.queries.map((query) => ({ query, results: byQuery.get(query) ?? [] }));
};

export const lookupBarcode = async (ctx: Ctx, barcode: string): Promise<FoodRow | null> => {
  const local = ctx.db.prepare('SELECT * FROM foods WHERE barcode = ? LIMIT 1').get(barcode) as
    | FoodRow
    | undefined;
  if (local) return local;
  try {
    const remote = await fetchOffByBarcode(barcode);
    if (!remote) return null;
    return upsertFood(ctx, providerInsert('off', remote, barcode));
  } catch (err) {
    ctx.logger.warn('off lookup failed', { error: (err as Error).message });
    return null;
  }
};

const serializeAliases = (aliases: string[] | null | undefined): string | null => {
  if (!aliases) return null;
  const cleaned = aliases.map((a) => a.trim()).filter(Boolean);
  return cleaned.length ? JSON.stringify(cleaned) : null;
};

type NutrientColumns = Pick<
  FoodRow,
  | 'kcal_per_100g'
  | 'protein_g'
  | 'carb_g'
  | 'fat_g'
  | 'fiber_g'
  | 'sugar_g'
  | 'sat_fat_g'
  | 'sodium_mg'
  | 'potassium_mg'
  | 'calcium_mg'
  | 'magnesium_mg'
  | 'iron_mg'
>;

const nutrientColumns = (n: CustomFoodInput['nutrients_per_100g']): NutrientColumns => ({
  kcal_per_100g: n.kcal_per_100g,
  protein_g: n.protein_g_per_100g,
  carb_g: n.carb_g_per_100g,
  fat_g: n.fat_g_per_100g,
  fiber_g: n.fiber_g_per_100g ?? null,
  sugar_g: n.sugar_g_per_100g ?? null,
  sat_fat_g: n.sat_fat_g_per_100g ?? null,
  sodium_mg: n.sodium_mg_per_100g ?? null,
  potassium_mg: n.potassium_mg_per_100g ?? null,
  calcium_mg: n.calcium_mg_per_100g ?? null,
  magnesium_mg: n.magnesium_mg_per_100g ?? null,
  iron_mg: n.iron_mg_per_100g ?? null,
});

const findManualFood = (
  ctx: Ctx,
  args: {
    externalId: string | null;
    name: string;
    brand: string | null;
    matchByNameBrand: boolean;
  },
): FoodRow | undefined => {
  if (args.externalId) {
    const byKey = ctx.db
      .prepare('SELECT * FROM foods WHERE external_id = ?')
      .get(args.externalId) as FoodRow | undefined;
    if (byKey) return byKey;
  }
  if (!args.matchByNameBrand) return undefined;
  return ctx.db
    .prepare(
      `SELECT * FROM foods
       WHERE source = 'manual' AND name = ? COLLATE NOCASE
         AND COALESCE(brand, '') = COALESCE(?, '') COLLATE NOCASE
       ORDER BY created_at LIMIT 1`,
    )
    .get(args.name, args.brand) as FoodRow | undefined;
};

export type UpsertAction = 'created' | 'updated';

// Write a manual food as full state: the payload is the food. `matchByNameBrand`
// lets a keyless re-import dedupe on (name, brand); with an external_id we always
// dedupe on that. Returns whether the row was created or updated.
const upsertManualFood = (
  ctx: Ctx,
  input: CustomFoodInput,
  matchByNameBrand: boolean,
): { food: FoodRow; action: UpsertAction } => {
  const externalId = input.external_id ? normalizeExternalId(input.external_id) : null;
  const cols = nutrientColumns(input.nutrients_per_100g);
  const existing = findManualFood(ctx, {
    externalId,
    name: input.name,
    brand: input.brand ?? null,
    matchByNameBrand,
  });
  const values = {
    name: input.name,
    brand: input.brand ?? null,
    serving_grams: input.serving_grams ?? null,
    aliases: serializeAliases(input.aliases),
    category: input.category ?? null,
    ...cols,
  };
  if (existing) {
    ctx.db
      .prepare(
        `UPDATE foods SET
          name = @name, brand = @brand, serving_grams = @serving_grams,
          external_id = COALESCE(@external_id, external_id), aliases = @aliases,
          category = @category,
          kcal_per_100g = @kcal_per_100g, protein_g = @protein_g, carb_g = @carb_g, fat_g = @fat_g,
          fiber_g = @fiber_g, sugar_g = @sugar_g, sat_fat_g = @sat_fat_g, sodium_mg = @sodium_mg,
          potassium_mg = @potassium_mg, calcium_mg = @calcium_mg,
          magnesium_mg = @magnesium_mg, iron_mg = @iron_mg
        WHERE id = @id`,
      )
      .run({ ...values, external_id: externalId, id: existing.id });
    return { food: getFood(ctx, existing.id), action: 'updated' };
  }
  const food = insertFood(ctx, {
    source: 'manual',
    source_id: null,
    external_id: externalId,
    barcode: null,
    ...values,
  });
  return { food, action: 'created' };
};

export const createCustomFood = (ctx: Ctx, input: CustomFoodInput): FoodRow =>
  upsertManualFood(ctx, input, false).food;

export type BulkUpsertResult = {
  created: number;
  updated: number;
  foods: Array<{ id: string; name: string; external_id: string | null; action: UpsertAction }>;
};

export const bulkUpsertCustomFoods = (
  ctx: Ctx,
  args: { foods: CustomFoodInput[] },
): BulkUpsertResult => {
  const result: BulkUpsertResult = { created: 0, updated: 0, foods: [] };
  const tx = ctx.db.transaction(() => {
    for (const input of args.foods) {
      const { food, action } = upsertManualFood(ctx, input, true);
      if (action === 'created') result.created += 1;
      else result.updated += 1;
      result.foods.push({
        id: food.id,
        name: food.name,
        external_id: food.external_id,
        action,
      });
    }
  });
  tx();
  return result;
};

export const updateCustomFood = (ctx: Ctx, args: UpdateCustomFoodInput): FoodRow => {
  const existing = getFood(ctx, args.id);
  if (existing.source !== 'manual') {
    throw new ServiceError('not_custom', `food ${args.id} is not a custom food`, 400);
  }
  const n = args.nutrients_per_100g ? nutrientColumns(args.nutrients_per_100g) : null;
  const externalId =
    args.external_id === undefined
      ? existing.external_id
      : args.external_id === null
        ? null
        : normalizeExternalId(args.external_id);
  const aliases = args.aliases === undefined ? existing.aliases : serializeAliases(args.aliases);
  const category = args.category === undefined ? existing.category : (args.category ?? null);
  ctx.db
    .prepare(
      `UPDATE foods SET
        name = COALESCE(?, name),
        brand = ?,
        serving_grams = ?,
        external_id = ?,
        aliases = ?,
        category = ?,
        kcal_per_100g = COALESCE(?, kcal_per_100g),
        protein_g = COALESCE(?, protein_g),
        carb_g = COALESCE(?, carb_g),
        fat_g = COALESCE(?, fat_g),
        fiber_g = COALESCE(?, fiber_g),
        sugar_g = COALESCE(?, sugar_g),
        sat_fat_g = COALESCE(?, sat_fat_g),
        sodium_mg = COALESCE(?, sodium_mg),
        potassium_mg = COALESCE(?, potassium_mg),
        calcium_mg = COALESCE(?, calcium_mg),
        magnesium_mg = COALESCE(?, magnesium_mg),
        iron_mg = COALESCE(?, iron_mg)
      WHERE id = ?`,
    )
    .run(
      args.name ?? null,
      args.brand === undefined ? existing.brand : args.brand,
      args.serving_grams === undefined ? existing.serving_grams : args.serving_grams,
      externalId,
      aliases,
      category,
      n?.kcal_per_100g ?? null,
      n?.protein_g ?? null,
      n?.carb_g ?? null,
      n?.fat_g ?? null,
      n?.fiber_g ?? null,
      n?.sugar_g ?? null,
      n?.sat_fat_g ?? null,
      n?.sodium_mg ?? null,
      n?.potassium_mg ?? null,
      n?.calcium_mg ?? null,
      n?.magnesium_mg ?? null,
      n?.iron_mg ?? null,
      args.id,
    );
  return getFood(ctx, args.id);
};

export const deleteCustomFood = (ctx: Ctx, id: string): void => {
  const existing = getFood(ctx, id);
  if (existing.source !== 'manual') {
    throw new ServiceError('not_custom', `food ${id} is not a custom food`, 400);
  }
  ctx.db.prepare('DELETE FROM foods WHERE id = ?').run(id);
};

export type Macros = {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
  potassium_mg: number | null;
  calcium_mg: number | null;
  magnesium_mg: number | null;
  iron_mg: number | null;
};

const scaleOrNull = (v: number | null, factor: number): number | null =>
  v === null ? null : v * factor;

export const scaleMacros = (m: Macros, factor: number): Macros => ({
  kcal: m.kcal * factor,
  protein_g: m.protein_g * factor,
  carb_g: m.carb_g * factor,
  fat_g: m.fat_g * factor,
  fiber_g: scaleOrNull(m.fiber_g, factor),
  sugar_g: scaleOrNull(m.sugar_g, factor),
  sat_fat_g: scaleOrNull(m.sat_fat_g, factor),
  sodium_mg: scaleOrNull(m.sodium_mg, factor),
  potassium_mg: scaleOrNull(m.potassium_mg, factor),
  calcium_mg: scaleOrNull(m.calcium_mg, factor),
  magnesium_mg: scaleOrNull(m.magnesium_mg, factor),
  iron_mg: scaleOrNull(m.iron_mg, factor),
});

export const emptyMacros = (): Macros => ({
  kcal: 0,
  protein_g: 0,
  carb_g: 0,
  fat_g: 0,
  fiber_g: null,
  sugar_g: null,
  sat_fat_g: null,
  sodium_mg: null,
  potassium_mg: null,
  calcium_mg: null,
  magnesium_mg: null,
  iron_mg: null,
});

export const accumulateMacros = (totals: Macros, m: Macros): void => {
  totals.kcal += m.kcal;
  totals.protein_g += m.protein_g;
  totals.carb_g += m.carb_g;
  totals.fat_g += m.fat_g;
  totals.fiber_g = (totals.fiber_g ?? 0) + (m.fiber_g ?? 0);
  totals.sugar_g = (totals.sugar_g ?? 0) + (m.sugar_g ?? 0);
  totals.sat_fat_g = (totals.sat_fat_g ?? 0) + (m.sat_fat_g ?? 0);
  totals.sodium_mg = (totals.sodium_mg ?? 0) + (m.sodium_mg ?? 0);
  totals.potassium_mg = (totals.potassium_mg ?? 0) + (m.potassium_mg ?? 0);
  totals.calcium_mg = (totals.calcium_mg ?? 0) + (m.calcium_mg ?? 0);
  totals.magnesium_mg = (totals.magnesium_mg ?? 0) + (m.magnesium_mg ?? 0);
  totals.iron_mg = (totals.iron_mg ?? 0) + (m.iron_mg ?? 0);
};

export const macrosForFoodGrams = (food: FoodRow, grams: number): Macros =>
  scaleMacros(
    {
      kcal: food.kcal_per_100g,
      protein_g: food.protein_g,
      carb_g: food.carb_g,
      fat_g: food.fat_g,
      fiber_g: food.fiber_g,
      sugar_g: food.sugar_g,
      sat_fat_g: food.sat_fat_g,
      sodium_mg: food.sodium_mg,
      potassium_mg: food.potassium_mg,
      calcium_mg: food.calcium_mg,
      magnesium_mg: food.magnesium_mg,
      iron_mg: food.iron_mg,
    },
    grams / 100,
  );

export const macrosForCustom = (spec: CustomFoodSpec, grams: number): Macros => {
  if ('absolute' in spec) {
    const a = spec.absolute;
    return {
      kcal: a.kcal,
      protein_g: a.protein_g,
      carb_g: a.carb_g,
      fat_g: a.fat_g,
      fiber_g: a.fiber_g ?? null,
      sugar_g: a.sugar_g ?? null,
      sat_fat_g: a.sat_fat_g ?? null,
      sodium_mg: a.sodium_mg ?? null,
      potassium_mg: a.potassium_mg ?? null,
      calcium_mg: a.calcium_mg ?? null,
      magnesium_mg: a.magnesium_mg ?? null,
      iron_mg: a.iron_mg ?? null,
    };
  }
  return scaleMacros(
    {
      kcal: spec.kcal_per_100g,
      protein_g: spec.protein_g_per_100g,
      carb_g: spec.carb_g_per_100g,
      fat_g: spec.fat_g_per_100g,
      fiber_g: spec.fiber_g_per_100g ?? null,
      sugar_g: spec.sugar_g_per_100g ?? null,
      sat_fat_g: spec.sat_fat_g_per_100g ?? null,
      sodium_mg: spec.sodium_mg_per_100g ?? null,
      potassium_mg: spec.potassium_mg_per_100g ?? null,
      calcium_mg: spec.calcium_mg_per_100g ?? null,
      magnesium_mg: spec.magnesium_mg_per_100g ?? null,
      iron_mg: spec.iron_mg_per_100g ?? null,
    },
    grams / 100,
  );
};

// ── Category browsing ──

export const listFoodCategories = (ctx: Ctx): Array<{ category: string; count: number }> => {
  return ctx.db
    .prepare(
      `SELECT category, COUNT(*) as count FROM foods
       WHERE category IS NOT NULL
       GROUP BY category ORDER BY count DESC`,
    )
    .all() as Array<{ category: string; count: number }>;
};

export const listFoodsByCategory = (
  ctx: Ctx,
  category: string,
): FoodSearchHitDto[] => {
  const rows = ctx.db
    .prepare(
      `SELECT * FROM foods WHERE category = ? COLLATE NOCASE
       ORDER BY source = 'manual' DESC, name ASC`,
    )
    .all(category) as FoodRow[];
  return rows.map((r) => ({ ...r, score: 1, exact: true }));
};
