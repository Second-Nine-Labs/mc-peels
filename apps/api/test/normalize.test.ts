import { describe, expect, it } from 'vitest';

import { normalizeText, normalizedTerm, tokenize } from '../src/fulfillment/normalize.js';

describe('normalizeText', () => {
  it.each([
    ['Jalapeño Peppers!', 'jalapeno peppers'],
    ['  Multi   space\tand-dash ', 'multi space and dash'],
    ['Crème fraîche', 'creme fraiche'],
    ['2% Milk', '2 milk'],
    ['UPPER lower', 'upper lower'],
  ])('normalizes %j → %j', (input, expected) => {
    expect(normalizeText(input)).toBe(expected);
  });
});

describe('tokenize', () => {
  it('drops stopwords and singularizes', () => {
    expect(tokenize('a dozen of fresh eggs')).toEqual(['dozen', 'egg']);
    expect(tokenize('Organic Bananas')).toEqual(['organic', 'banana']);
  });

  it('keeps short words and ss-endings intact', () => {
    expect(tokenize('gas hiss bass')).toEqual(['gas', 'hiss', 'bass']);
    expect(tokenize('swiss chard')).toEqual(['swiss', 'chard']);
  });

  it('keeps numerals and 3-char tokens as-is', () => {
    expect(tokenize('2 lbs chicken thighs')).toEqual(['2', 'lbs', 'chicken', 'thigh']);
  });
});

describe('normalizedTerm', () => {
  it('is stable across formatting variants of the same phrasing (cache-key property)', () => {
    expect(normalizedTerm('Tortillas — Corn')).toBe(normalizedTerm('  tortilla corn!'));
    expect(normalizedTerm('Tortillas — Corn')).toBe('tortilla corn');
    // Word order is part of the key; 'corn tortilla' caches separately by design.
    expect(normalizedTerm('corn tortilla')).toBe('corn tortilla');
  });
});
