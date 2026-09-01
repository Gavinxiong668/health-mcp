import type { ZodTypeAny, z } from 'zod';
import type { WearableServiceCtx } from '../services/wearables.js';

export type ToolGroup =
  | 'food'
  | 'intake'
  | 'recipe'
  | 'batch'
  | 'meal'
  | 'hydration'
  | 'weight'
  | 'measurement'
  | 'goal'
  | 'summary'
  | 'biomarker'
  | 'lab'
  | 'wearable'
  | 'whoop'
  | 'blood_pressure'
  | 'dialysis'
  | 'pain'
  | 'medication'
  | 'diary'
  | 'fluid_output'
  | 'discovery'
  | 'system';

export type AnyToolDef = {
  name: string;
  description: string;
  group: ToolGroup;
  inputSchema: ZodTypeAny;
  handler: (input: unknown, ctx: WearableServiceCtx) => Promise<unknown> | unknown;
  isAvailable?: (ctx: WearableServiceCtx) => boolean;
};

export type ToolDef<I extends ZodTypeAny> = {
  name: string;
  description: string;
  group: ToolGroup;
  inputSchema: I;
  handler: (input: z.infer<I>, ctx: WearableServiceCtx) => Promise<unknown> | unknown;
  isAvailable?: (ctx: WearableServiceCtx) => boolean;
};

export const tool = <I extends ZodTypeAny>(def: ToolDef<I>): AnyToolDef =>
  def as unknown as AnyToolDef;
