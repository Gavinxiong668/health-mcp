import { z } from 'zod';
import {
  deleteDialysis,
  getDialysis,
  listDialysis,
  logDialysis,
  updateDialysis,
} from '../../services/dialysis.js';
import { tool } from '../tool-registry.js';

const rangeArgs = z.object({
  date: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export const dialysisTools = [
  tool({
    name: 'log_dialysis',
    description:
      'Record a dialysis session with modality, duration, vascular access, pre/post weights, ultrafiltration, and complications.',
    group: 'dialysis',
    inputSchema: z.object({
      modality: z.enum(['hemodialysis', 'peritoneal', 'hdf', 'hf', 'online_hdf']),
      duration_min: z.number().int().positive().optional(),
      location: z.string().optional(),
      access_type: z.enum(['avf', 'avg', 'cvc', 'pd_catheter', 'other']).optional(),
      access_site: z.string().optional(),
      access_notes: z.string().optional(),
      pre_weight_kg: z.number().positive().optional(),
      post_weight_kg: z.number().positive().optional(),
      dry_weight_kg: z.number().positive().optional(),
      ultrafiltration_ml: z.number().optional(),
      complications: z.array(z.string()).optional(),
      symptoms: z.array(z.string()).optional(),
      complication_notes: z.string().optional(),
      ts: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: (args, ctx) => logDialysis(ctx, args),
  }),
  tool({
    name: 'list_dialysis',
    description: 'List dialysis sessions by date or range.',
    group: 'dialysis',
    inputSchema: rangeArgs,
    handler: (args, ctx) => listDialysis(ctx, args),
  }),
  tool({
    name: 'get_dialysis',
    description: 'Get a single dialysis session by ID.',
    group: 'dialysis',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => getDialysis(ctx, args.id),
  }),
  tool({
    name: 'update_dialysis',
    description: 'Update one or more fields on a dialysis session.',
    group: 'dialysis',
    inputSchema: z.object({
      id: z.string().min(1),
      modality: z.enum(['hemodialysis', 'peritoneal', 'hdf', 'hf', 'online_hdf']).optional(),
      duration_min: z.number().int().positive().nullable().optional(),
      location: z.string().nullable().optional(),
      access_type: z.enum(['avf', 'avg', 'cvc', 'pd_catheter', 'other']).nullable().optional(),
      access_site: z.string().nullable().optional(),
      access_notes: z.string().nullable().optional(),
      pre_weight_kg: z.number().positive().nullable().optional(),
      post_weight_kg: z.number().positive().nullable().optional(),
      dry_weight_kg: z.number().positive().nullable().optional(),
      ultrafiltration_ml: z.number().nullable().optional(),
      complications: z.array(z.string()).nullable().optional(),
      symptoms: z.array(z.string()).nullable().optional(),
      complication_notes: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
    handler: (args, ctx) => updateDialysis(ctx, args),
  }),
  tool({
    name: 'delete_dialysis',
    description: 'Delete a dialysis session.',
    group: 'dialysis',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => deleteDialysis(ctx, args.id),
  }),
];
