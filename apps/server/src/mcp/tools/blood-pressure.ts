import { z } from 'zod';
import {
  deleteBloodPressure,
  listBloodPressure,
  logBloodPressure,
} from '../../services/blood-pressure.js';
import { tool } from '../tool-registry.js';

const rangeArgs = z.object({
  date: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export const bloodPressureTools = [
  tool({
    name: 'log_blood_pressure',
    description:
      'Record a blood pressure reading (systolic/diastolic mmHg) with optional pulse, position, and arm.',
    group: 'blood_pressure',
    inputSchema: z.object({
      systolic: z.number().int().min(40).max(300),
      diastolic: z.number().int().min(20).max(200),
      pulse: z.number().int().min(20).max(250).optional(),
      position: z.enum(['sitting', 'standing', 'lying']).optional(),
      arm: z.enum(['left', 'right']).optional(),
      ts: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: (args, ctx) => logBloodPressure(ctx, args),
  }),
  tool({
    name: 'list_blood_pressure',
    description: 'List blood pressure entries by date or range.',
    group: 'blood_pressure',
    inputSchema: rangeArgs,
    handler: (args, ctx) => listBloodPressure(ctx, args),
  }),
  tool({
    name: 'delete_blood_pressure',
    description: 'Delete a blood pressure entry.',
    group: 'blood_pressure',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => deleteBloodPressure(ctx, args.id),
  }),
];
