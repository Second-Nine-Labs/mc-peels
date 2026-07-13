/**
 * The shelf pipeline: link -> resolve -> extract -> saved recipe.
 *
 * A saved recipe is household-scoped, deduped on its normalized source URL,
 * and stored with ingredients already in cartable shape — so the client can
 * send any selection of saves through the thrift solver into POST /carts
 * without another AI pass.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { RecipeExtractionError, extractRecipe } from '../ai/recipe-extractor.js';
import { getDb, schema } from '../db/client.js';
import type { Recipe } from '../db/schema.js';
import { normalizeSourceUrl, resolveSource } from '../ingest/resolve.js';
import { upstreamError, validationError } from './errors.js';
import { getHouseholdContext } from './households.js';

export interface IngestRecipeInput {
  userId: string;
  /** Optional when the user has a single household (the default case). */
  householdId?: string;
  url: string;
}

export interface IngestRecipeResult {
  recipe: Recipe;
  /** True when this link was already on the shelf — nothing was re-extracted. */
  alreadySaved: boolean;
}

export interface CuisineCount {
  cuisine: string;
  count: number;
}

export interface ShelfListing {
  recipes: Recipe[];
  cuisineCounts: CuisineCount[];
}

const MAX_NOTES = 16;

export async function ingestRecipe(input: IngestRecipeInput): Promise<IngestRecipeResult> {
  const ctx = await getHouseholdContext(input.userId, input.householdId);

  let sourceUrl: string;
  try {
    sourceUrl = normalizeSourceUrl(input.url);
  } catch {
    throw validationError('That does not look like a link MC Peels can read — http(s) URLs only.');
  }

  // Cheap dedupe on the pasted URL before any network or AI work.
  const existing = await findBySourceUrl(ctx.household.id, sourceUrl);
  if (existing) return { recipe: existing, alreadySaved: true };

  const material = await resolveSource(sourceUrl);

  // Short links unfurl; check the final URL too so vm.tiktok.com/x and the
  // full video URL land on the same shelf row.
  let finalUrl = sourceUrl;
  try {
    finalUrl = normalizeSourceUrl(material.url);
  } catch {
    // Keep the pasted URL as the key; the material still describes the page.
  }
  if (finalUrl !== sourceUrl) {
    const unfurled = await findBySourceUrl(ctx.household.id, finalUrl);
    if (unfurled) return { recipe: unfurled, alreadySaved: true };
  }

  let extracted;
  try {
    extracted = await extractRecipe(material);
  } catch (err) {
    if (err instanceof RecipeExtractionError) {
      // Raw Anthropic error details stay server-side (information disclosure).
      console.error('Recipe extraction failure:', err);
      throw upstreamError(
        err.userMessage ?? 'MC Peels could not read that link right now. Please try again.',
      );
    }
    throw err;
  }

  if (!extracted.isRecipe) {
    const reason = extracted.notRecipeReason ?? 'nothing edible was found there';
    throw validationError(`That link does not look like a recipe — ${reason}`);
  }

  const notes = [...extracted.notes, ...material.notes].slice(0, MAX_NOTES);

  const [inserted] = await getDb()
    .insert(schema.recipes)
    .values({
      householdId: ctx.household.id,
      addedByUserId: input.userId,
      sourceUrl: finalUrl,
      sourcePlatform: material.platform,
      creator: extracted.creator ?? material.creator,
      title: extracted.title,
      sub: extracted.sub,
      description: extracted.description.length > 0 ? extracted.description : null,
      cuisine: extracted.cuisine,
      dishType: extracted.dishType,
      serves: extracted.serves,
      minutes: extracted.minutes,
      heat: extracted.heat,
      ingredients: extracted.ingredients,
      steps: extracted.steps,
      provenance: extracted.provenance,
      confidence: extracted.confidence,
      notes,
    })
    .onConflictDoNothing()
    .returning();

  if (!inserted) {
    // Same link raced in twice; the first insert won and that's fine.
    const winner = await findBySourceUrl(ctx.household.id, finalUrl);
    if (winner) return { recipe: winner, alreadySaved: true };
    throw upstreamError('The shelf hiccuped saving that recipe. Please try again.');
  }

  return { recipe: inserted, alreadySaved: false };
}

export async function listRecipes(
  userId: string,
  opts: { householdId?: string; limit?: number } = {},
): Promise<ShelfListing> {
  const ctx = await getHouseholdContext(userId, opts.householdId);
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);

  const recipes = await getDb()
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.householdId, ctx.household.id))
    .orderBy(desc(schema.recipes.createdAt))
    .limit(limit);

  const counts = await getDb()
    .select({
      cuisine: schema.recipes.cuisine,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.recipes)
    .where(eq(schema.recipes.householdId, ctx.household.id))
    .groupBy(schema.recipes.cuisine)
    .orderBy(sql`count(*) desc`);

  return { recipes, cuisineCounts: counts };
}

/** Delete a shelf recipe the user can see. Returns null when it doesn't exist. */
export async function deleteRecipe(userId: string, recipeId: string): Promise<Recipe | null> {
  const rows = await getDb()
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, recipeId))
    .limit(1);
  const recipe = rows[0];
  if (!recipe) return null;
  // Throws forbidden when the user is not a member of the recipe's household.
  await getHouseholdContext(userId, recipe.householdId);
  await getDb().delete(schema.recipes).where(eq(schema.recipes.id, recipeId));
  return recipe;
}

async function findBySourceUrl(householdId: string, sourceUrl: string): Promise<Recipe | null> {
  const rows = await getDb()
    .select()
    .from(schema.recipes)
    .where(and(eq(schema.recipes.householdId, householdId), eq(schema.recipes.sourceUrl, sourceUrl)))
    .limit(1);
  return rows[0] ?? null;
}
