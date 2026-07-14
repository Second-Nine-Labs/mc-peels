/**
 * Fulfillment provider contract — the seam that turns "the Instacart handoff"
 * into "one of several rails" (parallel-rails plan).
 *
 * Two capability axes:
 *   - quote: the provider's API returns real per-store prices we can show
 *     BEFORE handoff. Real prices only — a provider without a price API is
 *     'unpriced', never estimated.
 *   - handoff: 'link' (open a URL; the human shops/pays there) or
 *     'account_cart_push' (we fill the user's cart at the service via their
 *     linked account; the human still reviews and pays there).
 *
 * Checkout is always completed by a human on the service (PRD hard constraint).
 */

import type { Cart, Household, LineItem, OfferItemMatch, OfferStoreRef } from '../db/schema.js';

export type ProviderKey = 'instacart' | 'kroger' | 'doordash' | 'ubereats' | (string & {});

export type HandoffKind = 'link' | 'account_cart_push';

/** Mirrors the offer_status pg enum. */
export type OfferStatusValue = 'pending' | 'quoted' | 'unpriced' | 'failed';

export interface Quote {
  /** seed() may return 'pending' (quote runs later); quote() never does. */
  status: OfferStatusValue;
  store: OfferStoreRef | null;
  /** Items subtotal in cents — never a "total"; taxes/fees belong to the service. */
  subtotalCents: number | null;
  promoSavingsCents: number;
  currency: string;
  matchedCount: number;
  totalCount: number;
  itemMatches: OfferItemMatch[];
  handoffUrl: string | null;
  expiresAt: Date | null;
  notes: string[];
}

export interface QuoteContext {
  household: Household;
  cart: Cart;
  items: LineItem[];
}

export interface FulfillmentProvider {
  key: ProviderKey;
  displayName: string;
  capabilities: { quote: boolean; handoff: HandoffKind };
  /**
   * Instant offer written at cart creation (or lazily for legacy carts).
   * Must not perform external I/O.
   */
  seed(ctx: QuoteContext): Quote;
  /** Real price quote. Only present when capabilities.quote. */
  quote?(ctx: QuoteContext, signal: AbortSignal): Promise<Quote>;
}

/** An empty non-priced quote, the base most seeds build on. */
export function emptyQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    status: 'unpriced',
    store: null,
    subtotalCents: null,
    promoSavingsCents: 0,
    currency: 'USD',
    matchedCount: 0,
    totalCount: 0,
    itemMatches: [],
    handoffUrl: null,
    expiresAt: null,
    notes: [],
    ...overrides,
  };
}
