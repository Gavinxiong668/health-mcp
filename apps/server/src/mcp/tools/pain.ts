import { z } from 'zod';
import { deletePain, listPain, logPain } from '../../services/pain.js';
import { tool } from '../tool-registry.js';

const rangeArgs = z.object({
  date: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export const painTools = [
  tool({
    name: 'log_pain',
    description:
      'Record a pain entry (NRS 0-10) with optional location, type, triggers, and relief methods.',
    group: 'pain',
    inputSchema: z.object({
      score: z.number().int().min(0).max(10),
      location: z.string().optional(),
      type: z.enum(['sharp', 'dull', 'aching', 'burning', 'throbbing', 'stabbing', 'tingling', 'other']).optional(),
      duration_min: z.number().int().positive().optional(),
      triggers: z.array(z.string()).optional(),
      relief_methods: z.array(z.string()).optional(),
      ts: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: (args, ctx) => logPain(ctx, args),
  }),
  tool({
    name: 'list_pain',
    description: 'List pain entries by date or range.',
    group: 'pain',
    inputSchema: rangeArgs,
    handler: (args, ctx) => listPain(ctx, args),
  }),
  tool({
    name: 'delete_pain',
    description: 'Delete a pain entry.',
    group: 'pain',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => deletePain(ctx, args.id),
  }),
];
