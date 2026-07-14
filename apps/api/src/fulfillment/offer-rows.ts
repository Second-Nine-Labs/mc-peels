/**
 * Quote → cart_offers row mapping, shared by the seeding path (inside the
 * cart-creation transaction) and the refresh path (core/offers.ts). Lives in
 * the fulfillment layer so core/carts.ts and core/offers.ts never import
 * each other's seeding logic (no module cycle).
 */

import { eq } from 'drizzle-orm';

import { getDb } from '../db/client.js';
import * as schema from '../db/schema.js';
import type { Cart, CartOffer, Household, LineItem } from '../db/schema.js';
import { enabledProviders } from './registry.js';
import type { Quote, QuoteContext } from './types.js';

export interface OfferRowValues {
  cartId: string;
  provider: string;
  status: Quote['status'];
  handoffUrl: string | null;
  store: Quote['store'];
  subtotalCents: number | null;
  promoSavingsCents: number;
  currency: string;
  matchedCount: number;
  totalCount: number;
  itemMatches: Quote['itemMatches'];
  notes: string[];
  quotedAt: Date | null;
  expiresAt: Date | null;
}

export function quoteToRow(
  cartId: string,
  provider: string,
  quote: Quote,
  quotedAt: Date | null,
): OfferRowValues {
  return {
    cartId,
    provider,
    status: quote.status,
    handoffUrl: quote.handoffUrl,
    store: quote.store,
    subtotalCents: quote.subtotalCents,
    promoSavingsCents: quote.promoSavingsCents,
    currency: quote.currency,
    matchedCount: quote.matchedCount,
    totalCount: quote.totalCount,
    itemMatches: quote.itemMatches,
    notes: quote.notes,
    quotedAt,
    expiresAt: quote.expiresAt,
  };
}

/** Seed rows for a fresh cart — static data only, safe inside the transaction. */
export function seedRowsForNewCart(
  household: Household,
  cart: Cart,
  items: LineItem[],
): OfferRowValues[] {
  const ctx: QuoteContext = { household, cart, items };
  return enabledProviders().map((p) => quoteToRow(cart.id, p.key, p.seed(ctx), null));
}

/**
 * Offers for a cart, restricted to enabled providers and sorted in csv order.
 * Rows for since-disabled providers stay in the table but out of responses —
 * that's the server-side kill switch behaving.
 */
export async function listOffers(cartId: string): Promise<CartOffer[]> {
  const order = new Map(enabledProviders().map((p, i) => [p.key, i]));
  const rows = await getDb()
    .select()
    .from(schema.cartOffers)
    .where(eq(schema.cartOffers.cartId, cartId));
  return rows
    .filter((r) => order.has(r.provider))
    .sort((a, b) => order.get(a.provider)! - order.get(b.provider)!);
}
