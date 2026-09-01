import { z } from 'zod';
import { deleteDiary, listDiary, logDiary } from '../../services/diary.js';
import { tool } from '../tool-registry.js';

const rangeArgs = z.object({
  date: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export const diaryTools = [
  tool({
    name: 'log_diary',
    description:
      'Record a diary entry with mood, energy, sleep quality, appetite (1-5 scale), symptoms, and notes.',
    group: 'diary',
    inputSchema: z.object({
      mood: z.number().int().min(1).max(5).optional(),
      energy: z.number().int().min(1).max(5).optional(),
      sleep_quality: z.number().int().min(1).max(5).optional(),
      appetite: z.number().int().min(1).max(5).optional(),
      symptoms: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      ts: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: (args, ctx) => logDiary(ctx, args),
  }),
  tool({
    name: 'list_diary',
    description: 'List diary entries by date or range.',
    group: 'diary',
    inputSchema: rangeArgs,
    handler: (args, ctx) => listDiary(ctx, args),
  }),
  tool({
    name: 'delete_diary',
    description: 'Delete a diary entry.',
    group: 'diary',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => deleteDiary(ctx, args.id),
  }),
];
