import { describe, expect, it } from 'vitest';

import { parseMeasure } from '../src/fulfillment/unit-price.js';

describe('parseMeasure', () => {
  it.each([
    ['1 lb', { quantity: 1, unit: 'lb' }],
    ['6 ct', { quantity: 6, unit: 'ct' }],
    ['20 oz', { quantity: 20, unit: 'oz' }],
    ['1 gal', { quantity: 1, unit: 'gal' }],
    ['8 oz (227 g)', { quantity: 8, unit: 'oz' }], // parenthetical metric ignored
    ['16.9 fl oz', { quantity: 16.9, unit: 'fl oz' }],
    ['12 fl oz', { quantity: 12, unit: 'fl oz' }],
    ['2 liter', { quantity: 2, unit: 'l' }],
    ['500 ml', { quantity: 500, unit: 'ml' }],
    ['3 lbs', { quantity: 3, unit: 'lb' }],
    ['6 pack', { quantity: 6, unit: 'ct' }],
    ['1 each', { quantity: 1, unit: 'ea' }],
    ['each', { quantity: 1, unit: 'ea' }],
  ])('parses %j', (input, expected) => {
    expect(parseMeasure(input)).toEqual(expected);
  });

  it('converts dozen to count (reads better as $/ct)', () => {
    expect(parseMeasure('1 dozen')).toEqual({ quantity: 12, unit: 'ct' });
    expect(parseMeasure('dozen')).toEqual({ quantity: 12, unit: 'ct' });
    expect(parseMeasure('2 dozen')).toEqual({ quantity: 24, unit: 'ct' });
  });

  it('returns null for unparseable or empty sizes (no guessed unit price)', () => {
    expect(parseMeasure(null)).toBeNull();
    expect(parseMeasure(undefined)).toBeNull();
    expect(parseMeasure('')).toBeNull();
    expect(parseMeasure('assorted')).toBeNull();
    expect(parseMeasure('5-7 bananas')).toBeNull();
    expect(parseMeasure('0 oz')).toBeNull(); // zero size can't yield a unit price
  });

  it('is case-insensitive and whitespace-tolerant', () => {
    expect(parseMeasure('  12   OZ  ')).toEqual({ quantity: 12, unit: 'oz' });
    expect(parseMeasure('1 LB')).toEqual({ quantity: 1, unit: 'lb' });
  });
});
