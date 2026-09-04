import type { Db } from '../../../db/client.js';
import type { ResourceKind, SyncResult } from '../../types.js';
import { ZeppApiError, type ZeppClient } from './client.js';
import {
  type ZeppDailyActivity,
  type ZeppDailyReadiness,
  type ZeppProfile,
  type ZeppSleep,
  type ZeppWorkout,
  normalizeZeppDailyActivity,
  normalizeZeppDailyReadiness,
  normalizeZeppSleep,
  normalizeZeppWorkout,
} from './normalize.js';

type Paginated<T> = { data?: T[]; next_token?: string | null };

const setCursor = (db: Db, resource: string, cursor: string | null): void => {
  db.prepare(
    `INSERT INTO wearable_sync_state (provider, resource, last_synced_at, next_token)
     VALUES ('zepp', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?)
     ON CONFLICT(provider, resource) DO UPDATE SET
       last_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       next_token = excluded.next_token`,
  ).run(resource, cursor);
};

const callWithRefresh = async <T>(
  client: ZeppClient,
  path: string,
  refresh: () => Promise<void>,
): Promise<T> => {
  try {
    return await client.fetchJson<T>(path);
  } catch (err) {
    if (err instanceof ZeppApiError && err.status === 401) {
      await refresh();
      return await client.fetchJson<T>(path);
    }
    throw err;
  }
};

const dateRangeQuery = (since: string | undefined): string => {
  const params = new URLSearchParams();
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const startDate = since
    ? since.slice(0, 10)
    : new Date(today.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  params.set('start_date', startDate);
  params.set('end_date', end);
  return `?${params.toString()}`;
};

export type ZeppRunnerArgs = {
  db: Db;
  client: ZeppClient;
  resource: ResourceKind;
  cursor: string | null;
  since?: string;
  refresh: () => Promise<void>;
};

const runProfile = async (args: ZeppRunnerArgs): Promise<SyncResult> => {
  const data = await callWithRefresh<ZeppProfile>(
    args.client,
    '/v1/user/profile',
    args.refresh,
  );
  args.db
    .prepare(
      `INSERT INTO zepp_profile (id, user_id, nickname, gender, birthday, height_cm, weight_kg, raw_json)
       VALUES (1, @user_id, @nickname, @gender, @birthday, @height_cm, @weight_kg, @raw_json)
       ON CONFLICT(id) DO UPDATE SET
         user_id = excluded.user_id, nickname = excluded.nickname, gender = excluded.gender,
         birthday = excluded.birthday, height_cm = excluded.height_cm, weight_kg = excluded.weight_kg,
         raw_json = excluded.raw_json,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    )
    .run({
      user_id: data.user_id,
      nickname: data.nickname ?? null,
      gender: data.gender ?? null,
      birthday: data.birthday ?? null,
      height_cm: data.height_cm ?? null,
      weight_kg: data.weight_kg ?? null,
      raw_json: JSON.stringify(data),
    });
  setCursor(args.db, 'profile', null);
  return { provider: 'zepp', resource: 'profile', raw_count: 1, normalized_count: 0, done: true };
};

const runSleep = async (args: ZeppRunnerArgs): Promise<SyncResult> => {
  const qs = dateRangeQuery(args.since);
  const data = await callWithRefresh<Paginated<ZeppSleep>>(
    args.client,
    `/v1/user/sleep${qs}`,
    args.refresh,
  );
  const records = data.data ?? [];
  const tx = args.db.transaction((rs: ZeppSleep[]) => {
    const rawIns = args.db.prepare(
      `INSERT INTO zepp_sleep
        (id, start_time, end_time, date, duration_s, efficiency, light_sleep_s, deep_sleep_s,
         rem_sleep_s, awake_s, awake_count, hr_avg, hr_min, hr_max, breathing_quality, raw_json)
       VALUES (@id, @start_time, @end_time, @date, @duration_s, @efficiency, @light_sleep_s,
         @deep_sleep_s, @rem_sleep_s, @awake_s, @awake_count, @hr_avg, @hr_min, @hr_max,
         @breathing_quality, @raw_json)
       ON CONFLICT(id) DO UPDATE SET
         start_time = excluded.start_time, end_time = excluded.end_time, date = excluded.date,
         duration_s = excluded.duration_s, efficiency = excluded.efficiency,
         light_sleep_s = excluded.light_sleep_s, deep_sleep_s = excluded.deep_sleep_s,
         rem_sleep_s = excluded.rem_sleep_s, awake_s = excluded.awake_s,
         awake_count = excluded.awake_count, hr_avg = excluded.hr_avg, hr_min = excluded.hr_min,
         hr_max = excluded.hr_max, breathing_quality = excluded.breathing_quality,
         raw_json = excluded.raw_json`,
    );
    const normIns = args.db.prepare(
      `INSERT INTO wearable_sleep
        (provider, provider_id, start, "end", duration_s, efficiency_pct, light_s, deep_s,
         rem_s, awake_s, respiratory_rate, hr_avg, hr_min, raw_provider_id)
       VALUES (@provider, @provider_id, @start, @end, @duration_s, @efficiency_pct, @light_s,
         @deep_s, @rem_s, @awake_s, @respiratory_rate, @hr_avg, @hr_min, @raw_provider_id)
       ON CONFLICT(provider, provider_id) DO UPDATE SET
         start = excluded.start, "end" = excluded.end, duration_s = excluded.duration_s,
         efficiency_pct = excluded.efficiency_pct, light_s = excluded.light_s,
         deep_s = excluded.deep_s, rem_s = excluded.rem_s, awake_s = excluded.awake_s,
         respiratory_rate = excluded.respiratory_rate, hr_avg = excluded.hr_avg,
         hr_min = excluded.hr_min, raw_provider_id = excluded.raw_provider_id`,
    );
    for (const r of rs) {
      rawIns.run({
        id: r.id,
        start_time: r.start_time,
        end_time: r.end_time,
        date: r.date,
        duration_s: r.duration_s,
        efficiency: r.efficiency ?? null,
        light_sleep_s: r.light_sleep_s ?? null,
        deep_sleep_s: r.deep_sleep_s ?? null,
        rem_sleep_s: r.rem_sleep_s ?? null,
        awake_s: r.awake_s ?? null,
        awake_count: r.awake_count ?? null,
        hr_avg: r.hr_avg ?? null,
        hr_min: r.hr_min ?? null,
        hr_max: r.hr_max ?? null,
        breathing_quality: r.breathing_quality ?? null,
        raw_json: JSON.stringify(r),
      });
      normIns.run(normalizeZeppSleep(r));
    }
  });
  tx(records);
  setCursor(args.db, 'sleep', data.next_token ?? null);
  return {
    provider: 'zepp',
    resource: 'sleep',
    raw_count: records.length,
    normalized_count: records.length,
    next_token: data.next_token ?? null,
    done: !data.next_token,
  };
};

const runDailyReadiness = async (args: ZeppRunnerArgs): Promise<SyncResult> => {
  const qs = dateRangeQuery(args.since);
  const data = await callWithRefresh<Paginated<ZeppDailyReadiness>>(
    args.client,
    `/v1/user/readiness${qs}`,
    args.refresh,
  );
  const records = data.data ?? [];
  const tx = args.db.transaction((rs: ZeppDailyReadiness[]) => {
    const rawIns = args.db.prepare(
      `INSERT INTO zepp_daily_readiness
        (id, date, score, hrv_rmssd, resting_hr, spo2, skin_temp, sleep_quality, stress_level, raw_json)
       VALUES (@id, @date, @score, @hrv_rmssd, @resting_hr, @spo2, @skin_temp, @sleep_quality,
         @stress_level, @raw_json)
       ON CONFLICT(id) DO UPDATE SET
         date = excluded.date, score = excluded.score, hrv_rmssd = excluded.hrv_rmssd,
         resting_hr = excluded.resting_hr, spo2 = excluded.spo2, skin_temp = excluded.skin_temp,
         sleep_quality = excluded.sleep_quality, stress_level = excluded.stress_level,
         raw_json = excluded.raw_json`,
    );
    const normIns = args.db.prepare(
      `INSERT INTO wearable_readiness
        (provider, date, score, hrv_rmssd, resting_hr, spo2, skin_temp_delta_c, raw_provider_id)
       VALUES (@provider, @date, @score, @hrv_rmssd, @resting_hr, @spo2, @skin_temp_delta_c, @raw_provider_id)
       ON CONFLICT(provider, date) DO UPDATE SET
         score = excluded.score, hrv_rmssd = excluded.hrv_rmssd, resting_hr = excluded.resting_hr,
         spo2 = excluded.spo2, skin_temp_delta_c = excluded.skin_temp_delta_c,
         raw_provider_id = excluded.raw_provider_id`,
    );
    for (const r of rs) {
      rawIns.run({
        id: r.id,
        date: r.date,
        score: r.score ?? null,
        hrv_rmssd: r.hrv_rmssd ?? null,
        resting_hr: r.resting_hr ?? null,
        spo2: r.spo2 ?? null,
        skin_temp: r.skin_temp ?? null,
        sleep_quality: r.sleep_quality ?? null,
        stress_level: r.stress_level ?? null,
        raw_json: JSON.stringify(r),
      });
      normIns.run(normalizeZeppDailyReadiness(r));
    }
  });
  tx(records);
  setCursor(args.db, 'readiness', data.next_token ?? null);
  return {
    provider: 'zepp',
    resource: 'readiness',
    raw_count: records.length,
    normalized_count: records.length,
    next_token: data.next_token ?? null,
    done: !data.next_token,
  };
};

const runDailyActivity = async (args: ZeppRunnerArgs): Promise<SyncResult> => {
  const qs = dateRangeQuery(args.since);
  const data = await callWithRefresh<Paginated<ZeppDailyActivity>>(
    args.client,
    `/v1/user/activity/daily${qs}`,
    args.refresh,
  );
  const records = data.data ?? [];
  const tx = args.db.transaction((rs: ZeppDailyActivity[]) => {
    const rawIns = args.db.prepare(
      `INSERT INTO zepp_daily_activity
        (id, date, steps, active_calories, total_calories, distance_m, floors, active_time_min,
         stand_hours, hr_avg, raw_json)
       VALUES (@id, @date, @steps, @active_calories, @total_calories, @distance_m, @floors,
         @active_time_min, @stand_hours, @hr_avg, @raw_json)
       ON CONFLICT(id) DO UPDATE SET
         date = excluded.date, steps = excluded.steps, active_calories = excluded.active_calories,
         total_calories = excluded.total_calories, distance_m = excluded.distance_m,
         floors = excluded.floors, active_time_min = excluded.active_time_min,
         stand_hours = excluded.stand_hours, hr_avg = excluded.hr_avg, raw_json = excluded.raw_json`,
    );
    const normIns = args.db.prepare(
      `INSERT INTO wearable_daily
        (provider, date, steps, kcal_active, kcal_total, distance_m, floors, hr_avg, stand_minutes, raw_provider_id)
       VALUES (@provider, @date, @steps, @kcal_active, @kcal_total, @distance_m, @floors, @hr_avg,
         @stand_minutes, @raw_provider_id)
       ON CONFLICT(provider, date) DO UPDATE SET
         steps = COALESCE(excluded.steps, wearable_daily.steps),
         kcal_active = COALESCE(excluded.kcal_active, wearable_daily.kcal_active),
         kcal_total = COALESCE(excluded.kcal_total, wearable_daily.kcal_total),
         distance_m = COALESCE(excluded.distance_m, wearable_daily.distance_m),
         floors = COALESCE(excluded.floors, wearable_daily.floors),
         hr_avg = COALESCE(excluded.hr_avg, wearable_daily.hr_avg),
         stand_minutes = COALESCE(excluded.stand_minutes, wearable_daily.stand_minutes),
         raw_provider_id = excluded.raw_provider_id`,
    );
    for (const r of rs) {
      rawIns.run({
        id: r.id,
        date: r.date,
        steps: r.steps ?? null,
        active_calories: r.active_calories ?? null,
        total_calories: r.total_calories ?? null,
        distance_m: r.distance_m ?? null,
        floors: r.floors ?? null,
        active_time_min: r.active_time_min ?? null,
        stand_hours: r.stand_hours ?? null,
        hr_avg: r.hr_avg ?? null,
        raw_json: JSON.stringify(r),
      });
      normIns.run(normalizeZeppDailyActivity(r));
    }
  });
  tx(records);
  setCursor(args.db, 'daily', data.next_token ?? null);
  return {
    provider: 'zepp',
    resource: 'daily',
    raw_count: records.length,
    normalized_count: records.length,
    next_token: data.next_token ?? null,
    done: !data.next_token,
  };
};

const runWorkout = async (args: ZeppRunnerArgs): Promise<SyncResult> => {
  const qs = dateRangeQuery(args.since);
  const data = await callWithRefresh<Paginated<ZeppWorkout>>(
    args.client,
    `/v1/user/workout${qs}`,
    args.refresh,
  );
  const records = data.data ?? [];
  const tx = args.db.transaction((rs: ZeppWorkout[]) => {
    const rawIns = args.db.prepare(
      `INSERT INTO zepp_workout
        (id, type, start_time, end_time, duration_s, calories, distance_m, elevation_gain_m,
         hr_avg, hr_max, pace_avg, steps, sport_type, raw_json)
       VALUES (@id, @type, @start_time, @end_time, @duration_s, @calories, @distance_m,
         @elevation_gain_m, @hr_avg, @hr_max, @pace_avg, @steps, @sport_type, @raw_json)
       ON CONFLICT(id) DO UPDATE SET
         type = excluded.type, start_time = excluded.start_time, end_time = excluded.end_time,
         duration_s = excluded.duration_s, calories = excluded.calories, distance_m = excluded.distance_m,
         elevation_gain_m = excluded.elevation_gain_m, hr_avg = excluded.hr_avg, hr_max = excluded.hr_max,
         pace_avg = excluded.pace_avg, steps = excluded.steps, sport_type = excluded.sport_type,
         raw_json = excluded.raw_json`,
    );
    const normIns = args.db.prepare(
      `INSERT INTO wearable_activity
        (provider, provider_id, start, "end", duration_s, type, raw_type, kcal, distance_m,
         elevation_gain_m, hr_avg, hr_max, raw_provider_id)
       VALUES (@provider, @provider_id, @start, @end, @duration_s, @type, @raw_type, @kcal,
         @distance_m, @elevation_gain_m, @hr_avg, @hr_max, @raw_provider_id)
       ON CONFLICT(provider, provider_id) DO UPDATE SET
         start = excluded.start, "end" = excluded.end, duration_s = excluded.duration_s,
         type = excluded.type, raw_type = excluded.raw_type, kcal = excluded.kcal,
         distance_m = excluded.distance_m, elevation_gain_m = excluded.elevation_gain_m,
         hr_avg = excluded.hr_avg, hr_max = excluded.hr_max, raw_provider_id = excluded.raw_provider_id`,
    );
    const lookupCanonical = args.db.prepare(
      `SELECT canonical FROM wearable_activity_type_map
       WHERE (provider = ? AND raw_type = ? COLLATE NOCASE)
          OR (provider = '*' AND raw_type = ? COLLATE NOCASE)
       ORDER BY CASE provider WHEN ? THEN 0 ELSE 1 END LIMIT 1`,
    );
    for (const r of rs) {
      rawIns.run({
        id: r.id,
        type: r.type ?? null,
        start_time: r.start_time,
        end_time: r.end_time,
        duration_s: r.duration_s,
        calories: r.calories ?? null,
        distance_m: r.distance_m ?? null,
        elevation_gain_m: r.elevation_gain_m ?? null,
        hr_avg: r.hr_avg ?? null,
        hr_max: r.hr_max ?? null,
        pace_avg: r.pace_avg ?? null,
        steps: r.steps ?? null,
        sport_type: r.sport_type ?? null,
        raw_json: JSON.stringify(r),
      });
      const rawType = r.type ?? r.sport_type ?? 'unknown';
      const mapped = lookupCanonical.get('zepp', rawType, rawType, 'zepp') as
        | { canonical: string }
        | undefined;
      normIns.run(normalizeZeppWorkout(r, mapped?.canonical ?? 'other'));
    }
  });
  tx(records);
  setCursor(args.db, 'activity', data.next_token ?? null);
  return {
    provider: 'zepp',
    resource: 'activity',
    raw_count: records.length,
    normalized_count: records.length,
    next_token: data.next_token ?? null,
    done: !data.next_token,
  };
};

export const runZeppResource = (args: ZeppRunnerArgs): Promise<SyncResult> => {
  switch (args.resource) {
    case 'profile':
    case 'body':
      return runProfile(args);
    case 'sleep':
      return runSleep(args);
    case 'readiness':
      return runDailyReadiness(args);
    case 'daily':
      return runDailyActivity(args);
    case 'activity':
      return runWorkout(args);
  }
};
