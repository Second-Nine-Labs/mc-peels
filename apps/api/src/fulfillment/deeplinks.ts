/**
 * Deep-link-only rails: services with no public consumer API (verified
 * 2026-07 — DoorDash's APIs are merchant-side; Uber's consumer API is
 * invite-only early access). We can open their grocery storefront, and we say
 * exactly that — no prices, no pretending the list carries over.
 *
 * One module so link drift is a one-file fix. If Uber early-access lands,
 * ubereats graduates to its own provider file.
 */

import type { FulfillmentProvider } from './types.js';
import { emptyQuote } from './types.js';

const CARRYOVER_NOTE = "Your list doesn't carry over — you'll rebuild it there. Prices at checkout.";

export const DEEPLINK_URLS = {
  doordash: 'https://www.doordash.com/tabs/grocery',
  ubereats: 'https://www.ubereats.com/category/grocery',
} as const;

function deeplinkProvider(
  key: keyof typeof DEEPLINK_URLS,
  displayName: string,
): FulfillmentProvider {
  return {
    key,
    displayName,
    capabilities: { quote: false, handoff: 'link' },
    seed(ctx) {
      return emptyQuote({
        status: 'unpriced',
        handoffUrl: DEEPLINK_URLS[key],
        totalCount: ctx.items.length,
        notes: [CARRYOVER_NOTE],
      });
    },
  };
}

export function createDoorDashProvider(): FulfillmentProvider {
  return deeplinkProvider('doordash', 'DoorDash');
}

export function createUberEatsProvider(): FulfillmentProvider {
  return deeplinkProvider('ubereats', 'Uber Eats');
}
