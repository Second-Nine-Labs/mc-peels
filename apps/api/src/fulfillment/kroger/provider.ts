/**
 * Kroger fulfillment provider: real per-store price quotes now, cart push at
 * handoff (separate route). Quotes are shelf prices at one named store —
 * surfaced as an items subtotal, never a checkout total.
 *
 * Rate-limit budget (10k product calls/day) is protected by two lazy caches:
 * nearest-store per postal code (30 days) and search candidates per
 * (store, normalized term) (QUOTE_CACHE_TTL_MINUTES, default 6h).
 */

import { and, eq } from 'drizzle-orm';

import { getDb } from '../../db/client.js';
import * as schema from '../../db/schema.js';
import type { LineItem, OfferItemMatch, OfferStoreRef } from '../../db/schema.js';
import { env } from '../../env.js';
import { normalizedTerm } from '../normalize.js';
import type { FulfillmentProvider, Quote, QuoteContext } from '../types.js';
import { emptyQuote } from '../types.js';
import type { KrogerCandidate } from './api-types.js';
import { getKrogerClient, type KrogerClient } from './client.js';
import {
  MAX_ITEMS_PER_QUOTE,
  MIN_TERM_LENGTH,
  buildSearchTerm,
  matchItem,
  rollup,
  toCandidates,
  type MatchableItem,
} from './match.js';

const LOCATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const QUOTE_TTL_MS = 6 * 60 * 60 * 1000;
const SEARCH_CONCURRENCY = 6;

function toMatchable(item: LineItem): MatchableItem {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity === null ? null : Number(item.quantity),
    unit: item.unit,
    healthFilters: item.appliedFilters.health_filters,
    brandFilters: item.appliedFilters.brand_filters,
  };
}

/** Nearest Kroger-family store for a postal code, via the 30-day cache. */
async function resolveStore(
  client: KrogerClient,
  postalCode: string,
  signal: AbortSignal,
): Promise<OfferStoreRef | null> {
  const db = getDb();
  const [cached] = await db
    .select()
    .from(schema.providerLocations)
    .where(
      and(
        eq(schema.providerLocations.provider, 'kroger'),
        eq(schema.providerLocations.postalCode, postalCode),
      ),
    )
    .limit(1);
  if (cached && Date.now() - cached.cachedAt.getTime() < LOCATION_TTL_MS) {
    return cached.store;
  }

  const locations = await client.listLocations(postalCode, 1, signal);
  const nearest = locations[0];
  if (!nearest) return cached?.store ?? null;

  const store: OfferStoreRef = {
    provider_store_id: nearest.locationId,
    name: nearest.name,
    chain: nearest.chain,
    address: [nearest.address?.addressLine1, nearest.address?.city]
      .filter(Boolean)
      .join(', ') || undefined,
  };
  await db
    .insert(schema.providerLocations)
    .values({ provider: 'kroger', postalCode, store })
    .onConflictDoUpdate({
      target: [schema.providerLocations.provider, schema.providerLocations.postalCode],
      set: { store, cachedAt: new Date() },
    });
  return store;
}

/** Search candidates for a term at a store, via the TTL cache. */
async function candidatesFor(
  client: KrogerClient,
  storeId: string,
  term: string,
  signal: AbortSignal,
): Promise<KrogerCandidate[]> {
  const db = getDb();
  const key = normalizedTerm(term);
  const ttlMs = env().QUOTE_CACHE_TTL_MINUTES * 60 * 1000 || QUOTE_TTL_MS;

  const [cached] = await db
    .select()
    .from(schema.providerMatchCache)
    .where(
      and(
        eq(schema.providerMatchCache.provider, 'kroger'),
        eq(schema.providerMatchCache.storeId, storeId),
        eq(schema.providerMatchCache.normalizedTerm, key),
      ),
    )
    .limit(1);
  if (cached && Date.now() - cached.cachedAt.getTime() < ttlMs) {
    return cached.response as KrogerCandidate[];
  }

  const products = await client.searchProducts(term, storeId, 8, signal);
  const candidates = toCandidates(products);
  await db
    .insert(schema.providerMatchCache)
    .values({ provider: 'kroger', storeId, normalizedTerm: key, response: candidates })
    .onConflictDoUpdate({
      target: [
        schema.providerMatchCache.provider,
        schema.providerMatchCache.storeId,
        schema.providerMatchCache.normalizedTerm,
      ],
      set: { response: candidates, cachedAt: new Date() },
    });
  return candidates;
}

/** Run tasks with bounded concurrency, preserving order. */
async function mapWithConcurrency<T, R>(
  inputs: T[],
  limit: number,
  fn: (input: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(inputs.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < inputs.length) {
      const index = next++;
      results[index] = await fn(inputs[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, worker));
  return results;
}

/** An item we could not even search: visibly unpriced, never guessed. */
function unpricedMatch(item: MatchableItem, warning: string): OfferItemMatch {
  return {
    line_item_id: item.id,
    requested_name: item.name,
    requested_quantity: item.quantity,
    requested_unit: item.unit,
    status: 'unpriced',
    confidence: null,
    product: null,
    quantity: 0,
    unit_price_cents: null,
    regular_price_cents: null,
    promo_price_cents: null,
    line_total_cents: null,
    promo_savings_cents: 0,
    warnings: [warning],
  };
}

export function createKrogerProvider(clientOverride?: KrogerClient): FulfillmentProvider {
  return {
    key: 'kroger',
    displayName: 'Kroger',
    capabilities: { quote: true, handoff: 'account_cart_push' },

    seed() {
      return emptyQuote({ status: 'pending' });
    },

    async quote(ctx: QuoteContext, signal: AbortSignal): Promise<Quote> {
      const client = clientOverride ?? getKrogerClient();
      const store = await resolveStore(client, ctx.household.postalCode, signal);
      if (!store) {
        return emptyQuote({
          status: 'failed',
          notes: [`No Kroger-family store found near ${ctx.household.postalCode}.`],
        });
      }

      const notes: string[] = [];
      const all = ctx.items.map(toMatchable);
      const within = all.slice(0, MAX_ITEMS_PER_QUOTE);
      const overflow = all.slice(MAX_ITEMS_PER_QUOTE);
      if (overflow.length > 0) {
        notes.push(`+${overflow.length} more item${overflow.length === 1 ? '' : 's'} not priced.`);
      }

      const matches = await mapWithConcurrency(within, SEARCH_CONCURRENCY, async (item) => {
        const term = buildSearchTerm(item);
        if (term.length < MIN_TERM_LENGTH) {
          return unpricedMatch(item, 'Item name is too short to search on Kroger.');
        }
        try {
          const candidates = await candidatesFor(client, store.provider_store_id, term, signal);
          return matchItem(item, candidates);
        } catch (err) {
          // Deliberate deadline abort → let the orchestrator mark the offer failed.
          if (signal.aborted) throw err;
          return unpricedMatch(item, 'Price lookup failed for this item.');
        }
      });
      matches.push(...overflow.map((item) => unpricedMatch(item, 'Beyond the per-quote item cap.')));

      const totals = rollup(matches);
      if (totals.matchedCount === 0) {
        return emptyQuote({
          status: 'failed',
          store,
          itemMatches: matches,
          totalCount: totals.totalCount,
          notes: [...notes, 'Could not price any items at this store right now.'],
        });
      }

      return {
        status: 'quoted',
        store,
        subtotalCents: totals.subtotalCents,
        promoSavingsCents: totals.promoSavingsCents,
        currency: 'USD',
        matchedCount: totals.matchedCount,
        totalCount: totals.totalCount,
        itemMatches: matches,
        handoffUrl: null,
        expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
        notes,
      };
    },
  };
}
