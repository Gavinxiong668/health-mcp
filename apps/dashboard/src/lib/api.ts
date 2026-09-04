import type {
  ApiErrorDto,
  BatchDto,
  BiomarkerDto,
  BiomarkerTrendPointDto,
  BloodPressureEntryDto,
  CustomFoodInput,
  DailySummaryDto,
  DiaryEntryDto,
  DialysisSessionDto,
  FluidOutputEntryDto,
  FoodDto,
  FoodSearchHitDto,
  GoalsDto,
  HealthProbe,
  HydrationEntryDto,
  LabPanelDetailDto,
  LabPanelDto,
  LabResultDto,
  LabResultWithStatusDto,
  LatestBiomarkerRowDto,
  MealComponentInput,
  MealDto,
  MealPlanEntryDto,
  MeasurementDto,
  MedicationDto,
  MedicationLogEntryDto,
  PainEntryDto,
  RangeSummaryDto,
  RecipeDto,
  RecipeWithIngredientsDto,
  WearableActivityDto,
  WearableDailyDto,
  WearableProviderInfoDto,
  WearableReadinessDto,
  WearableSleepDto,
  WearableStatusDto,
  WeightEntryDto,
  WhoopBodyDto,
} from '@health-mcp/shared';
import { clearToken, getToken } from './auth.js';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const BASE_URL = '';

type RequestInitJson = Omit<RequestInit, 'body'> & { body?: unknown };

const buildHeaders = (init?: HeadersInit): Headers => {
  const h = new Headers(init);
  const token = getToken();
  if (token) h.set('Authorization', `Bearer ${token}`);
  if (!h.has('Accept')) h.set('Accept', 'application/json');
  return h;
};

const request = async <T>(method: string, path: string, init?: RequestInitJson): Promise<T> => {
  const headers = buildHeaders(init?.headers);
  let body: BodyInit | undefined;
  if (init?.body !== undefined) {
    body = JSON.stringify(init.body);
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body,
    credentials: 'same-origin',
  });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new ApiError(401, 'unauthorized', 'token rejected');
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const err = (data as ApiErrorDto | null) ?? { code: 'http_error', message: res.statusText };
    throw new ApiError(res.status, err.code, err.message);
  }
  return data as T;
};

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, { body });
const put = <T>(path: string, body?: unknown) => request<T>('PUT', path, { body });
const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body });
const del = <T>(path: string) => request<T>('DELETE', path);

const qs = (params: Record<string, string | number | boolean | undefined | null>): string => {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of entries) sp.set(k, String(v));
  return `?${sp.toString()}`;
};

export const api = {
  health: () => get<HealthProbe>('/health'),

  foods: {
    search: (params: { query: string; source?: 'usda' | 'off' | 'manual'; limit?: number }) =>
      get<FoodSearchHitDto[]>(`/api/foods/search${qs(params)}`),
    byBarcode: (barcode: string) =>
      get<FoodDto | null>(`/api/foods/barcode/${encodeURIComponent(barcode)}`),
    get: (id: string) => get<FoodDto>(`/api/foods/${encodeURIComponent(id)}`),
    createCustom: (body: Record<string, unknown>) => post<FoodDto>('/api/foods', body),
    updateCustom: (id: string, body: Record<string, unknown>) =>
      patch<FoodDto>(`/api/foods/${encodeURIComponent(id)}`, body),
    deleteCustom: (id: string) => del<{ id: string }>(`/api/foods/${encodeURIComponent(id)}`),
    categories: () => get<Array<{ category: string; count: number }>>('/api/foods/categories'),
    byCategory: (category: string) =>
      get<FoodSearchHitDto[]>(`/api/foods/by-category/${encodeURIComponent(category)}`),
  },

  meals: {
    list: (
      params: {
        date?: string;
        start?: string;
        end?: string;
        meal_type?: string;
        limit?: number;
      } = {},
    ) => get<MealDto[]>(`/api/meals${qs(params)}`),
    get: (id: string) => get<MealDto>(`/api/meals/${encodeURIComponent(id)}`),
    log: (body: unknown) => post<MealDto>('/api/meals', body),
    update: (id: string, body: Record<string, unknown>) =>
      patch<MealDto>(`/api/meals/${encodeURIComponent(id)}`, body),
    delete: (id: string) => del<{ id: string }>(`/api/meals/${encodeURIComponent(id)}`),
    addComponent: (mealId: string, component: MealComponentInput) =>
      post<MealDto>(`/api/meals/${encodeURIComponent(mealId)}/components`, { component }),
    updateComponent: (mealId: string, componentId: string, body: Record<string, unknown>) =>
      patch<MealDto>(
        `/api/meals/${encodeURIComponent(mealId)}/components/${encodeURIComponent(componentId)}`,
        body,
      ),
    removeComponent: (mealId: string, componentId: string) =>
      del<MealDto>(
        `/api/meals/${encodeURIComponent(mealId)}/components/${encodeURIComponent(componentId)}`,
      ),
  },

  hydration: {
    list: (params: { date?: string; start?: string; end?: string; limit?: number } = {}) =>
      get<HydrationEntryDto[]>(`/api/hydration${qs(params)}`),
    log: (body: { ml: number; ts?: string; notes?: string }) =>
      post<HydrationEntryDto>('/api/hydration', body),
    delete: (id: string) => del<{ id: string }>(`/api/hydration/${encodeURIComponent(id)}`),
  },

  weight: {
    list: (params: { date?: string; start?: string; end?: string; limit?: number } = {}) =>
      get<WeightEntryDto[]>(`/api/weight${qs(params)}`),
    log: (body: { kg: number; body_fat_pct?: number; ts?: string; notes?: string }) =>
      post<WeightEntryDto>('/api/weight', body),
    delete: (id: string) => del<{ id: string }>(`/api/weight/${encodeURIComponent(id)}`),
  },

  measurements: {
    list: (
      params: { date?: string; start?: string; end?: string; kind?: string; limit?: number } = {},
    ) => get<MeasurementDto[]>(`/api/measurements${qs(params)}`),
    log: (body: { kind: string; value: number; unit: string; ts?: string; notes?: string }) =>
      post<MeasurementDto>('/api/measurements', body),
    delete: (id: string) => del<{ id: string }>(`/api/measurements/${encodeURIComponent(id)}`),
  },

  goals: {
    get: () => get<GoalsDto>('/api/goals'),
    set: (body: Partial<Omit<GoalsDto, 'updated_at'>>) => put<GoalsDto>('/api/goals', body),
  },

  summary: {
    daily: (params: { date?: string; compare_to?: 'yesterday' | '7d_avg' } = {}) =>
      get<DailySummaryDto>(`/api/summary/daily${qs(params)}`),
    weekly: (params: { week_starting?: string } = {}) =>
      get<RangeSummaryDto>(`/api/summary/weekly${qs(params)}`),
    range: (params: { start: string; end: string; bucket?: 'day' | 'week' }) =>
      get<RangeSummaryDto>(`/api/summary/range${qs(params)}`),
  },

  recipes: {
    list: (params: { query?: string; limit?: number } = {}) =>
      get<RecipeDto[]>(`/api/recipes${qs(params)}`),
    get: (id: string) => get<RecipeWithIngredientsDto>(`/api/recipes/${encodeURIComponent(id)}`),
    create: (body: unknown) => post<RecipeWithIngredientsDto>('/api/recipes', body),
    update: (id: string, body: unknown) =>
      patch<RecipeWithIngredientsDto>(`/api/recipes/${encodeURIComponent(id)}`, body),
    delete: (id: string) => del<{ id: string }>(`/api/recipes/${encodeURIComponent(id)}`),
  },

  batches: {
    list: (params: { active_only?: boolean } = {}) =>
      get<BatchDto[]>(
        `/api/batches${qs({ active_only: params.active_only ? 'true' : undefined })}`,
      ),
    get: (id: string) => get<BatchDto>(`/api/batches/${encodeURIComponent(id)}`),
    create: (body: unknown) => post<BatchDto>('/api/batches', body),
    archive: (id: string) => post<BatchDto>(`/api/batches/${encodeURIComponent(id)}/archive`),
    delete: (id: string) => del<{ id: string }>(`/api/batches/${encodeURIComponent(id)}`),
  },

  biomarkers: {
    search: (
      params: {
        query?: string;
        category?: string;
        out_of_range_only?: boolean;
        limit?: number;
      } = {},
    ) => get<BiomarkerDto[] | LatestBiomarkerRowDto[]>(`/api/biomarkers${qs(params)}`),
    latest: (params: { category?: string; out_of_range_only?: boolean } = {}) =>
      get<LatestBiomarkerRowDto[]>(`/api/biomarkers${qs(params)}`),
    get: (id: string) => get<BiomarkerDto>(`/api/biomarkers/${encodeURIComponent(id)}`),
    trend: (id: string, params: { start?: string; end?: string } = {}) =>
      get<BiomarkerTrendPointDto[]>(`/api/biomarkers/${encodeURIComponent(id)}/trend${qs(params)}`),
    setOptimal: (id: string, body: { low?: number | null; high?: number | null }) =>
      put<BiomarkerDto>(`/api/biomarkers/${encodeURIComponent(id)}/optimal-range`, body),
  },

  labs: {
    panels: (params: { start?: string; end?: string; limit?: number } = {}) =>
      get<LabPanelDto[]>(`/api/lab-panels${qs(params)}`),
    panel: (id: string) => get<LabPanelDetailDto>(`/api/lab-panels/${encodeURIComponent(id)}`),
    createPanel: (body: unknown) =>
      post<{ panel: LabPanelDto; results: LabResultDto[] }>('/api/lab-panels', body),
    deletePanel: (id: string) => del<{ id: string }>(`/api/lab-panels/${encodeURIComponent(id)}`),
    results: (
      params: {
        biomarker?: string;
        category?: string;
        start?: string;
        end?: string;
        out_of_range_only?: boolean;
        limit?: number;
      } = {},
    ) => get<LabResultWithStatusDto[]>(`/api/lab-results${qs(params)}`),
    logResult: (body: unknown) => post<LabResultDto>('/api/lab-results', body),
    deleteResult: (id: string) => del<{ id: string }>(`/api/lab-results/${encodeURIComponent(id)}`),
  },

  correlate: {
    metrics: () => get<Array<{ source: string; fields: string[] }>>('/api/correlate/metrics'),
    run: (body: {
      a: { source: string; field: string; agg: string; filter?: Record<string, string> };
      b: { source: string; field: string; agg: string; filter?: Record<string, string> };
      range: { start: string; end: string };
      bucket?: 'day' | 'week' | 'month';
      lag_buckets?: number;
      method?: 'pearson' | 'spearman';
    }) =>
      post<{
        method: 'pearson' | 'spearman';
        bucket: 'day' | 'week' | 'month';
        lag_buckets: number;
        n: number;
        r: number | null;
        pairs: Array<{ bucket: string; a: number; b: number }>;
      }>('/api/correlate', body),
  },

  wearables: {
    providers: () => get<WearableProviderInfoDto[]>('/api/wearables/providers'),
    status: () => get<WearableStatusDto[]>('/api/wearables/status'),
    connect: (provider: string) =>
      post<{ url: string; state: string }>(
        `/api/wearables/${encodeURIComponent(provider)}/connect`,
      ),
    disconnect: (provider: string) =>
      del<{ provider: string; disconnected: boolean }>(
        `/api/wearables/${encodeURIComponent(provider)}`,
      ),
    sync: (body: { providers?: string[]; resources?: string[]; since?: string } = {}) =>
      post<unknown>('/api/wearables/sync', body),
    sleep: (params: { date?: string; start?: string; end?: string; providers?: string } = {}) =>
      get<WearableSleepDto[]>(`/api/wearables/sleep${qs(params)}`),
    activity: (params: { start?: string; end?: string; type?: string; providers?: string } = {}) =>
      get<WearableActivityDto[]>(`/api/wearables/activity${qs(params)}`),
    readiness: (params: { date?: string; start?: string; end?: string; providers?: string } = {}) =>
      get<WearableReadinessDto[]>(`/api/wearables/readiness${qs(params)}`),
    daily: (params: { date?: string; start?: string; end?: string; providers?: string } = {}) =>
      get<WearableDailyDto[]>(`/api/wearables/daily${qs(params)}`),
    whoopBody: () => get<WhoopBodyDto | null>('/api/whoop/body'),
  },

  bloodPressure: {
    list: (params: { date?: string; start?: string; end?: string; limit?: number } = {}) =>
      get<BloodPressureEntryDto[]>(`/api/blood-pressure${qs(params)}`),
    log: (body: { systolic: number; diastolic: number; pulse?: number; position?: string; arm?: string; ts?: string; notes?: string }) =>
      post<BloodPressureEntryDto>('/api/blood-pressure', body),
    delete: (id: string) => del<{ id: string }>(`/api/blood-pressure/${encodeURIComponent(id)}`),
  },

  dialysis: {
    list: (params: { date?: string; start?: string; end?: string; limit?: number } = {}) =>
      get<DialysisSessionDto[]>(`/api/dialysis${qs(params)}`),
    get: (id: string) => get<DialysisSessionDto>(`/api/dialysis/${encodeURIComponent(id)}`),
    log: (body: unknown) => post<DialysisSessionDto>('/api/dialysis', body),
    update: (id: string, body: unknown) => patch<DialysisSessionDto>(`/api/dialysis/${encodeURIComponent(id)}`, body),
    delete: (id: string) => del<{ id: string }>(`/api/dialysis/${encodeURIComponent(id)}`),
  },

  pain: {
    list: (params: { date?: string; start?: string; end?: string; limit?: number } = {}) =>
      get<PainEntryDto[]>(`/api/pain${qs(params)}`),
    log: (body: { score: number; location?: string; type?: string; duration_min?: number; triggers?: string[]; relief_methods?: string[]; ts?: string; notes?: string }) =>
      post<PainEntryDto>('/api/pain', body),
    delete: (id: string) => del<{ id: string }>(`/api/pain/${encodeURIComponent(id)}`),
  },

  medications: {
    list: (params: { active_only?: boolean } = {}) =>
      get<MedicationDto[]>(`/api/medications${qs({ active_only: params.active_only ? 'true' : undefined })}`),
    get: (id: string) => get<MedicationDto>(`/api/medications/${encodeURIComponent(id)}`),
    create: (body: unknown) => post<MedicationDto>('/api/medications', body),
    update: (id: string, body: unknown) => patch<MedicationDto>(`/api/medications/${encodeURIComponent(id)}`, body),
    delete: (id: string) => del<{ id: string }>(`/api/medications/${encodeURIComponent(id)}`),
    logDose: (id: string, body: unknown) => post<MedicationLogEntryDto>(`/api/medications/${encodeURIComponent(id)}/log`, body),
    log: (params: { medication_id?: string; date?: string; start?: string; end?: string; limit?: number } = {}) =>
      get<MedicationLogEntryDto[]>(`/api/medication-log${qs(params)}`),
  },

  diary: {
    list: (params: { date?: string; start?: string; end?: string; limit?: number } = {}) =>
      get<DiaryEntryDto[]>(`/api/diary${qs(params)}`),
    log: (body: unknown) => post<DiaryEntryDto>('/api/diary', body),
    delete: (id: string) => del<{ id: string }>(`/api/diary/${encodeURIComponent(id)}`),
  },

  fluidOutput: {
    list: (params: { date?: string; start?: string; end?: string; limit?: number } = {}) =>
      get<FluidOutputEntryDto[]>(`/api/fluid-output${qs(params)}`),
    log: (body: { kind: string; ml: number; ts?: string; notes?: string }) =>
      post<FluidOutputEntryDto>('/api/fluid-output', body),
    delete: (id: string) => del<{ id: string }>(`/api/fluid-output/${encodeURIComponent(id)}`),
  },

  mealPlan: {
    list: (params: { start: string; end: string }) =>
      get<MealPlanEntryDto[]>(`/api/meal-plan${qs(params)}`),
    get: (id: string) => get<MealPlanEntryDto>(`/api/meal-plan/${encodeURIComponent(id)}`),
    upsert: (body: unknown) => post<MealPlanEntryDto>('/api/meal-plan', body),
    update: (id: string, body: unknown) =>
      patch<MealPlanEntryDto>(`/api/meal-plan/${encodeURIComponent(id)}`, body),
    delete: (id: string) => del<{ id: string }>(`/api/meal-plan/${encodeURIComponent(id)}`),
  },

  report: (params: { start: string; end: string }) =>
    request<Record<string, unknown>>('GET', `/api/report${qs(params)}`),
};
