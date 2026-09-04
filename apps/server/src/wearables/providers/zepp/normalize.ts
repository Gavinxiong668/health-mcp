import type {
  NormalizedActivity,
  NormalizedDaily,
  NormalizedReadiness,
  NormalizedSleep,
} from '../../types.js';

// Zepp API response types
// Note: These types are placeholders - update based on actual Zepp API documentation

export type ZeppSleep = {
  id: string;
  start_time: string;
  end_time: string;
  date: string;
  duration_s: number;
  efficiency?: number;
  light_sleep_s?: number;
  deep_sleep_s?: number;
  rem_sleep_s?: number;
  awake_s?: number;
  awake_count?: number;
  hr_avg?: number;
  hr_min?: number;
  hr_max?: number;
  breathing_quality?: number;
  mattress_type?: string;
};

export type ZeppDailyReadiness = {
  id: string;
  date: string;
  score?: number;
  hrv_rmssd?: number;
  resting_hr?: number;
  spo2?: number;
  skin_temp?: number;
  sleep_quality?: number;
  stress_level?: number;
};

export type ZeppDailyActivity = {
  id: string;
  date: string;
  steps?: number;
  active_calories?: number;
  total_calories?: number;
  distance_m?: number;
  floors?: number;
  active_time_min?: number;
  stand_hours?: number;
  hr_avg?: number;
};

export type ZeppWorkout = {
  id: string;
  type: string;
  start_time: string;
  end_time: string;
  duration_s: number;
  calories?: number;
  distance_m?: number;
  elevation_gain_m?: number;
  hr_avg?: number;
  hr_max?: number;
  pace_avg?: number;
  steps?: number;
  sport_type?: string;
};

export type ZeppProfile = {
  user_id: string;
  nickname?: string;
  gender?: string;
  birthday?: string;
  height_cm?: number;
  weight_kg?: number;
  avatar_url?: string;
};

// Normalization functions

export const normalizeZeppSleep = (r: ZeppSleep): NormalizedSleep => ({
  provider: 'zepp',
  provider_id: r.id,
  start: r.start_time,
  end: r.end_time,
  duration_s: r.duration_s,
  efficiency_pct: r.efficiency ?? null,
  light_s: r.light_sleep_s ?? null,
  deep_s: r.deep_sleep_s ?? null,
  rem_s: r.rem_sleep_s ?? null,
  awake_s: r.awake_s ?? null,
  respiratory_rate: r.breathing_quality ?? null, // Map breathing quality to respiratory rate
  hr_avg: r.hr_avg ?? null,
  hr_min: r.hr_min ?? null,
  raw_provider_id: r.id,
});

export const normalizeZeppDailyReadiness = (r: ZeppDailyReadiness): NormalizedReadiness => ({
  provider: 'zepp',
  date: r.date,
  score: r.score ?? null,
  hrv_rmssd: r.hrv_rmssd ?? null,
  resting_hr: r.resting_hr ?? null,
  spo2: r.spo2 ?? null,
  skin_temp_delta_c: r.skin_temp ?? null,
  raw_provider_id: r.id,
});

export const normalizeZeppDailyActivity = (r: ZeppDailyActivity): NormalizedDaily => ({
  provider: 'zepp',
  date: r.date,
  steps: r.steps ?? null,
  kcal_active: r.active_calories ?? null,
  kcal_total: r.total_calories ?? null,
  distance_m: r.distance_m ?? null,
  floors: r.floors ?? null,
  resting_hr: null, // Not available in daily activity
  hr_avg: r.hr_avg ?? null,
  stand_minutes: r.stand_hours ? r.stand_hours * 60 : null,
  raw_provider_id: r.id,
});

export const normalizeZeppWorkout = (r: ZeppWorkout, canonical: string): NormalizedActivity => ({
  provider: 'zepp',
  provider_id: r.id,
  start: r.start_time,
  end: r.end_time,
  duration_s: r.duration_s,
  type: canonical,
  raw_type: r.type ?? r.sport_type ?? 'unknown',
  kcal: r.calories ?? null,
  distance_m: r.distance_m ?? null,
  elevation_gain_m: r.elevation_gain_m ?? null,
  hr_avg: r.hr_avg ?? null,
  hr_max: r.hr_max ?? null,
  raw_provider_id: r.id,
});
