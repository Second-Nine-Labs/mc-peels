import { describe, expect, it } from 'vitest';
import { buildProductsLinkPayload, withRetailerHint } from '../src/instacart/payload.js';
import type { ResolvedLineItem } from '../src/types.js';

function mkResolved(overrides: Partial<ResolvedLineItem> = {}): ResolvedLineItem {
  return {
    name: 'bananas',
    quantity: null,
    unit: null,
    displayText: 'Organic Bananas',
    source: 'direct_request',
    appliedFilters: { healthFilters: [], brandFilters: [] },
    warnings: [],
    ...overrides,
  };
}

describe('buildProductsLinkPayload', () => {
  it('omits quantity/unit entirely when null (never invents quantities)', () => {
    const payload = buildProductsLinkPayload('Test', [mkResolved()]);
    const item = payload.line_items[0]!;
    expect('quantity' in item).toBe(false);
    expect('unit' in item).toBe(false);
  });

  it('passes through user-stated quantity and unit', () => {
    const payload = buildProductsLinkPayload('Test', [
      mkResolved({ quantity: 2, unit: 'lb' }),
    ]);
    expect(payload.line_items[0]!.quantity).toBe(2);
    expect(payload.line_items[0]!.unit).toBe('lb');
  });

  it('includes filters only when at least one filter array is non-empty', () => {
    const bare = buildProductsLinkPayload('Test', [mkResolved()]);
    expect('filters' in bare.line_items[0]!).toBe(false);

    const filtered = buildProductsLinkPayload('Test', [
      mkResolved({ appliedFilters: { healthFilters: ['ORGANIC'], brandFilters: [] } }),
    ]);
    expect(filtered.line_items[0]!.filters).toEqual({ health_filters: ['ORGANIC'] });
  });

  it('sets link_type shopping_list and maps displayText to display_text', () => {
    const payload = buildProductsLinkPayload('Weekly', [mkResolved()]);
    expect(payload.link_type).toBe('shopping_list');
    expect(payload.title).toBe('Weekly');
    expect(payload.line_items[0]!.display_text).toBe('Organic Bananas');
  });

  it('includes landing page configuration only when a linkback URL is given', () => {
    const without = buildProductsLinkPayload('T', [mkResolved()]);
    expect(without.landing_page_configuration).toBeUndefined();

    const withLinkback = buildProductsLinkPayload('T', [mkResolved()], {
      partnerLinkbackUrl: 'https://mcpeels.app',
    });
    expect(withLinkback.landing_page_configuration).toEqual({
      partner_linkback_url: 'https://mcpeels.app',
    });
  });
});

describe('withRetailerHint', () => {
  it('appends retailer_key to a URL without a query string', () => {
    expect(withRetailerHint('https://instacart.com/list/abc', 'kroger')).toBe(
      'https://instacart.com/list/abc?retailer_key=kroger',
    );
  });

  it('appends retailer_key to a URL with an existing query string', () => {
    const result = withRetailerHint('https://instacart.com/list/abc?aff_id=1', 'kroger');
    expect(result).toContain('aff_id=1');
    expect(result).toContain('retailer_key=kroger');
  });

  it('returns the URL unchanged for a null/undefined key', () => {
    expect(withRetailerHint('https://instacart.com/list/abc', null)).toBe(
      'https://instacart.com/list/abc',
    );
    expect(withRetailerHint('https://instacart.com/list/abc', undefined)).toBe(
      'https://instacart.com/list/abc',
    );
  });

  it('leaves unparseable URLs untouched rather than corrupting them', () => {
    expect(withRetailerHint('not a url', 'kroger')).toBe('not a url');
  });
});
