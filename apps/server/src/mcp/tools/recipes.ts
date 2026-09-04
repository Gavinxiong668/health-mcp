import { z } from 'zod';
import {
  archiveBatch,
  createBatch,
  createRecipe,
  deleteBatch,
  deleteRecipe,
  getBatch,
  getRecipe,
  listBatches,
  listRecipes,
  updateRecipe,
} from '../../services/recipes.js';
import { tool } from '../tool-registry.js';

const ingredientSchema = z
  .object({
    food_id: z.string().min(1).optional(),
    free_text_name: z.string().min(1).optional(),
    grams: z.number().positive(),
    notes: z.string().optional(),
  })
  .refine((v) => Boolean(v.food_id) !== Boolean(v.free_text_name), {
    message: 'exactly one of food_id or free_text_name required',
  });

export const recipeTools = [
  tool({
    name: 'create_recipe',
    description: 'Create a recipe with N servings and a list of food/grams ingredients.',
    group: 'recipe',
    inputSchema: z.object({
      name: z.string().min(1),
      servings: z.number().positive(),
      notes: z.string().optional(),
      ingredients: z.array(ingredientSchema).min(1),
    }),
    handler: (args, ctx) => createRecipe(ctx, args),
  }),
  tool({
    name: 'update_recipe',
    description: 'Update recipe metadata and/or replace its full ingredient list.',
    group: 'recipe',
    inputSchema: z.object({
      id: z.string().min(1),
      name: z.string().optional(),
      servings: z.number().positive().optional(),
      notes: z.string().nullable().optional(),
      ingredients: z.array(ingredientSchema).optional(),
    }),
    handler: (args, ctx) => updateRecipe(ctx, args),
  }),
  tool({
    name: 'delete_recipe',
    description: 'Delete a recipe (cascades to ingredients).',
    group: 'recipe',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => deleteRecipe(ctx, args.id),
  }),
  tool({
    name: 'list_recipes',
    description: 'List recipes by name match.',
    group: 'recipe',
    inputSchema: z.object({
      query: z.string().optional(),
      limit: z.number().int().positive().max(200).optional(),
    }),
    handler: (args, ctx) => listRecipes(ctx, args),
  }),
  tool({
    name: 'get_recipe',
    description: 'Fetch a recipe with ingredients and computed per-recipe + per-serving macros.',
    group: 'recipe',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => getRecipe(ctx, args.id),
  }),
  tool({
    name: 'create_batch',
    description:
      'Record a cooked batch or log food intake. Provide food_id + total_grams to record eating a food directly (set consumed_grams equal to total_grams to consume immediately). Or reference a recipe. Or pass ingredients_override.',
    group: 'batch',
    inputSchema: z
      .object({
        name: z.string().optional(),
        recipe_id: z.string().min(1).optional(),
        food_id: z.string().min(1).optional(),
        total_grams: z.number().positive(),
        consumed_grams: z.number().positive().optional(),
        ingredients_override: z.array(ingredientSchema).optional(),
        cooked_at: z.string().optional(),
        expires_at: z.string().optional(),
        notes: z.string().optional(),
      })
      .refine(
        (v) => Boolean(v.recipe_id) || Boolean(v.ingredients_override) || Boolean(v.food_id),
        { message: 'one of recipe_id, food_id, or ingredients_override required' },
      ),
    handler: (args, ctx) => createBatch(ctx, args),
  }),
  tool({
    name: 'list_batches',
    description:
      'List batches. active_only=true returns batches with remaining_grams > 0 and not archived.',
    group: 'batch',
    inputSchema: z.object({ active_only: z.boolean().optional() }),
    handler: (args, ctx) => listBatches(ctx, args),
  }),
  tool({
    name: 'get_batch',
    description: 'Fetch a batch.',
    group: 'batch',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => getBatch(ctx, args.id),
  }),
  tool({
    name: 'archive_batch',
    description: 'Archive a batch so it stops appearing in active lists.',
    group: 'batch',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => archiveBatch(ctx, args.id),
  }),
  tool({
    name: 'delete_batch',
    description: 'Delete a batch.',
    group: 'batch',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => deleteBatch(ctx, args.id),
  }),
];
