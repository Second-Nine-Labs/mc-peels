import { describe, expect, it } from 'vitest';
import { applyProfile } from '../src/profile/apply.js';
import {
  EMPTY_PROFILE,
  type DietaryProfileRules,
  type ParsedLineItem,
} from '../src/types.js';

function mkItem(overrides: Partial<ParsedLineItem> = {}): ParsedLineItem {
  return {
    name: 'bananas',
    quantity: null,
    unit: null,
    category: 'produce',
    explicitHealthFilters: [],
    explicitBrands: [],
    matchedPreferredBrands: [],
    allergenConflicts: [],
    ...overrides,
  };
}

function mkProfile(overrides: Partial<DietaryProfileRules> = {}): DietaryProfileRules {
  return { ...EMPTY_PROFILE, ...overrides };
}

describe('applyProfile — organic preference (PRD section 8)', () => {
  it('adds ORGANIC to organic-eligible categories only', () => {
    const { resolved } = applyProfile(
      [
        mkItem({ name: 'bananas', category: 'produce' }),
        mkItem({ name: 'ground beef', category: 'meat' }),
        mkItem({ name: 'paper towels', category: 'household' }),
        mkItem({ name: 'olive oil', category: 'pantry' }),
      ],
      mkProfile({ preferOrganic: true }),
    );
    expect(resolved[0]!.appliedFilters.healthFilters).toContain('ORGANIC');
    expect(resolved[1]!.appliedFilters.healthFilters).toContain('ORGANIC');
    expect(resolved[2]!.appliedFilters.healthFilters).not.toContain('ORGANIC');
    expect(resolved[3]!.appliedFilters.healthFilters).not.toContain('ORGANIC');
  });

  it('notes only the items auto-upgraded by preference, not explicit requests', () => {
    const { notes } = applyProfile(
      [
        mkItem({ name: 'bananas', explicitHealthFilters: ['ORGANIC'] }),
        mkItem({ name: 'blueberries' }),
      ],
      mkProfile({ preferOrganic: true }),
    );
    const upgradeNote = notes.find((n) => n.startsWith('Applied household preference'));
    expect(upgradeNote).toBeDefined();
    expect(upgradeNote).toContain('blueberries');
    expect(upgradeNote).not.toContain('bananas');
  });

  it('does not duplicate ORGANIC when explicitly requested and preferred', () => {
    const { resolved, notes } = applyProfile(
      [mkItem({ explicitHealthFilters: ['ORGANIC'] })],
      mkProfile({ preferOrganic: true }),
    );
    const organicCount = resolved[0]!.appliedFilters.healthFilters.filter(
      (f) => f === 'ORGANIC',
    ).length;
    expect(organicCount).toBe(1);
    expect(notes.find((n) => n.startsWith('Applied household preference'))).toBeUndefined();
  });
});

describe('applyProfile — global health filters', () => {
  it('applies every global filter to every item, deduped, with a note', () => {
    const { resolved, notes } = applyProfile(
      [
        mkItem({ name: 'bread', category: 'bakery', explicitHealthFilters: ['GLUTEN_FREE'] }),
        mkItem({ name: 'soda', category: 'beverage' }),
      ],
      mkProfile({ healthFilters: ['GLUTEN_FREE'] }),
    );
    for (const item of resolved) {
      expect(item.appliedFilters.healthFilters.filter((f) => f === 'GLUTEN_FREE')).toHaveLength(1);
    }
    expect(notes).toContain('Applied household filter GLUTEN_FREE to all items.');
  });

  it('emits no global-filter note when there are no items', () => {
    const { notes } = applyProfile([], mkProfile({ healthFilters: ['VEGAN'] }));
    expect(notes).toHaveLength(0);
  });
});

describe('applyProfile — brands', () => {
  it('merges explicit and matched preferred brands, deduped', () => {
    const { resolved, notes } = applyProfile(
      [
        mkItem({
          name: 'yogurt',
          category: 'dairy',
          explicitBrands: ['Stonyfield'],
          matchedPreferredBrands: ['Stonyfield', 'Chobani'],
        }),
      ],
      mkProfile({ preferredBrands: ['Stonyfield', 'Chobani'] }),
    );
    expect(resolved[0]!.appliedFilters.brandFilters).toEqual(['Stonyfield', 'Chobani']);
    // Only the brand the user did NOT explicitly name shows up in the note.
    const brandNote = notes.find((n) => n.startsWith('Applied household preferred brands'));
    expect(brandNote).toContain('Chobani');
    expect(brandNote).not.toContain('Stonyfield');
  });
});

describe('applyProfile — allergen honesty (PRD section 8)', () => {
  it('produces per-item warnings that never over-promise safety', () => {
    const { resolved } = applyProfile(
      [mkItem({ name: 'granola', category: 'pantry', allergenConflicts: ['peanuts'] })],
      mkProfile({ allergens: ['peanuts'] }),
    );
    expect(resolved[0]!.warnings).toHaveLength(1);
    expect(resolved[0]!.warnings[0]).toContain('peanuts');
    expect(resolved[0]!.warnings[0]).toContain('not guarantees');
  });
});

describe('applyProfile — quantities are user-determined (PRD section 6.2)', () => {
  it('passes quantity/unit through untouched, including null', () => {
    const { resolved } = applyProfile(
      [
        mkItem({ name: 'milk', quantity: 2, unit: 'gallon' }),
        mkItem({ name: 'eggs', quantity: null, unit: null }),
      ],
      mkProfile({ preferOrganic: true }),
    );
    expect(resolved[0]!.quantity).toBe(2);
    expect(resolved[0]!.unit).toBe('gallon');
    expect(resolved[1]!.quantity).toBeNull();
    expect(resolved[1]!.unit).toBeNull();
  });
});

describe('applyProfile — display text', () => {
  it('prefixes "Organic " only when applied and not already in the name', () => {
    const { resolved } = applyProfile(
      [
        mkItem({ name: 'bananas' }),
        mkItem({ name: 'organic blueberries' }),
        mkItem({ name: 'paper towels', category: 'household' }),
      ],
      mkProfile({ preferOrganic: true }),
    );
    expect(resolved[0]!.displayText).toBe('Organic Bananas');
    expect(resolved[1]!.displayText).toBe('Organic Blueberries');
    expect(resolved[2]!.displayText).toBe('Paper Towels');
  });

  it('title-cases hyphenated modifiers like grass-fed', () => {
    const { resolved } = applyProfile(
      [mkItem({ name: 'grass-fed beef', category: 'meat' })],
      mkProfile(),
    );
    expect(resolved[0]!.displayText).toBe('Grass-Fed Beef');
  });
});

describe('applyProfile — empty profile', () => {
  it('changes nothing and emits no notes', () => {
    const { resolved, notes } = applyProfile(
      [mkItem({ name: 'bananas' }), mkItem({ name: 'beef', category: 'meat' })],
      mkProfile(),
    );
    expect(notes).toHaveLength(0);
    for (const item of resolved) {
      expect(item.appliedFilters.healthFilters).toHaveLength(0);
      expect(item.appliedFilters.brandFilters).toHaveLength(0);
      expect(item.warnings).toHaveLength(0);
    }
  });
});
