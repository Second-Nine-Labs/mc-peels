/**
 * Generated kitchen identities — the household-scoped orchestration on top of
 * the LLM generator (src/ai/kitchen-identity.ts).
 *
 * The Shelf mints kitchens statelessly, but a *name* must be stable: generate
 * once, cache in kitchen_identities, and reuse forever (locked at first open).
 * A per-(household, cuisine) row means each household's Thai kitchen is its own
 * place, named from its own dishes. The hero image generates async on top and
 * writes its URL back to the same row.
 */

import { and, eq } from 'drizzle-orm';

import { generateIdentitySpec } from '../ai/kitchen-identity.js';
import { HOUSE_SEED, assertLegible } from '../ai/legibility.js';
import { getDb, schema } from '../db/client.js';
import type { IdentityPalette, KitchenIdentity } from '../db/schema.js';
import { getHouseholdContext } from './households.js';

export interface KitchenIdentityWire {
  cuisine: string;
  name: string;
  sub: string;
  tagline: string;
  mono: boolean;
  palette: KitchenIdentity['palette'];
  voice: KitchenIdentity['voice'];
  hero_url: string | null;
  hero_status: string;
}

function toWire(row: KitchenIdentity): KitchenIdentityWire {
  return {
    cuisine: row.cuisine,
    name: row.name,
    sub: row.sub,
    tagline: row.tagline,
    mono: row.mono,
    palette: row.palette,
    voice: row.voice,
    hero_url: row.heroUrl,
    hero_status: row.heroStatus,
  };
}

export interface EnsureIdentityInput {
  userId: string;
  householdId?: string;
  cuisine: string;
  cuisineLabel: string;
  dishNames: string[];
}

export interface EnsureIdentityResult {
  identity: KitchenIdentityWire;
  /** True when this call actually minted the row (vs. found a cached one). */
  created: boolean;
  householdId: string;
}

async function findRow(householdId: string, cuisine: string): Promise<KitchenIdentity | undefined> {
  const rows = await getDb()
    .select()
    .from(schema.kitchenIdentities)
    .where(
      and(
        eq(schema.kitchenIdentities.householdId, householdId),
        eq(schema.kitchenIdentities.cuisine, cuisine),
      ),
    )
    .limit(1);
  return rows[0];
}

/**
 * Gate a generated palette seed, falling back to the house palette.
 *
 * Exported for test: the fallback path is the one that must not regress, and
 * it is otherwise only reachable behind a live model call.
 */
export function legiblePaletteOr(
  seed: IdentityPalette,
  cuisine: string,
): IdentityPalette {
  const verdict = assertLegible(seed);
  if (verdict.ok) return seed;

  const detail = verdict.failures
    .map((f) => `${f.pair} ${f.ratio}:1 (need ${f.required})`)
    .join('; ');
  console.warn(
    `[kitchen-identity] rejected illegible palette for "${cuisine}" ` +
      `(mode=${seed.mode} hue=${seed.hue} accentHue=${seed.accentHue}): ${detail}`,
  );
  return HOUSE_SEED;
}

/**
 * Ensure a household's kitchen for `cuisine` has an identity. Returns the
 * cached one if present; otherwise generates, persists, and returns it. The
 * insert is race-safe (onConflictDoNothing → re-read), so two near-simultaneous
 * opens can't mint two names.
 */
export async function ensureKitchenIdentity(
  input: EnsureIdentityInput,
): Promise<EnsureIdentityResult> {
  const ctx = await getHouseholdContext(input.userId, input.householdId);
  const householdId = ctx.household.id;

  const existing = await findRow(householdId, input.cuisine);
  if (existing) return { identity: toWire(existing), created: false, householdId };

  const spec = await generateIdentitySpec({
    cuisine: input.cuisine,
    cuisineLabel: input.cuisineLabel,
    dishNames: input.dishNames,
  });

  // The legibility gate. A generated palette is a *proposal*; it only reaches a
  // screen if every text/surface pair it implies clears AA. On failure the
  // kitchen keeps its generated name and voice — the parts the model is good at
  // — and falls back to the house palette, so a bad seed costs character rather
  // than readability. Logged with the offending pair so it is diagnosable.
  const palette = legiblePaletteOr(spec.palette, input.cuisine);

  const inserted = await getDb()
    .insert(schema.kitchenIdentities)
    .values({
      householdId,
      cuisine: input.cuisine,
      name: spec.name,
      sub: spec.sub,
      tagline: spec.tagline,
      mono: spec.mono,
      palette,
      voice: spec.voice,
      // Undefined when the model's look failed coherence validation; the
      // column stays null and the art pipeline wears the house lock.
      look: spec.look,
      heroStatus: 'none',
    })
    .onConflictDoNothing()
    .returning();

  const row = inserted[0] ?? (await findRow(householdId, input.cuisine));
  if (!row) throw new Error('kitchen identity vanished after insert');
  return { identity: toWire(row), created: Boolean(inserted[0]), householdId };
}

/** Every generated identity the household owns, as a wire list. */
export async function listKitchenIdentities(
  userId: string,
  householdId?: string,
): Promise<KitchenIdentityWire[]> {
  const ctx = await getHouseholdContext(userId, householdId);
  const rows = await getDb()
    .select()
    .from(schema.kitchenIdentities)
    .where(eq(schema.kitchenIdentities.householdId, ctx.household.id));
  return rows.map(toWire);
}
