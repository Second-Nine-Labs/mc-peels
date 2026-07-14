/**
 * Instacart as a fulfillment rail. The products_link page is still built
 * inside createCart (unchanged, still fatal — see core/carts.ts); this
 * provider just represents that link as an offer row. Instacart's API exposes
 * no prices, so the offer is honestly 'unpriced': the human sees prices on
 * Instacart itself.
 */

import type { FulfillmentProvider } from './types.js';
import { emptyQuote } from './types.js';

export function createInstacartProvider(): FulfillmentProvider {
  return {
    key: 'instacart',
    displayName: 'Instacart',
    capabilities: { quote: false, handoff: 'link' },
    seed(ctx) {
      return emptyQuote({
        status: 'unpriced',
        handoffUrl: ctx.cart.instacartUrl,
        store: ctx.cart.retailerKey
          ? { provider_store_id: ctx.cart.retailerKey, name: prettyRetailer(ctx.cart.retailerKey) }
          : null,
        totalCount: ctx.items.length,
        notes: ['Your list carries over — prices show on Instacart.'],
      });
    },
  };
}

/** "kroger_delivery_now" → "Kroger Delivery Now" (mirrors mobile's prettifier). */
function prettyRetailer(key: string): string {
  return key
    .split(/[_-]/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}
