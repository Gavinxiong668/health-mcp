import { z } from 'zod';
import {
  deleteFluidOutput,
  listFluidOutput,
  logFluidOutput,
} from '../../services/fluid-output.js';
import { tool } from '../tool-registry.js';

const rangeArgs = z.object({
  date: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export const fluidOutputTools = [
  tool({
    name: 'log_fluid_output',
    description:
      'Record fluid output (urine, sweat, vomit, drain, stool) in millilitres.',
    group: 'fluid_output',
    inputSchema: z.object({
      kind: z.enum(['urine', 'sweat', 'vomit', 'drain', 'stool', 'other']),
      ml: z.number().int().positive(),
      ts: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: (args, ctx) => logFluidOutput(ctx, args),
  }),
  tool({
    name: 'list_fluid_output',
    description: 'List fluid output entries by date or range.',
    group: 'fluid_output',
    inputSchema: rangeArgs,
    handler: (args, ctx) => listFluidOutput(ctx, args),
  }),
  tool({
    name: 'delete_fluid_output',
    description: 'Delete a fluid output entry.',
    group: 'fluid_output',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => deleteFluidOutput(ctx, args.id),
  }),
];
