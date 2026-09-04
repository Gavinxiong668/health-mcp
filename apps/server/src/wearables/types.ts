import type { Db } from '../db/client.js';

export type WearableProviderId =
  | 'whoop'
  | 'oura'
  | 'garmin'
  | 'apple_health'
  | 'fitbit'
  | 'polar'
  | 'zepp'
  | (string & {});

export type ResourceKind = 'sleep' | 'activity' | 'readiness' | 'daily' | 'profile' | 'body';

export type AuthStrategy = 'oauth2' | 'apikey' | 'file_import' | 'manual';

export type TokenSet = {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  scope?: string;
};

export type AuthRecord = {
  strategy: AuthStrategy;
  access_token?: string;
  refresh_token?: string;
  api_key?: string;
  expires_at?: string;
  scope?: string;
  connected_at: string;
  last_refresh_at?: string;
};

export type SyncResult = {
  provider: WearableProviderId;
  resource: ResourceKind;
  raw_count: number;
  normalized_count: number;
  next_token?: string | null;
  done?: boolean;
};

export type NormalizedSleep = {
  provider: WearableProviderId;
  provider_id: string;
  start: string;
  end: string;
  duration_s: number;
  efficiency_pct?: number | null;
  score?: number | null;
  light_s?: number | null;
  deep_s?: number | null;
  rem_s?: number | null;
  awake_s?: number | null;
  respiratory_rate?: number | null;
  hr_avg?: number | null;
  hr_min?: number | null;
  raw_provider_id?: string | null;
};

export type NormalizedActivity = {
  provider: WearableProviderId;
  provider_id: string;
  start: string;
  end: string;
  duration_s: number;
  type: string;
  raw_type: string;
  kcal?: number | null;
  distance_m?: number | null;
  elevation_gain_m?: number | null;
  hr_avg?: number | null;
  hr_max?: number | null;
  strain_or_load?: number | null;
  raw_provider_id?: string | null;
};

export type NormalizedReadiness = {
  provider: WearableProviderId;
  date: string;
  score?: number | null;
  hrv_rmssd?: number | null;
  resting_hr?: number | null;
  spo2?: number | null;
  skin_temp_delta_c?: number | null;
  body_battery?: number | null;
  raw_provider_id?: string | null;
};

export type NormalizedDaily = {
  provider: WearableProviderId;
  date: string;
  steps?: number | null;
  kcal_active?: number | null;
  kcal_total?: number | null;
  distance_m?: number | null;
  floors?: number | null;
  resting_hr?: number | null;
  hr_avg?: number | null;
  hrv_rmssd_avg?: number | null;
  spo2_avg?: number | null;
  stand_minutes?: number | null;
  raw_provider_id?: string | null;
};

export type WearableProvider = {
  id: WearableProviderId;
  displayName: string;
  authStrategy: AuthStrategy;
  scopes?: string[];
  buildAuthUrl?: (state: string, redirectUri: string) => string;
  exchangeCode?: (code: string, redirectUri: string) => Promise<TokenSet>;
  refreshTokens?: (refreshToken: string) => Promise<TokenSet>;
  validateApiKey?: (key: string) => Promise<{ scope?: string }>;
  sync: (args: SyncArgs) => Promise<SyncResult[]>;
  hasMinuteResolution?: boolean;
};

export type SyncArgs = {
  db: Db;
  auth: AuthRecord;
  resources?: ResourceKind[];
  since?: string;
  cursors: Record<string, string | null>;
  tz: string;
  onAuthRefreshed?: (tokens: TokenSet) => Promise<void>;
};
