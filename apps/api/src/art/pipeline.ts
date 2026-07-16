/**
 * Lane 2: generate → judge → cache, once per shelf save.
 *
 * Build the cuisine-locked prompt, generate via Nano Banana, grade with the
 * vision judge, upload survivors to the public eats-art bucket, and stamp
 * recipes.art_url. Every failure path degrades to the app's designed
 * fallback tile — bad art is invisible, never broken. Kicked fire-and-forget
 * at ingest and on demand via POST /recipes/:id/art (which is also the
 * reroll: pass force to regenerate over existing art).
 */

import { eq } from 'drizzle-orm';

import { getHouseholdContext } from '../core/households.js';
import { getDb, schema } from '../db/client.js';
import { env } from '../env.js';
import { generateDishImage } from './gemini.js';
import { judgeDishArt } from './judge.js';
import { dishArtPrompt, styleLockForCuisine } from './prompts.js';
import { uploadArt } from './storage.js';

export type EnsureArtStatus = 'ok' | 'exists' | 'failed' | 'unconfigured';

export interface EnsureArtResult {
  status: EnsureArtStatus;
  artUrl: string | null;
  reasons?: string[];
}

/** Skip the retry when the first attempt ate the clock — the whole
 * invocation lives inside Vercel's 30s budget. */
const RETRY_BUDGET_MS = 16_000;
const MAX_ATTEMPTS = 2;
/** Anything smaller is an API dud, not a dish tile. */
const MIN_IMAGE_BYTES = 10_000;

export function artConfigured(): boolean {
  return Boolean(env().GEMINI_API_KEY && env().SUPABASE_SERVICE_ROLE_KEY);
}

export async function ensureRecipeArt(
  recipeId: string,
  opts: { force?: boolean } = {},
): Promise<EnsureArtResult> {
  const rows = await getDb()
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, recipeId))
    .limit(1);
  const recipe = rows[0];
  if (!recipe) return { status: 'failed', artUrl: null, reasons: ['recipe not found'] };
  if (recipe.artUrl && !opts.force) return { status: 'exists', artUrl: recipe.artUrl };
  if (!artConfigured()) return { status: 'unconfigured', artUrl: recipe.artUrl ?? null };

  await setArt(recipeId, { artStatus: 'pending' });

  const prompt = dishArtPrompt({
    title: recipe.title,
    sub: recipe.sub,
    description: recipe.description,
    cuisine: recipe.cuisine,
  });
  const lock = styleLockForCuisine(recipe.cuisine);
  const started = Date.now();
  const reasons: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const image = await generateDishImage(prompt);
      if (image.bytes.length < MIN_IMAGE_BYTES) {
        reasons.push(`attempt ${attempt}: image suspiciously small (${image.bytes.length} bytes)`);
      } else {
        const verdict = await judgeDishArt(
          image,
          { title: recipe.title, description: recipe.description },
          lock.style,
        );
        if (verdict.pass) {
          const extension = image.mimeType === 'image/jpeg' ? 'jpg' : 'png';
          // Timestamped path: rerolls mint a fresh CDN URL instead of fighting caches.
          const artUrl = await uploadArt(
            `recipes/${recipeId}-${Date.now()}.${extension}`,
            image.bytes,
            image.mimeType,
          );
          await setArt(recipeId, { artUrl, artStatus: 'ok' });
          return { status: 'ok', artUrl };
        }
        reasons.push(`attempt ${attempt}: ${verdict.reasons.join('; ') || 'judge failed it'}`);
      }
    } catch (error) {
      reasons.push(`attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (Date.now() - started > RETRY_BUDGET_MS) break;
  }

  // Server-side detail stays server-side; the client only sees 'failed'.
  console.error(`Dish art failed for recipe ${recipeId}:`, reasons);
  await setArt(recipeId, { artStatus: 'failed' });
  return { status: 'failed', artUrl: null, reasons };
}

/** Membership-checked variant for the HTTP surface (mirrors deleteRecipe:
 * throws forbidden for non-members, null for unknown recipes). */
export async function ensureRecipeArtForUser(
  userId: string,
  recipeId: string,
  opts: { force?: boolean } = {},
): Promise<EnsureArtResult | null> {
  const rows = await getDb()
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, recipeId))
    .limit(1);
  const recipe = rows[0];
  if (!recipe) return null;
  await getHouseholdContext(userId, recipe.householdId);
  return ensureRecipeArt(recipeId, opts);
}

async function setArt(
  recipeId: string,
  values: { artUrl?: string; artStatus: string },
): Promise<void> {
  await getDb()
    .update(schema.recipes)
    .set({ ...values, artUpdatedAt: new Date() })
    .where(eq(schema.recipes.id, recipeId));
}
