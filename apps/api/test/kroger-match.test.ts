import { describe, expect, it } from 'vitest';

import type { KrogerCandidate, KrogerProduct } from '../src/fulfillment/kroger/api-types.js';
import {
  MAX_ITEMS_PER_QUOTE,
  buildSearchTerm,
  confidenceFor,
  mapQuantity,
  matchItem,
  rankCandidates,
  rollup,
  toCandidates,
  type MatchableItem,
} from '../src/fulfillment/kroger/match.js';

function item(overrides: Partial<MatchableItem> = {}): MatchableItem {
  return {
    id: 'li-1',
    name: 'bananas',
    quantity: null,
    unit: null,
    healthFilters: [],
    brandFilters: [],
    ...overrides,
  };
}

function candidate(overrides: Partial<KrogerCandidate> = {}): KrogerCandidate {
  return {
    product_id: 'p-1',
    upc: '0000000004011',
    brand: 'Kroger',
    description: 'Bananas',
    size: '1 lb',
    sold_by: 'WEIGHT',
    regular_cents: 62,
    promo_cents: null,
    ...overrides,
  };
}

describe('buildSearchTerm', () => {
  it('prepends brand and health words, capped at 8 words', () => {
    expect(
      buildSearchTerm(item({ brandFilters: ['Chobani'], healthFilters: ['ORGANIC'], name: 'greek yogurt' })),
    ).toBe('chobani organic greek yogurt');
    expect(
      buildSearchTerm(
        item({ name: 'one two three four five six seven eight nine ten' }),
      ).split(' '),
    ).toHaveLength(8);
  });
});

describe('toCandidates', () => {
  it('keeps only variants with a real regular price', () => {
    const products: KrogerProduct[] = [
      { productId: 'a', description: 'Bananas', items: [{ price: { regular: 0.62 } }] },
      { productId: 'b', description: 'No price', items: [{}] },
      { productId: 'c', description: 'Zero price', items: [{ price: { regular: 0 } }] },
      { productId: 'd', description: 'No items' },
    ];
    const out = toCandidates(products);
    expect(out.map((c) => c.product_id)).toEqual(['a']);
    expect(out[0]!.regular_cents).toBe(62);
  });

  it('converts dollars to integer cents and drops promo=0', () => {
    const out = toCandidates([
      {
        productId: 'a',
        description: 'Eggs',
        items: [{ price: { regular: 4.79, promo: 0 } }],
      },
    ]);
    expect(out[0]!.regular_cents).toBe(479);
    expect(out[0]!.promo_cents).toBeNull();
  });
});

describe('ranking', () => {
  it('bananas beat banana chips (form-word deny-list)', () => {
    const ranked = rankCandidates(item({ name: 'bananas' }), [
      candidate({ product_id: 'chips', description: 'Banana Chips', regular_cents: 199 }),
      candidate({ product_id: 'fruit', description: 'Bananas', regular_cents: 62 }),
    ]);
    expect(ranked[0]!.candidate.product_id).toBe('fruit');
    // The chips score gets the -0.35 form penalty.
    expect(ranked[1]!.score).toBeLessThan(ranked[0]!.score - 0.3);
  });

  it('respects a requested organic preference both ways', () => {
    const organicWanted = rankCandidates(item({ name: 'bananas', healthFilters: ['ORGANIC'] }), [
      candidate({ product_id: 'plain', description: 'Bananas' }),
      candidate({ product_id: 'org', description: 'Organic Bananas', regular_cents: 89 }),
    ]);
    expect(organicWanted[0]!.candidate.product_id).toBe('org');

    const plainWanted = rankCandidates(item({ name: 'bananas' }), [
      candidate({ product_id: 'org', description: 'Organic Bananas', regular_cents: 89 }),
      candidate({ product_id: 'plain', description: 'Bananas' }),
    ]);
    expect(plainWanted[0]!.candidate.product_id).toBe('plain');
  });

  it('rewards requested brands and penalizes misses', () => {
    const ranked = rankCandidates(item({ name: 'greek yogurt', brandFilters: ['Chobani'] }), [
      candidate({ product_id: 'other', brand: 'Fage', description: 'Greek Yogurt' }),
      candidate({ product_id: 'hit', brand: 'Chobani', description: 'Greek Yogurt' }),
    ]);
    expect(ranked[0]!.candidate.product_id).toBe('hit');
  });

  it('breaks score ties by cheaper effective price, then description', () => {
    const ranked = rankCandidates(item({ name: 'oat milk' }), [
      candidate({ product_id: 'pricey', description: 'Oat Milk', regular_cents: 549 }),
      candidate({ product_id: 'cheap', description: 'Oat Milk', regular_cents: 399 }),
    ]);
    expect(ranked.map((r) => r.candidate.product_id)).toEqual(['cheap', 'pricey']);
  });

  it('is deterministic across input order', () => {
    const pool = [
      candidate({ product_id: 'a', description: 'Oat Milk', regular_cents: 399 }),
      candidate({ product_id: 'b', description: 'Oat Milk Barista Blend', regular_cents: 399 }),
      candidate({ product_id: 'c', description: 'Chocolate Oat Milk Drink', regular_cents: 399 }),
    ];
    const a = rankCandidates(item({ name: 'oat milk' }), pool).map((r) => r.candidate.product_id);
    const b = rankCandidates(item({ name: 'oat milk' }), [...pool].reverse()).map(
      (r) => r.candidate.product_id,
    );
    expect(a).toEqual(b);
  });
});

describe('confidenceFor', () => {
  it('maps score bands', () => {
    expect(confidenceFor(0.9)).toBe('high');
    expect(confidenceFor(0.6)).toBe('medium');
    expect(confidenceFor(0.35)).toBe('low');
    expect(confidenceFor(0.1)).toBeNull();
  });
});

describe('mapQuantity', () => {
  it.each([
    [null, null, 1, 0],
    [2, null, 2, 0],
    [2.5, 'each', 3, 0],
    [3, 'ct', 3, 0],
    [1, 'dozen', 1, 0],
    [2, 'dozen', 2, 0],
  ] as const)('qty %s unit %s → %s (warnings: %s)', (qty, unit, expected, warningCount) => {
    const out = mapQuantity(qty, unit, '12 ct');
    expect(out.quantity).toBe(expected);
    expect(out.warnings).toHaveLength(warningCount);
  });

  it('degrades weight/volume units to 1 with a size warning', () => {
    const out = mapQuantity(2, 'lb', '1 lb');
    expect(out.quantity).toBe(1);
    expect(out.warnings[0]).toContain('confirm the size (1 lb)');
  });

  it('caps runaway each-counts at 20', () => {
    const out = mapQuantity(500, 'each', undefined);
    expect(out.quantity).toBe(20);
    expect(out.warnings[0]).toContain('capped');
  });
});

describe('matchItem + rollup', () => {
  it('produces a priced match with promo math', () => {
    const m = matchItem(item({ name: 'greek yogurt', quantity: 2, unit: 'each' }), [
      candidate({
        product_id: 'yog',
        description: 'Greek Yogurt',
        regular_cents: 129,
        promo_cents: 99,
      }),
    ]);
    expect(m.status).toBe('matched');
    expect(m.quantity).toBe(2);
    expect(m.unit_price_cents).toBe(99);
    expect(m.line_total_cents).toBe(198);
    expect(m.promo_savings_cents).toBe(60);
  });

  it('carries parsed measure fields for unit pricing', () => {
    const m = matchItem(item({ name: 'cheddar cheese' }), [
      candidate({ product_id: 'ch', description: 'Cheddar Cheese', size: '8 oz (227 g)', regular_cents: 499 }),
    ]);
    expect(m.measure_quantity).toBe(8);
    expect(m.measure_unit).toBe('oz');
    // unit_price_cents / measure_quantity = 499/8 ≈ 62.4¢ per oz (client formats).
  });

  it('leaves measure fields null when the size is unparseable', () => {
    const m = matchItem(item({ name: 'gift basket' }), [
      candidate({ product_id: 'gb', description: 'Gift Basket', size: 'assorted', regular_cents: 1999 }),
    ]);
    expect(m.measure_quantity).toBeNull();
    expect(m.measure_unit).toBeNull();
  });

  it('returns no_match below the confidence floor', () => {
    const m = matchItem(item({ name: 'saffron threads' }), [
      candidate({ product_id: 'x', description: 'Chocolate Cake Mix', brand: 'Duncan' }),
    ]);
    expect(m.status).toBe('no_match');
    expect(m.product).toBeNull();
    expect(m.line_total_cents).toBeNull();
  });

  it('rolls up matched lines only — unmatched never affects the subtotal', () => {
    const matched = matchItem(item({ name: 'bananas' }), [candidate()]);
    const unmatched = matchItem(item({ id: 'li-2', name: 'saffron threads' }), []);
    const totals = rollup([matched, unmatched]);
    expect(totals.matchedCount).toBe(1);
    expect(totals.totalCount).toBe(2);
    expect(totals.subtotalCents).toBe(62);
    expect(totals.promoSavingsCents).toBe(0);
  });

  it('exports the per-quote item cap used by the provider', () => {
    expect(MAX_ITEMS_PER_QUOTE).toBe(25);
  });
});
