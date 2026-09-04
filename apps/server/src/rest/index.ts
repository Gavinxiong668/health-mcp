import type { MealComponentInput, MealType } from '@health-mcp/shared';
import type { Context, Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import {
  deleteBloodPressure,
  listBloodPressure,
  logBloodPressure,
} from '../services/blood-pressure.js';
import {
  biomarkerTrend,
  createCustomBiomarker,
  deleteLabPanel,
  deleteLabResult,
  getBiomarker,
  getLabPanelDetail,
  latestBiomarkers,
  listLabPanels,
  listLabResults,
  logLabPanel,
  logLabResult,
  searchBiomarker,
  setOptimalRange,
  updateBiomarker,
} from '../services/biomarkers.js';
import { correlate, listCorrelateMetrics } from '../services/correlate.js';
import {
  deleteDialysis,
  getDialysis,
  listDialysis,
  logDialysis,
  updateDialysis,
} from '../services/dialysis.js';
import { deleteDiary, listDiary, logDiary } from '../services/diary.js';
import {
  deleteFluidOutput,
  listFluidOutput,
  logFluidOutput,
} from '../services/fluid-output.js';
import {
  bulkUpsertCustomFoods,
  createCustomFood,
  deleteCustomFood,
  getFood,
  getFoodByExternalId,
  listFoodCategories,
  listFoodsByCategory,
  lookupBarcode,
  searchFood,
  updateCustomFood,
} from '../services/food.js';
import { generateHealthReport } from '../services/health-report.js';
import { getGoals, setGoals } from '../services/goals.js';
import {
  addMealComponent,
  deleteMeal,
  getMeal,
  listMeals,
  logMeal,
  removeMealComponent,
  undoLastMeal,
  updateMeal,
  updateMealComponent,
} from '../services/meals.js';
import {
  createMedication,
  deleteMedication,
  getMedication,
  listMedicationLog,
  listMedications,
  logMedicationDose,
  updateMedication,
} from '../services/medications.js';
import {
  deleteMealPlanEntry,
  getMealPlanEntry,
  listMealPlanEntries,
  updateMealPlanEntry,
  createMealPlanEntry,
} from '../services/meal-plan.js';
import {
  deletePain, listPain, logPain,
} from '../services/pain.js';
import {
  archiveBatch,
  createBatch,
  createRecipe,
  deleteBatch,
  deleteRecipe,
  getBatch,
  getRecipe,
  listBatches,
  listRecipes,
  updateRecipe,
} from '../services/recipes.js';
import {
  forgetMeal,
  getRememberedMeal,
  listRememberedMeals,
  logRememberedMeal,
  rememberMeal,
  updateRememberedMeal,
} from '../services/remembered-meals.js';
import {
  deleteHydration,
  deleteMeasurement,
  deleteWeight,
  listHydration,
  listMeasurements,
  listWeight,
  logHydration,
  logMeasurement,
  logWeight,
} from '../services/simple-logs.js';
import { dailySummary, rangeSummary, weeklySummary } from '../services/summaries.js';
import { ServiceError } from '../services/types.js';
import type { WearableServiceCtx } from '../services/wearables.js';
import {
  ingestZeppActivity,
  ingestZeppBatch,
  ingestZeppHeartRate,
  ingestZeppReadiness,
  ingestZeppSleep,
} from '../services/zepp.js';
import {
  handleOAuthCallback,
  setActivityTypeMap,
  syncWearables,
  wearableActivity,
  wearableConnectUrl,
  wearableDaily,
  wearableDisconnect,
  wearableReadiness,
  wearableSleep,
  wearablesListProviders,
  wearablesStatus,
  whoopBodyMeasurement,
  whoopRecovery,
} from '../services/wearables.js';
import { decodeAndConsumeState, purgeExpiredNonces } from '../wearables/oauth-state.js';

const wrap = async (c: Context, fn: () => unknown): Promise<Response> => {
  try {
    const v = await fn();
    return c.json(v ?? null);
  } catch (err) {
    if (err instanceof ServiceError) {
      return c.json({ code: err.code, message: err.message }, err.status as ContentfulStatusCode);
    }
    return c.json({ code: 'internal_error', message: (err as Error).message }, 500);
  }
};

const intParam = (v: string | undefined): number | undefined =>
  v ? Number.parseInt(v, 10) : undefined;

const parseBody = <T>(c: Context): Promise<T> => c.req.json() as Promise<T>;

const mergeBody = (c: Context): Promise<Record<string, unknown>> =>
  c.req.json() as Promise<Record<string, unknown>>;

const parseBodyOr = <T>(c: Context, fallback: T): Promise<T> =>
  c.req.json().catch(() => fallback) as Promise<T>;

export const mountRestRoutes = (app: Hono, ctx: WearableServiceCtx): void => {
  // Foods
  app.get('/api/foods/search', (c) =>
    wrap(c, () =>
      searchFood(ctx, {
        query: c.req.query('query') ?? '',
        source: c.req.query('source') as Parameters<typeof searchFood>[1]['source'],
        limit: intParam(c.req.query('limit')),
      }),
    ),
  );
  app.get('/api/foods/barcode/:barcode', (c) =>
    wrap(c, () => lookupBarcode(ctx, c.req.param('barcode'))),
  );
  app.get('/api/foods/external/:externalId', (c) =>
    wrap(c, () => getFoodByExternalId(ctx, c.req.param('externalId'))),
  );
  app.get('/api/foods/categories', (c) =>
    wrap(c, () => listFoodCategories(ctx)),
  );
  app.get('/api/foods/by-category/:category', (c) =>
    wrap(c, () => listFoodsByCategory(ctx, decodeURIComponent(c.req.param('category')))),
  );
  app.post('/api/foods/bulk', (c) =>
    wrap(c, async () => bulkUpsertCustomFoods(ctx, await parseBody(c))),
  );
  app.get('/api/foods/:id', (c) => wrap(c, () => getFood(ctx, c.req.param('id'))));
  app.post('/api/foods', (c) => wrap(c, async () => createCustomFood(ctx, await parseBody(c))));
  app.patch('/api/foods/:id', (c) =>
    wrap(c, async () => updateCustomFood(ctx, { id: c.req.param('id'), ...(await mergeBody(c)) })),
  );
  app.delete('/api/foods/:id', (c) => wrap(c, () => deleteCustomFood(ctx, c.req.param('id'))));

  // Meals
  app.get('/api/meals', (c) =>
    wrap(c, () =>
      listMeals(ctx, {
        date: c.req.query('date'),
        start: c.req.query('start'),
        end: c.req.query('end'),
        meal_type: c.req.query('meal_type') as MealType | undefined,
        limit: intParam(c.req.query('limit')),
      }),
    ),
  );
  app.post('/api/meals', (c) => wrap(c, async () => logMeal(ctx, await parseBody(c))));
  app.post('/api/meals/undo', (c) => wrap(c, () => undoLastMeal(ctx)));
  app.get('/api/meals/:id', (c) => wrap(c, () => getMeal(ctx, c.req.param('id'))));
  app.patch('/api/meals/:id', (c) =>
    wrap(c, async () => updateMeal(ctx, { id: c.req.param('id'), ...(await mergeBody(c)) })),
  );
  app.delete('/api/meals/:id', (c) => wrap(c, () => deleteMeal(ctx, c.req.param('id'))));
  app.post('/api/meals/:id/components', (c) =>
    wrap(c, async () => {
      const body = await parseBody<{ component: MealComponentInput }>(c);
      return addMealComponent(ctx, { meal_id: c.req.param('id'), component: body.component });
    }),
  );
  app.patch('/api/meals/:id/components/:componentId', (c) =>
    wrap(c, async () =>
      updateMealComponent(ctx, { id: c.req.param('componentId'), ...(await mergeBody(c)) }),
    ),
  );
  app.delete('/api/meals/:id/components/:componentId', (c) =>
    wrap(c, () => removeMealComponent(ctx, c.req.param('componentId'))),
  );

  // Hydration / weight / measurement
  app.get('/api/hydration', (c) =>
    wrap(c, () =>
      listHydration(ctx, {
        date: c.req.query('date'),
        start: c.req.query('start'),
        end: c.req.query('end'),
        limit: intParam(c.req.query('limit')),
      }),
    ),
  );
  app.post('/api/hydration', (c) => wrap(c, async () => logHydration(ctx, await parseBody(c))));
  app.delete('/api/hydration/:id', (c) => wrap(c, () => deleteHydration(ctx, c.req.param('id'))));

  app.get('/api/weight', (c) =>
    wrap(c, () =>
      listWeight(ctx, {
        date: c.req.query('date'),
        start: c.req.query('start'),
        end: c.req.query('end'),
        limit: intParam(c.req.query('limit')),
      }),
    ),
  );
  app.post('/api/weight', (c) => wrap(c, async () => logWeight(ctx, await parseBody(c))));
  app.delete('/api/weight/:id', (c) => wrap(c, () => deleteWeight(ctx, c.req.param('id'))));

  app.get('/api/measurements', (c) =>
    wrap(c, () =>
      listMeasurements(ctx, {
        date: c.req.query('date'),
        start: c.req.query('start'),
        end: c.req.query('end'),
        kind: c.req.query('kind'),
        limit: intParam(c.req.query('limit')),
      }),
    ),
  );
  app.post('/api/measurements', (c) =>
    wrap(c, async () => logMeasurement(ctx, await parseBody(c))),
  );
  app.delete('/api/measurements/:id', (c) =>
    wrap(c, () => deleteMeasurement(ctx, c.req.param('id'))),
  );

  app.get('/api/goals', (c) => wrap(c, () => getGoals(ctx)));
  app.put('/api/goals', (c) => wrap(c, async () => setGoals(ctx, await parseBody(c))));

  // Summaries
  app.get('/api/summary/daily', (c) =>
    wrap(c, () =>
      dailySummary(ctx, {
        date: c.req.query('date'),
        compare_to: c.req.query('compare_to') as 'yesterday' | '7d_avg' | undefined,
      }),
    ),
  );
  app.get('/api/summary/weekly', (c) =>
    wrap(c, () => weeklySummary(ctx, { week_starting: c.req.query('week_starting') })),
  );
  app.get('/api/summary/range', (c) =>
    wrap(c, () =>
      rangeSummary(ctx, {
        start: c.req.query('start') ?? '',
        end: c.req.query('end') ?? '',
        bucket: c.req.query('bucket') as 'day' | 'week' | undefined,
      }),
    ),
  );

  app.get('/api/correlate/metrics', (c) => wrap(c, () => listCorrelateMetrics()));
  app.post('/api/correlate', (c) => wrap(c, async () => correlate(ctx, await parseBody(c))));

  // Recipes / batches
  app.get('/api/recipes', (c) =>
    wrap(c, () =>
      listRecipes(ctx, { query: c.req.query('query'), limit: intParam(c.req.query('limit')) }),
    ),
  );
  app.post('/api/recipes', (c) => wrap(c, async () => createRecipe(ctx, await parseBody(c))));
  app.get('/api/recipes/:id', (c) => wrap(c, () => getRecipe(ctx, c.req.param('id'))));
  app.patch('/api/recipes/:id', (c) =>
    wrap(c, async () => updateRecipe(ctx, { id: c.req.param('id'), ...(await mergeBody(c)) })),
  );
  app.delete('/api/recipes/:id', (c) => wrap(c, () => deleteRecipe(ctx, c.req.param('id'))));

  app.get('/api/batches', (c) =>
    wrap(c, () => listBatches(ctx, { active_only: c.req.query('active_only') === 'true' })),
  );
  app.post('/api/batches', (c) => wrap(c, async () => createBatch(ctx, await parseBody(c))));
  app.get('/api/batches/:id', (c) => wrap(c, () => getBatch(ctx, c.req.param('id'))));
  app.post('/api/batches/:id/archive', (c) => wrap(c, () => archiveBatch(ctx, c.req.param('id'))));
  app.delete('/api/batches/:id', (c) => wrap(c, () => deleteBatch(ctx, c.req.param('id'))));

  app.get('/api/remembered-meals', (c) =>
    wrap(c, () =>
      listRememberedMeals(ctx, {
        query: c.req.query('query'),
        limit: intParam(c.req.query('limit')),
      }),
    ),
  );
  app.post('/api/remembered-meals', (c) =>
    wrap(c, async () => rememberMeal(ctx, await parseBody(c))),
  );
  app.get('/api/remembered-meals/:id_or_label', (c) =>
    wrap(c, () => getRememberedMeal(ctx, c.req.param('id_or_label'))),
  );
  app.patch('/api/remembered-meals/:id', (c) =>
    wrap(c, async () =>
      updateRememberedMeal(ctx, { id: c.req.param('id'), ...(await mergeBody(c)) }),
    ),
  );
  app.delete('/api/remembered-meals/:id_or_label', (c) =>
    wrap(c, () => forgetMeal(ctx, c.req.param('id_or_label'))),
  );
  app.post('/api/remembered-meals/:id_or_label/log', (c) =>
    wrap(c, async () =>
      logRememberedMeal(ctx, {
        id_or_label: c.req.param('id_or_label'),
        ...(await parseBodyOr(c, {} as Record<string, unknown>)),
      }),
    ),
  );

  // Biomarkers / labs
  app.get('/api/biomarkers', (c) =>
    wrap(c, () =>
      c.req.query('query')
        ? searchBiomarker(ctx, {
            query: c.req.query('query') ?? '',
            category: c.req.query('category'),
            limit: intParam(c.req.query('limit')),
          })
        : latestBiomarkers(ctx, {
            category: c.req.query('category'),
            out_of_range_only: c.req.query('out_of_range_only') === 'true',
          }),
    ),
  );
  app.post('/api/biomarkers', (c) =>
    wrap(c, async () => createCustomBiomarker(ctx, await parseBody(c))),
  );
  app.get('/api/biomarkers/:id', (c) => wrap(c, () => getBiomarker(ctx, c.req.param('id'))));
  app.patch('/api/biomarkers/:id', (c) =>
    wrap(c, async () => updateBiomarker(ctx, { id: c.req.param('id'), ...(await mergeBody(c)) })),
  );
  app.put('/api/biomarkers/:id/optimal-range', (c) =>
    wrap(c, async () =>
      setOptimalRange(ctx, {
        biomarker: c.req.param('id'),
        ...(await parseBody<{ low?: number | null; high?: number | null }>(c)),
      }),
    ),
  );
  app.get('/api/biomarkers/:id/trend', (c) =>
    wrap(c, () =>
      biomarkerTrend(ctx, {
        biomarker: c.req.param('id'),
        start: c.req.query('start'),
        end: c.req.query('end'),
      }),
    ),
  );
  app.get('/api/lab-panels', (c) =>
    wrap(c, () =>
      listLabPanels(ctx, {
        start: c.req.query('start'),
        end: c.req.query('end'),
        limit: intParam(c.req.query('limit')),
      }),
    ),
  );
  app.post('/api/lab-panels', (c) => wrap(c, async () => logLabPanel(ctx, await parseBody(c))));
  app.get('/api/lab-panels/:id', (c) => wrap(c, () => getLabPanelDetail(ctx, c.req.param('id'))));
  app.delete('/api/lab-panels/:id', (c) => wrap(c, () => deleteLabPanel(ctx, c.req.param('id'))));
  app.get('/api/lab-results', (c) =>
    wrap(c, () =>
      listLabResults(ctx, {
        biomarker: c.req.query('biomarker'),
        category: c.req.query('category'),
        start: c.req.query('start'),
        end: c.req.query('end'),
        out_of_range_only: c.req.query('out_of_range_only') === 'true',
        limit: intParam(c.req.query('limit')),
      }),
    ),
  );
  app.post('/api/lab-results', (c) => wrap(c, async () => logLabResult(ctx, await parseBody(c))));
  app.delete('/api/lab-results/:id', (c) => wrap(c, () => deleteLabResult(ctx, c.req.param('id'))));

  // Wearables
  app.get('/api/wearables/providers', (c) => wrap(c, () => wearablesListProviders(ctx)));
  app.get('/api/wearables/status', (c) => wrap(c, () => wearablesStatus(ctx)));
  app.post('/api/wearables/:provider/connect', (c) =>
    wrap(c, () => wearableConnectUrl(ctx, { provider: c.req.param('provider') })),
  );
  app.delete('/api/wearables/:provider', (c) =>
    wrap(c, () => wearableDisconnect(ctx, { provider: c.req.param('provider') })),
  );
  app.post('/api/wearables/sync', (c) =>
    wrap(c, async () => syncWearables(ctx, await parseBodyOr(c, {}))),
  );
  app.get('/api/wearables/sleep', (c) =>
    wrap(c, () =>
      wearableSleep(ctx, {
        date: c.req.query('date'),
        start: c.req.query('start'),
        end: c.req.query('end'),
        providers: c.req.query('providers')?.split(','),
      }),
    ),
  );
  app.get('/api/wearables/activity', (c) =>
    wrap(c, () =>
      wearableActivity(ctx, {
        start: c.req.query('start'),
        end: c.req.query('end'),
        type: c.req.query('type'),
        providers: c.req.query('providers')?.split(','),
      }),
    ),
  );
  app.get('/api/wearables/readiness', (c) =>
    wrap(c, () =>
      wearableReadiness(ctx, {
        date: c.req.query('date'),
        start: c.req.query('start'),
        end: c.req.query('end'),
        providers: c.req.query('providers')?.split(','),
      }),
    ),
  );
  app.get('/api/wearables/daily', (c) =>
    wrap(c, () =>
      wearableDaily(ctx, {
        date: c.req.query('date'),
        start: c.req.query('start'),
        end: c.req.query('end'),
        providers: c.req.query('providers')?.split(','),
      }),
    ),
  );
  app.put('/api/wearables/:provider/activity-type-map', (c) =>
    wrap(c, async () => {
      const body = await parseBody<{ raw_type: string; canonical: string }>(c);
      return setActivityTypeMap(ctx, { provider: c.req.param('provider'), ...body });
    }),
  );
  app.get('/api/whoop/recovery', (c) =>
    wrap(c, () =>
      whoopRecovery(ctx, {
        date: c.req.query('date'),
        start: c.req.query('start'),
        end: c.req.query('end'),
      }),
    ),
  );
  app.get('/api/whoop/body', (c) => wrap(c, () => whoopBodyMeasurement(ctx)));

  // Zepp push endpoints (watch-side mini-app → server)
  app.post('/api/zepp/heartrate', (c) =>
    wrap(c, async () => ingestZeppHeartRate(ctx, await parseBody(c))),
  );
  app.post('/api/zepp/activity', (c) =>
    wrap(c, async () => ingestZeppActivity(ctx, await parseBody(c))),
  );
  app.post('/api/zepp/sleep', (c) =>
    wrap(c, async () => ingestZeppSleep(ctx, await parseBody(c))),
  );
  app.post('/api/zepp/readiness', (c) =>
    wrap(c, async () => ingestZeppReadiness(ctx, await parseBody(c))),
  );
  app.post('/api/zepp/batch', (c) =>
    wrap(c, async () => ingestZeppBatch(ctx, await parseBody(c))),
  );

  // Blood pressure
  app.get('/api/blood-pressure', (c) =>
    wrap(c, () =>
      listBloodPressure(ctx, {
        date: c.req.query('date'),
        start: c.req.query('start'),
        end: c.req.query('end'),
        limit: intParam(c.req.query('limit')),
      }),
    ),
  );
  app.post('/api/blood-pressure', (c) =>
    wrap(c, async () => logBloodPressure(ctx, await parseBody(c))),
  );
  app.delete('/api/blood-pressure/:id', (c) =>
    wrap(c, () => deleteBloodPressure(ctx, c.req.param('id'))),
  );

  // Dialysis
  app.get('/api/dialysis', (c) =>
    wrap(c, () =>
      listDialysis(ctx, {
        date: c.req.query('date'),
        start: c.req.query('start'),
        end: c.req.query('end'),
        limit: intParam(c.req.query('limit')),
      }),
    ),
  );
  app.post('/api/dialysis', (c) => wrap(c, async () => logDialysis(ctx, await parseBody(c))));
  app.get('/api/dialysis/:id', (c) => wrap(c, () => getDialysis(ctx, c.req.param('id'))));
  app.patch('/api/dialysis/:id', (c) =>
    wrap(c, async () => updateDialysis(ctx, { id: c.req.param('id'), ...(await mergeBody(c)) })),
  );
  app.delete('/api/dialysis/:id', (c) => wrap(c, () => deleteDialysis(ctx, c.req.param('id'))));

  // Pain
  app.get('/api/pain', (c) =>
    wrap(c, () =>
      listPain(ctx, {
        date: c.req.query('date'),
        start: c.req.query('start'),
        end: c.req.query('end'),
        limit: intParam(c.req.query('limit')),
      }),
    ),
  );
  app.post('/api/pain', (c) => wrap(c, async () => logPain(ctx, await parseBody(c))));
  app.delete('/api/pain/:id', (c) => wrap(c, () => deletePain(ctx, c.req.param('id'))));

  // Medications
  app.get('/api/medications', (c) =>
    wrap(c, () => listMedications(ctx, { active_only: c.req.query('active_only') === 'true' })),
  );
  app.post('/api/medications', (c) =>
    wrap(c, async () => createMedication(ctx, await parseBody(c))),
  );
  app.get('/api/medications/:id', (c) => wrap(c, () => getMedication(ctx, c.req.param('id'))));
  app.patch('/api/medications/:id', (c) =>
    wrap(c, async () => updateMedication(ctx, { id: c.req.param('id'), ...(await mergeBody(c)) })),
  );
  app.delete('/api/medications/:id', (c) =>
    wrap(c, () => deleteMedication(ctx, c.req.param('id'))),
  );
  app.post('/api/medications/:id/log', (c) =>
    wrap(c, async () => logMedicationDose(ctx, { ...(await parseBody(c)), medication_id: c.req.param('id') })),
  );
  app.get('/api/medication-log', (c) =>
    wrap(c, () =>
      listMedicationLog(ctx, {
        medication_id: c.req.query('medication_id'),
        date: c.req.query('date'),
        start: c.req.query('start'),
        end: c.req.query('end'),
        limit: intParam(c.req.query('limit')),
      }),
    ),
  );

  // Diary
  app.get('/api/diary', (c) =>
    wrap(c, () =>
      listDiary(ctx, {
        date: c.req.query('date'),
        start: c.req.query('start'),
        end: c.req.query('end'),
        limit: intParam(c.req.query('limit')),
      }),
    ),
  );
  app.post('/api/diary', (c) => wrap(c, async () => logDiary(ctx, await parseBody(c))));
  app.delete('/api/diary/:id', (c) => wrap(c, () => deleteDiary(ctx, c.req.param('id'))));

  // Fluid output
  app.get('/api/fluid-output', (c) =>
    wrap(c, () =>
      listFluidOutput(ctx, {
        date: c.req.query('date'),
        start: c.req.query('start'),
        end: c.req.query('end'),
        limit: intParam(c.req.query('limit')),
      }),
    ),
  );
  app.post('/api/fluid-output', (c) =>
    wrap(c, async () => logFluidOutput(ctx, await parseBody(c))),
  );
  app.delete('/api/fluid-output/:id', (c) =>
    wrap(c, () => deleteFluidOutput(ctx, c.req.param('id'))),
  );

  // Meal plan
  app.get('/api/meal-plan', (c) =>
    wrap(c, () =>
      listMealPlanEntries(ctx, {
        start: c.req.query('start'),
        end: c.req.query('end'),
      }),
    ),
  );
  app.post('/api/meal-plan', (c) =>
    wrap(c, async () => createMealPlanEntry(ctx, await parseBody(c))),
  );
  app.get('/api/meal-plan/:id', (c) =>
    wrap(c, () => getMealPlanEntry(ctx, c.req.param('id'))),
  );
  app.patch('/api/meal-plan/:id', (c) =>
    wrap(c, async () =>
      updateMealPlanEntry(ctx, { id: c.req.param('id'), ...(await mergeBody(c)) }),
    ),
  );
  app.delete('/api/meal-plan/:id', (c) =>
    wrap(c, () => deleteMealPlanEntry(ctx, c.req.param('id'))),
  );

  // Health report
  app.get('/api/report', (c) =>
    wrap(c, () =>
      generateHealthReport(ctx, {
        start: c.req.query('start') ?? '',
        end: c.req.query('end') ?? '',
      }),
    ),
  );

  // OAuth callback — unauthenticated by design (third-party redirect).
  app.get('/auth/wearable/callback', async (c) => {
    purgeExpiredNonces(ctx.db);
    const state = c.req.query('state');
    const code = c.req.query('code');
    const errorParam = c.req.query('error');
    if (errorParam) {
      return c.json({ error: errorParam }, 400);
    }
    if (!state || !code) {
      return c.json({ error: 'missing_state_or_code' }, 400);
    }
    const decoded = decodeAndConsumeState(ctx.db, state);
    if (!decoded.ok) {
      return c.json({ error: decoded.reason }, 400);
    }
    try {
      await handleOAuthCallback(ctx, { provider: decoded.payload.provider, code });
      return c.html(
        '<html><body><h1>Connected</h1><p>You can close this window.</p></body></html>',
      );
    } catch (err) {
      ctx.logger.error('oauth callback failed', { error: (err as Error).message });
      return c.json({ error: 'callback_failed', message: (err as Error).message }, 500);
    }
  });
};
