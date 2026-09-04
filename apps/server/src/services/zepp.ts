import { cuid } from '../util/id.js';
import type { Ctx } from './types.js';

// ── Zepp push ingestion ──────────────────────────────────────────────
// The GTR 4 watch-side mini-app (Zepp OS) pushes sensor data to these
// endpoints.  We persist into the zepp_* raw tables AND normalize into
// the cross-provider wearable_* tables so the dashboard picks them up
// automatically.

// ── Heart rate ───────────────────────────────────────────────────────

export type ZeppHeartRateInput = {
  heartRate: number;
  timestamp: number; // epoch ms
  restingHr?: number;
  hrMin?: number;
  hrMax?: number;
};

export const ingestZeppHeartRate = (ctx: Ctx, input: ZeppHeartRateInput) => {
  const ts = new Date(input.timestamp).toISOString();
  const date = ts.slice(0, 10);
  const id = cuid();

  // Store raw reading
  ctx.db
    .prepare(
      `INSERT INTO zepp_heart_rate (id, ts, date, heart_rate, resting_hr, hr_min, hr_max, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      ts,
      date,
      input.heartRate,
      input.restingHr ?? null,
      input.hrMin ?? null,
      input.hrMax ?? null,
      JSON.stringify(input),
    );

  // Upsert into wearable_daily (hr_avg) for the day
  ctx.db
    .prepare(
      `INSERT INTO wearable_daily (provider, date, hr_avg, raw_provider_id)
       VALUES ('zepp', ?, ?, ?)
       ON CONFLICT(provider, date) DO UPDATE SET
         hr_avg = COALESCE(excluded.hr_avg, wearable_daily.hr_avg),
         raw_provider_id = excluded.raw_provider_id`,
    )
    .run(date, input.heartRate, id);

  // Mirror resting HR into wearable_readiness if provided
  if (input.restingHr != null) {
    ctx.db
      .prepare(
        `INSERT INTO wearable_readiness (provider, date, resting_hr, raw_provider_id)
         VALUES ('zepp', ?, ?, ?)
         ON CONFLICT(provider, date) DO UPDATE SET
           resting_hr = COALESCE(excluded.resting_hr, wearable_readiness.resting_hr),
           raw_provider_id = excluded.raw_provider_id`,
      )
      .run(date, input.restingHr, id);
  }

  // Store minute-resolution heart rate for time-series charts
  ctx.db
    .prepare(
      `INSERT INTO wearable_metric_minutes (provider, metric, ts, value)
       VALUES ('zepp', 'heart_rate', ?, ?)
       ON CONFLICT(provider, metric, ts) DO UPDATE SET value = excluded.value`,
    )
    .run(ts, input.heartRate);

  return { ok: true, id, ts, date };
};

// ── Activity / steps ─────────────────────────────────────────────────

export type ZeppActivityInput = {
  timestamp: number; // epoch ms
  steps?: number;
  distance_m?: number;
  calories?: number;
  floors?: number;
  stand_hours?: number;
  active_minutes?: number;
};

export const ingestZeppActivity = (ctx: Ctx, input: ZeppActivityInput) => {
  const ts = new Date(input.timestamp).toISOString();
  const date = ts.slice(0, 10);
  const id = cuid();

  ctx.db
    .prepare(
      `INSERT INTO zepp_daily_activity
        (id, date, steps, active_calories, total_calories, distance_m, floors, active_time_min, stand_hours, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         steps = COALESCE(excluded.steps, zepp_daily_activity.steps),
         active_calories = COALESCE(excluded.active_calories, zepp_daily_activity.active_calories),
         distance_m = COALESCE(excluded.distance_m, zepp_daily_activity.distance_m),
         floors = COALESCE(excluded.floors, zepp_daily_activity.floors),
         stand_hours = COALESCE(excluded.stand_hours, zepp_daily_activity.stand_hours),
         raw_json = excluded.raw_json`,
    )
    .run(
      id,
      date,
      input.steps ?? null,
      input.calories ?? null,
      input.calories ?? null,
      input.distance_m ?? null,
      input.floors ?? null,
      input.active_minutes ?? null,
      input.stand_hours ?? null,
      JSON.stringify(input),
    );

  // Normalize into wearable_daily
  ctx.db
    .prepare(
      `INSERT INTO wearable_daily (provider, date, steps, kcal_active, kcal_total, distance_m, floors, stand_minutes, raw_provider_id)
       VALUES ('zepp', ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, date) DO UPDATE SET
         steps = COALESCE(excluded.steps, wearable_daily.steps),
         kcal_active = COALESCE(excluded.kcal_active, wearable_daily.kcal_active),
         kcal_total = COALESCE(excluded.kcal_total, wearable_daily.kcal_total),
         distance_m = COALESCE(excluded.distance_m, wearable_daily.distance_m),
         floors = COALESCE(excluded.floors, wearable_daily.floors),
         stand_minutes = COALESCE(excluded.stand_minutes, wearable_daily.stand_minutes),
         raw_provider_id = excluded.raw_provider_id`,
    )
    .run(
      date,
      input.steps ?? null,
      input.calories ?? null,
      input.calories ?? null,
      input.distance_m ?? null,
      input.floors ?? null,
      input.stand_hours != null ? input.stand_hours * 60 : null,
      id,
    );

  return { ok: true, id, date };
};

// ── Sleep ────────────────────────────────────────────────────────────

export type ZeppSleepInput = {
  startTime: string; // ISO
  endTime: string; // ISO
  duration_s: number;
  light_sleep_s?: number;
  deep_sleep_s?: number;
  rem_sleep_s?: number;
  awake_s?: number;
  efficiency?: number;
  hr_avg?: number;
  hr_min?: number;
  score?: number;
  breathing_quality?: number;
};

export const ingestZeppSleep = (ctx: Ctx, input: ZeppSleepInput) => {
  const id = cuid();
  const date = input.endTime.slice(0, 10); // wake day

  ctx.db
    .prepare(
      `INSERT INTO zepp_sleep
        (id, start_time, end_time, date, duration_s, efficiency, light_sleep_s, deep_sleep_s,
         rem_sleep_s, awake_s, hr_avg, hr_min, breathing_quality, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         start_time = excluded.start_time, end_time = excluded.end_time,
         duration_s = excluded.duration_s, efficiency = excluded.efficiency,
         light_sleep_s = excluded.light_sleep_s, deep_sleep_s = excluded.deep_sleep_s,
         rem_sleep_s = excluded.rem_sleep_s, awake_s = excluded.awake_s,
         hr_avg = excluded.hr_avg, hr_min = excluded.hr_min,
         breathing_quality = excluded.breathing_quality, raw_json = excluded.raw_json`,
    )
    .run(
      id,
      input.startTime,
      input.endTime,
      date,
      input.duration_s,
      input.efficiency ?? null,
      input.light_sleep_s ?? null,
      input.deep_sleep_s ?? null,
      input.rem_sleep_s ?? null,
      input.awake_s ?? null,
      input.hr_avg ?? null,
      input.hr_min ?? null,
      input.breathing_quality ?? null,
      JSON.stringify(input),
    );

  // Normalize into wearable_sleep
  ctx.db
    .prepare(
      `INSERT INTO wearable_sleep
        (provider, provider_id, start, "end", duration_s, efficiency_pct, score,
         light_s, deep_s, rem_s, awake_s, respiratory_rate, hr_avg, hr_min, raw_provider_id)
       VALUES ('zepp', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, provider_id) DO UPDATE SET
         start = excluded.start, "end" = excluded.end, duration_s = excluded.duration_s,
         efficiency_pct = excluded.efficiency_pct, score = excluded.score,
         light_s = excluded.light_s, deep_s = excluded.deep_s,
         rem_s = excluded.rem_s, awake_s = excluded.awake_s,
         respiratory_rate = excluded.respiratory_rate,
         hr_avg = excluded.hr_avg, hr_min = excluded.hr_min,
         raw_provider_id = excluded.raw_provider_id`,
    )
    .run(
      id,
      input.startTime,
      input.endTime,
      input.duration_s,
      input.efficiency ?? null,
      input.score ?? null,
      input.light_sleep_s ?? null,
      input.deep_sleep_s ?? null,
      input.rem_sleep_s ?? null,
      input.awake_s ?? null,
      input.breathing_quality ?? null,
      input.hr_avg ?? null,
      input.hr_min ?? null,
      id,
    );

  return { ok: true, id, date };
};

// ── Readiness / recovery ─────────────────────────────────────────────

export type ZeppReadinessInput = {
  date: string; // YYYY-MM-DD
  score?: number;
  hrv_rmssd?: number;
  resting_hr?: number;
  spo2?: number;
  skin_temp?: number;
  stress_level?: number;
};

export const ingestZeppReadiness = (ctx: Ctx, input: ZeppReadinessInput) => {
  const id = cuid();

  ctx.db
    .prepare(
      `INSERT INTO zepp_daily_readiness
        (id, date, score, hrv_rmssd, resting_hr, spo2, skin_temp, stress_level, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         score = excluded.score, hrv_rmssd = excluded.hrv_rmssd,
         resting_hr = excluded.resting_hr, spo2 = excluded.spo2,
         skin_temp = excluded.skin_temp, stress_level = excluded.stress_level,
         raw_json = excluded.raw_json`,
    )
    .run(
      id,
      input.date,
      input.score ?? null,
      input.hrv_rmssd ?? null,
      input.resting_hr ?? null,
      input.spo2 ?? null,
      input.skin_temp ?? null,
      input.stress_level ?? null,
      JSON.stringify(input),
    );

  // Normalize into wearable_readiness
  ctx.db
    .prepare(
      `INSERT INTO wearable_readiness
        (provider, date, score, hrv_rmssd, resting_hr, spo2, skin_temp_delta_c, raw_provider_id)
       VALUES ('zepp', ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, date) DO UPDATE SET
         score = excluded.score, hrv_rmssd = excluded.hrv_rmssd,
         resting_hr = excluded.resting_hr, spo2 = excluded.spo2,
         skin_temp_delta_c = excluded.skin_temp_delta_c,
         raw_provider_id = excluded.raw_provider_id`,
    )
    .run(
      input.date,
      input.score ?? null,
      input.hrv_rmssd ?? null,
      input.resting_hr ?? null,
      input.spo2 ?? null,
      input.skin_temp ?? null,
      id,
    );

  return { ok: true, id, date: input.date };
};

// ── Batch upload ─────────────────────────────────────────────────────
// The watch can push multiple metrics in a single request.

export type ZeppBatchInput = {
  timestamp: number;
  heart_rate?: ZeppHeartRateInput;
  activity?: ZeppActivityInput;
  sleep?: ZeppSleepInput;
  readiness?: ZeppReadinessInput;
};

export const ingestZeppBatch = (ctx: Ctx, input: ZeppBatchInput) => {
  const results: Record<string, unknown> = {};
  if (input.heart_rate) results.heart_rate = ingestZeppHeartRate(ctx, input.heart_rate);
  if (input.activity) results.activity = ingestZeppActivity(ctx, input.activity);
  if (input.sleep) results.sleep = ingestZeppSleep(ctx, input.sleep);
  if (input.readiness) results.readiness = ingestZeppReadiness(ctx, input.readiness);
  return { ok: true, ...results };
};
