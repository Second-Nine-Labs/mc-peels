/**
 * Offer orchestration: one row per (cart, provider), seeded instantly at cart
 * creation and refreshed with real quotes on demand.
 *
 * Isolation contract: providers run under Promise.allSettled with their own
 * abort deadline — one rail failing (or Kroger rate-limiting) never touches
 * the others, and never blocks the cart itself.
 */

import { eq } from 'drizzle-orm';

import { getDb } from '../db/client.js';
import * as schema from '../db/schema.js';
import type { CartOffer } from '../db/schema.js';
import { listOffers, quoteToRow } from '../fulfillment/offer-rows.js';
import { enabledProviders } from '../fulfillment/registry.js';
import type { FulfillmentProvider, Quote, QuoteContext } from '../fulfillment/types.js';
import { getAuthorizedCart } from './carts.js';
import { getHouseholdContext } from './households.js';

/** A quote younger than this is returned as-is unless force=true. */
const REQUOTE_GUARD_MS = 5 * 60 * 1000;

/** Per-provider quote deadline — well under Vercel's 30s function budget. */
const PROVIDER_DEADLINE_MS = 8_500;

export interface RefreshOffersOptions {
  /** Restrict the refresh to these provider keys (default: all quoting). */
  providers?: string[];
  /** Ignore the 5-minute guard and re-quote. */
  force?: boolean;
}

async function upsertOffer(
  cartId: string,
  provider: string,
  quote: Quote,
  quotedAt: Date | null,
): Promise<void> {
  const row = quoteToRow(cartId, provider, quote, quotedAt);
  await getDb()
    .insert(schema.cartOffers)
    .values(row)
    .onConflictDoUpdate({
      target: [schema.cartOffers.cartId, schema.cartOffers.provider],
      set: { ...row, updatedAt: new Date() },
    });
}

/** Seed rows for providers that have none yet (legacy carts, new providers). */
async function seedMissing(
  ctx: QuoteContext,
  providers: FulfillmentProvider[],
  existing: Map<string, CartOffer>,
): Promise<void> {
  const missing = providers.filter((p) => !existing.has(p.key));
  if (missing.length === 0) return;
  await getDb()
    .insert(schema.cartOffers)
    .values(missing.map((p) => quoteToRow(ctx.cart.id, p.key, p.seed(ctx), null)))
    .onConflictDoNothing();
}

/** Abort-after-deadline wrapper that also races (belt over suspenders). */
async function withDeadline(
  fn: (signal: AbortSignal) => Promise<Quote>,
  ms: number,
): Promise<Quote> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const attempt = fn(controller.signal);
    // Keep a handler attached so losing the race never leaves an unhandled rejection.
    attempt.catch(() => {});
    return await Promise.race([
      attempt,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('provider deadline')), {
          once: true,
        });
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const FAILED_QUOTE: Omit<Quote, 'notes'> = {
  status: 'failed',
  store: null,
  subtotalCents: null,
  promoSavingsCents: 0,
  currency: 'USD',
  matchedCount: 0,
  totalCount: 0,
  itemMatches: [],
  handoffUrl: null,
  expiresAt: null,
};

export { listOffers } from '../fulfillment/offer-rows.js';

/**
 * Which providers should actually re-quote? Pure so the guard rules are
 * directly testable: quoting capability, an optional provider filter, and a
 * freshness guard (quotes younger than 5 min are kept unless force).
 */
export function selectProvidersToQuote(
  providers: FulfillmentProvider[],
  existing: ReadonlyMap<string, Pick<CartOffer, 'quotedAt'>>,
  opts: RefreshOffersOptions,
  nowMs: number,
): FulfillmentProvider[] {
  const requested = opts.providers?.map((p) => p.toLowerCase());
  return providers.filter((p) => {
    if (!p.capabilities.quote || !p.quote) return false;
    if (requested && !requested.includes(p.key)) return false;
    const current = existing.get(p.key);
    if (
      !opts.force &&
      current?.quotedAt &&
      nowMs - current.quotedAt.getTime() < REQUOTE_GUARD_MS
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Refresh quotes for a cart. Returns null when the cart doesn't exist (or
 * the caller can't see it — getAuthorizedCart throws forbidden for members
 * of other households).
 */
export async function refreshOffers(
  userId: string,
  cartId: string,
  opts: RefreshOffersOptions = {},
): Promise<CartOffer[] | null> {
  const row = await getAuthorizedCart(userId, cartId);
  if (!row) return null;
  const { household } = await getHouseholdContext(userId, row.cart.householdId);
  const items = await getDb()
    .select()
    .from(schema.lineItems)
    .where(eq(schema.lineItems.cartId, cartId));

  const ctx: QuoteContext = { household, cart: row.cart, items };
  const providers = enabledProviders();

  const existingRows = await getDb()
    .select()
    .from(schema.cartOffers)
    .where(eq(schema.cartOffers.cartId, cartId));
  const existing = new Map(existingRows.map((r) => [r.provider, r]));

  await seedMissing(ctx, providers, existing);

  const toQuote = selectProvidersToQuote(providers, existing, opts, Date.now());

  await Promise.allSettled(
    toQuote.map(async (provider) => {
      try {
        const quote = await withDeadline((signal) => provider.quote!(ctx, signal), PROVIDER_DEADLINE_MS);
        await upsertOffer(cartId, provider.key, quote, new Date());
      } catch (err) {
        console.error(`Quote failed for ${provider.key}:`, err);
        await upsertOffer(
          cartId,
          provider.key,
          { ...FAILED_QUOTE, notes: [`${provider.displayName} pricing is unavailable right now — try again.`] },
          new Date(),
        ).catch(() => {});
      }
    }),
  );

  return listOffers(cartId);
}
