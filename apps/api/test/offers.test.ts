import { afterEach, describe, expect, it, vi } from 'vitest';

import { selectProvidersToQuote } from '../src/core/offers.js';
import { DEEPLINK_URLS, createDoorDashProvider, createUberEatsProvider } from '../src/fulfillment/deeplinks.js';
import { createInstacartProvider } from '../src/fulfillment/instacart.js';
import type { FulfillmentProvider, QuoteContext } from '../src/fulfillment/types.js';
import { emptyQuote } from '../src/fulfillment/types.js';

function fakeProvider(key: string, quote: boolean): FulfillmentProvider {
  return {
    key,
    displayName: key,
    capabilities: { quote, handoff: 'link' },
    seed: () => emptyQuote(),
    ...(quote ? { quote: async () => emptyQuote({ status: 'quoted' }) } : {}),
  };
}

function ctxWith(items: number, cartOverrides: Record<string, unknown> = {}): QuoteContext {
  return {
    household: { postalCode: '45202' } as QuoteContext['household'],
    cart: {
      id: 'cart-1',
      instacartUrl: 'https://customers.dev.instacart.tools/store/shopping_lists/1',
      retailerKey: 'kroger',
      ...cartOverrides,
    } as unknown as QuoteContext['cart'],
    items: Array.from({ length: items }) as QuoteContext['items'],
  };
}

describe('selectProvidersToQuote', () => {
  const kroger = fakeProvider('kroger', true);
  const instacart = fakeProvider('instacart', false);

  it('only quoting providers qualify', () => {
    expect(selectProvidersToQuote([kroger, instacart], new Map(), {}, Date.now())).toEqual([
      kroger,
    ]);
  });

  it('honors the providers filter (case-insensitive)', () => {
    const walmart = fakeProvider('walmart', true);
    expect(
      selectProvidersToQuote([kroger, walmart], new Map(), { providers: ['KROGER'] }, Date.now()),
    ).toEqual([kroger]);
  });

  it('skips fresh quotes (5-minute guard) unless forced', () => {
    const now = Date.now();
    const fresh = new Map([['kroger', { quotedAt: new Date(now - 60_000) }]]);
    const stale = new Map([['kroger', { quotedAt: new Date(now - 6 * 60_000) }]]);

    expect(selectProvidersToQuote([kroger], fresh, {}, now)).toEqual([]);
    expect(selectProvidersToQuote([kroger], fresh, { force: true }, now)).toEqual([kroger]);
    expect(selectProvidersToQuote([kroger], stale, {}, now)).toEqual([kroger]);
  });

  it('never-quoted rows (quotedAt null) always qualify', () => {
    const seeded = new Map([['kroger', { quotedAt: null }]]);
    expect(selectProvidersToQuote([kroger], seeded, {}, Date.now())).toEqual([kroger]);
  });
});

describe('seed providers', () => {
  it('instacart seed carries the cart link and item count, honestly unpriced', () => {
    const quote = createInstacartProvider().seed(ctxWith(4));
    expect(quote.status).toBe('unpriced');
    expect(quote.handoffUrl).toContain('instacart');
    expect(quote.totalCount).toBe(4);
    expect(quote.subtotalCents).toBeNull();
    expect(quote.store?.name).toBe('Kroger');
  });

  it('instacart seed tolerates a missing retailer', () => {
    const quote = createInstacartProvider().seed(ctxWith(2, { retailerKey: null }));
    expect(quote.store).toBeNull();
  });

  it('deeplink seeds say the list does not carry over and never claim prices', () => {
    for (const factory of [createDoorDashProvider, createUberEatsProvider]) {
      const provider = factory();
      const quote = provider.seed(ctxWith(3));
      expect(quote.status).toBe('unpriced');
      expect(quote.subtotalCents).toBeNull();
      expect(quote.handoffUrl).toBe(DEEPLINK_URLS[provider.key as keyof typeof DEEPLINK_URLS]);
      expect(quote.notes[0]).toContain("doesn't carry over");
    }
  });

  it('deeplink URLs point at the grocery verticals', () => {
    expect(DEEPLINK_URLS.doordash).toBe('https://www.doordash.com/tabs/grocery');
    expect(DEEPLINK_URLS.ubereats).toBe('https://www.ubereats.com/category/grocery');
  });
});

describe('registry', () => {
  afterEach(() => {
    delete process.env.FULFILLMENT_PROVIDERS;
  });

  it('csv order and unknown-key skipping', async () => {
    // env() memoizes; import fresh registry against a fresh env module.
    process.env.FULFILLMENT_PROVIDERS = 'doordash,instacart,flyingsaucer';
    process.env.DATABASE_URL = 'postgres://test';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.ANTHROPIC_API_KEY = 'test';
    process.env.INSTACART_API_KEY = 'test';
    const { enabledProviders } = await freshRegistry();
    expect(enabledProviders().map((p) => p.key)).toEqual(['doordash', 'instacart']);
  });

  it('kroger is skipped until its env vars exist', async () => {
    process.env.FULFILLMENT_PROVIDERS = 'instacart,kroger';
    process.env.DATABASE_URL = 'postgres://test';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.ANTHROPIC_API_KEY = 'test';
    process.env.INSTACART_API_KEY = 'test';
    delete process.env.KROGER_CLIENT_ID;
    const { enabledProviders } = await freshRegistry();
    expect(enabledProviders().map((p) => p.key)).toEqual(['instacart']);
  });
});

/** Import registry+env with a cleared module cache so env() re-parses. */
async function freshRegistry() {
  vi.resetModules();
  return import('../src/fulfillment/registry.js');
}
