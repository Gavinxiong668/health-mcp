import { canonicalActivityTypeSchema, wearableResourceSchema } from '@health-mcp/shared';
import { z } from 'zod';
import {
  type WearableServiceCtx,
  setActivityTypeMap,
  syncWearables,
  wearableActivity,
  wearableConnectUrl,
  wearableDaily,
  wearableDisconnect,
  wearableMetricMinutes,
  wearableReadiness,
  wearableSleep,
  wearablesListProviders,
  wearablesStatus,
  whoopBodyMeasurement,
  whoopCycles,
  whoopProfile,
  whoopRecovery,
  whoopSleepRaw,
  whoopWorkoutsRaw,
} from '../../services/wearables.js';
import { tool } from '../tool-registry.js';

const hasAnyWearable = (ctx: WearableServiceCtx): boolean => {
  // OAuth-linked providers (Whoop, Oura, …)
  if (Object.keys(ctx.authStore.list()).length > 0) return true;
  // Push-based providers (Zepp) – check whether any normalised data exists
  try {
    const row = ctx.db
      .prepare(
        "SELECT COUNT(*) AS cnt FROM wearable_daily WHERE provider = 'zepp'",
      )
      .get() as { cnt: number };
    if (row.cnt > 0) return true;
  } catch {
    /* table may not exist yet – ignore */
  }
  return false;
};

const hasWhoop = (ctx: WearableServiceCtx): boolean => Boolean(ctx.authStore.get('whoop'));

export const wearableTools = [
  tool({
    name: 'wearables_list_providers',
    description: 'List supported wearable providers and link status.',
    group: 'wearable',
    inputSchema: z.object({}),
    handler: (_args, ctx) => wearablesListProviders(ctx),
  }),
  tool({
    name: 'wearables_status',
    description: 'Per-linked-provider scope, expiry, last sync per resource.',
    group: 'wearable',
    inputSchema: z.object({}),
    handler: (_args, ctx) => wearablesStatus(ctx),
    isAvailable: hasAnyWearable,
  }),
  tool({
    name: 'wearable_connect_url',
    description: 'Build an OAuth start URL for a provider (HTTP mode only).',
    group: 'wearable',
    inputSchema: z.object({ provider: z.string().min(1) }),
    handler: (args, ctx) => wearableConnectUrl(ctx, args),
  }),
  tool({
    name: 'wearable_disconnect',
    description: 'Remove a provider link.',
    group: 'wearable',
    inputSchema: z.object({ provider: z.string().min(1) }),
    handler: (args, ctx) => wearableDisconnect(ctx, args),
    isAvailable: hasAnyWearable,
  }),
  tool({
    name: 'sync_wearables',
    description:
      'Manually run a sync. By default all linked providers + resources, since last cursor.',
    group: 'wearable',
    inputSchema: z.object({
      providers: z.array(z.string()).optional(),
      resources: z.array(wearableResourceSchema).optional(),
      since: z.string().optional(),
    }),
    handler: (args, ctx) => syncWearables(ctx, args),
    isAvailable: hasAnyWearable,
  }),
  tool({
    name: 'wearable_sleep',
    description: 'Normalized sleep sessions across linked providers.',
    group: 'wearable',
    inputSchema: z.object({
      date: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      providers: z.array(z.string()).optional(),
    }),
    handler: (args, ctx) => wearableSleep(ctx, args),
  }),
  tool({
    name: 'wearable_activity',
    description: 'Normalized workouts/activities across providers.',
    group: 'wearable',
    inputSchema: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
      type: z.string().optional(),
      providers: z.array(z.string()).optional(),
    }),
    handler: (args, ctx) => wearableActivity(ctx, args),
  }),
  tool({
    name: 'wearable_readiness',
    description: 'Daily readiness/recovery score across providers.',
    group: 'wearable',
    inputSchema: z.object({
      date: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      providers: z.array(z.string()).optional(),
    }),
    handler: (args, ctx) => wearableReadiness(ctx, args),
  }),
  tool({
    name: 'wearable_daily',
    description: 'Daily activity totals across providers.',
    group: 'wearable',
    inputSchema: z.object({
      date: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      providers: z.array(z.string()).optional(),
    }),
    handler: (args, ctx) => wearableDaily(ctx, args),
  }),
  tool({
    name: 'wearable_metric_minutes',
    description: 'Minute-resolution metric timeseries (only providers that expose it).',
    group: 'wearable',
    inputSchema: z.object({
      metric: z.string().min(1),
      start: z.string(),
      end: z.string(),
      providers: z.array(z.string()).optional(),
    }),
    handler: (args, ctx) => wearableMetricMinutes(ctx, args),
  }),
  tool({
    name: 'set_activity_type_map',
    description: 'Map a provider raw activity type to a canonical type.',
    group: 'wearable',
    inputSchema: z.object({
      provider: z.string().min(1),
      raw_type: z.string().min(1),
      canonical: canonicalActivityTypeSchema,
    }),
    handler: (args, ctx) => setActivityTypeMap(ctx, args),
  }),

  // Whoop-specific raw reads
  tool({
    name: 'whoop_recovery',
    description: 'Whoop recovery scores (raw).',
    group: 'whoop',
    inputSchema: z.object({
      date: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
    }),
    handler: (args, ctx) => whoopRecovery(ctx, args),
    isAvailable: hasWhoop,
  }),
  tool({
    name: 'whoop_cycles',
    description: 'Whoop physiological cycles (raw).',
    group: 'whoop',
    inputSchema: z.object({ start: z.string().optional(), end: z.string().optional() }),
    handler: (args, ctx) => whoopCycles(ctx, args),
    isAvailable: hasWhoop,
  }),
  tool({
    name: 'whoop_sleep_raw',
    description: 'Whoop sleep with full stage + respiratory breakdown.',
    group: 'whoop',
    inputSchema: z.object({ start: z.string().optional(), end: z.string().optional() }),
    handler: (args, ctx) => whoopSleepRaw(ctx, args),
    isAvailable: hasWhoop,
  }),
  tool({
    name: 'whoop_workouts_raw',
    description: 'Whoop workouts with HR zones, kilojoules, altitude gain.',
    group: 'whoop',
    inputSchema: z.object({ start: z.string().optional(), end: z.string().optional() }),
    handler: (args, ctx) => whoopWorkoutsRaw(ctx, args),
    isAvailable: hasWhoop,
  }),
  tool({
    name: 'whoop_profile',
    description: 'Whoop user profile (raw).',
    group: 'whoop',
    inputSchema: z.object({}),
    handler: (_args, ctx) => whoopProfile(ctx),
    isAvailable: hasWhoop,
  }),
  tool({
    name: 'whoop_body_measurement',
    description: 'Whoop body measurement (raw).',
    group: 'whoop',
    inputSchema: z.object({}),
    handler: (_args, ctx) => whoopBodyMeasurement(ctx),
    isAvailable: hasWhoop,
  }),
];
