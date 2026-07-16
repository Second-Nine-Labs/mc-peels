/**
 * Generated dish art: generate → judge → cache. One engine, every kitchen.
 *
 * The core (`generateJudgeUpload`) is restaurant-agnostic — it takes a dish
 * descriptor + a style key and returns a cached URL or nothing. Two entry
 * points feed it:
 *   · ensureRecipeArt      — shelf-minted kitchens, keyed by the recipe row,
 *                            remembered in recipes.art_url (kicked at ingest).
 *   · ensureKitchenDishArt — the static trio (Столовая / greenhouse / La
 *                            Milpa), keyed by (kitchenId, dishId), remembered
 *                            by the bucket itself (no table).
 *
 * Every failure path degrades to the app's designed fallback tile — bad art
 * is invisible, never broken.
 */

import { eq } from 'drizzle-orm';

import { getHouseholdContext } from '../core/households.js';
import { getDb, schema } from '../db/client.js';
import { env } from '../env.js';
import { generateDishImage } from './gemini.js';
import { judgeDishArt } from './judge.js';
import { dishArtPrompt, styleLock } from './prompts.js';
import { listKitchenArt, uploadArt } from './storage.js';

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

interface Descriptor {
  title: string;
  sub?: string | null;
  description?: string | null;
}

/** The shared engine: prompt → generate → judge → upload, with one reroll.
 * Returns 'ok' + url or 'failed' + reasons; callers own the bookkeeping. */
async function generateJudgeUpload(
  descriptor: Descriptor,
  styleKey: string,
  storagePathBase: string,
): Promise<{ status: 'ok' | 'failed'; artUrl: string | null; reasons: string[] }> {
  const prompt = dishArtPrompt({ ...descriptor, styleKey });
  const lock = styleLock(styleKey);
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
          { title: descriptor.title, description: descriptor.description },
          lock.style,
        );
        if (verdict.pass) {
          const extension = image.mimeType === 'image/jpeg' ? 'jpg' : 'png';
          // Timestamped path: rerolls mint a fresh CDN URL instead of fighting caches.
          const artUrl = await uploadArt(
            `${storagePathBase}-${Date.now()}.${extension}`,
            image.bytes,
            image.mimeType,
          );
          return { status: 'ok', artUrl, reasons };
        }
        reasons.push(`attempt ${attempt}: ${verdict.reasons.join('; ') || 'judge failed it'}`);
      }
    } catch (error) {
      reasons.push(`attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (Date.now() - started > RETRY_BUDGET_MS) break;
  }
  return { status: 'failed', artUrl: null, reasons };
}

// ---------------------------------------------------------------------------
// Shelf-minted kitchens — keyed by the recipe row.

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

  await setRecipeArt(recipeId, { artStatus: 'pending' });

  const result = await generateJudgeUpload(
    { title: recipe.title, sub: recipe.sub, description: recipe.description },
    recipe.cuisine,
    `recipes/${recipeId}`,
  );

  if (result.status === 'ok' && result.artUrl) {
    await setRecipeArt(recipeId, { artUrl: result.artUrl, artStatus: 'ok' });
    return { status: 'ok', artUrl: result.artUrl };
  }
  // Server-side detail stays server-side; the client only ever sees 'failed'.
  console.error(`Dish art failed for recipe ${recipeId}:`, result.reasons);
  await setRecipeArt(recipeId, { artStatus: 'failed' });
  return { status: 'failed', artUrl: null, reasons: result.reasons };
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

async function setRecipeArt(
  recipeId: string,
  values: { artUrl?: string; artStatus: string },
): Promise<void> {
  await getDb()
    .update(schema.recipes)
    .set({ ...values, artUpdatedAt: new Date() })
    .where(eq(schema.recipes.id, recipeId));
}

// ---------------------------------------------------------------------------
// The static trio — keyed by (kitchenId, dishId); the bucket is the record.

/** Slugs only — these land in a storage path, so keep them traversal-safe. */
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export function isArtSlug(value: string): boolean {
  return SLUG.test(value) && value.length <= 80;
}

/** Cached art for one kitchen: `{ dishId: url }`. Empty (never throws) when
 * art isn't configured, so the GET route always degrades cleanly. */
export async function kitchenArtMap(kitchenId: string): Promise<Record<string, string>> {
  if (!artConfigured()) return {};
  return listKitchenArt(kitchenId);
}

/**
 * Ensure art for one static-trio dish. The client supplies the descriptor
 * (the server has no static menu). Idempotent: skips generation when a tile
 * already exists unless `force` (the reroll).
 */
export async function ensureKitchenDishArt(
  kitchenId: string,
  dishId: string,
  descriptor: Descriptor,
  opts: { force?: boolean } = {},
): Promise<EnsureArtResult> {
  if (!artConfigured()) return { status: 'unconfigured', artUrl: null };

  if (!opts.force) {
    const existing = (await listKitchenArt(kitchenId))[dishId];
    if (existing) return { status: 'exists', artUrl: existing };
  }

  const result = await generateJudgeUpload(descriptor, kitchenId, `kitchens/${kitchenId}/${dishId}`);
  if (result.status === 'ok' && result.artUrl) {
    return { status: 'ok', artUrl: result.artUrl };
  }
  console.error(`Dish art failed for ${kitchenId}/${dishId}:`, result.reasons);
  return { status: 'failed', artUrl: null, reasons: result.reasons };
}
