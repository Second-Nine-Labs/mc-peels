/**
 * Deterministic dietary-profile applier (PRD section 8).
 *
 * PURE — no I/O, no environment access, imports only from ../types.
 * Takes the parser's line items plus the household's dietary rules and
 * produces Instacart-ready resolved line items with household-facing notes.
 */

import {
  ORGANIC_ELIGIBLE_CATEGORIES,
  type DietaryProfileRules,
  type HealthFilter,
  type ParsedLineItem,
  type ResolvedLineItem,
} from '../types';

/** Dedupe while preserving first-occurrence order. */
export function dedupe<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** Title-case each whitespace/hyphen/slash-delimited token: "grass-fed beef" -> "Grass-Fed Beef". */
export function titleCase(text: string): string {
  return text.replace(
    /(^|[\s\-/])(\S)/g,
    (_match, boundary: string, ch: string) => boundary + ch.toUpperCase(),
  );
}

/**
 * Allergen honesty (PRD section 8): filters are preference signals, not
 * guarantees. The human review at Instacart checkout is the final safety gate.
 */
export function allergenWarning(allergen: string): string {
  return `May contain ${allergen}. Instacart filters are preferences, not guarantees — please verify at checkout.`;
}

export function applyProfile(
  items: ParsedLineItem[],
  profile: DietaryProfileRules,
): { resolved: ResolvedLineItem[]; notes: string[] } {
  const globalFilters = dedupe(profile.healthFilters);

  /** Item names upgraded to ORGANIC by the household preference (not explicitly requested). */
  const organicUpgradedNames: string[] = [];
  /** Preferred brands that were attached to at least one item (not explicitly requested there). */
  const attachedPreferredBrands: string[] = [];

  const resolved: ResolvedLineItem[] = items.map((item) => {
    // Health filters: explicit first, then preference-driven ORGANIC, then
    // global household filters. Deduped; order stable.
    const explicit = dedupe(item.explicitHealthFilters);
    const healthFilters: HealthFilter[] = [...explicit];

    const organicEligible =
      profile.preferOrganic && ORGANIC_ELIGIBLE_CATEGORIES.has(item.category);
    if (organicEligible && !healthFilters.includes('ORGANIC')) {
      healthFilters.push('ORGANIC');
      // Only note the upgrade when the user did not ask for organic themselves.
      if (!organicUpgradedNames.includes(item.name)) {
        organicUpgradedNames.push(item.name);
      }
    }

    for (const filter of globalFilters) {
      if (!healthFilters.includes(filter)) {
        healthFilters.push(filter);
      }
    }

    // Brand filters: explicit + matched preferred, deduped.
    const brandFilters = dedupe([...item.explicitBrands, ...item.matchedPreferredBrands]);
    for (const brand of item.matchedPreferredBrands) {
      if (!item.explicitBrands.includes(brand) && !attachedPreferredBrands.includes(brand)) {
        attachedPreferredBrands.push(brand);
      }
    }

    const warnings = item.allergenConflicts.map(allergenWarning);

    let displayText = titleCase(item.name);
    if (healthFilters.includes('ORGANIC') && !item.name.toLowerCase().includes('organic')) {
      displayText = `Organic ${displayText}`;
    }

    return {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      displayText,
      source: 'direct_request',
      appliedFilters: { healthFilters, brandFilters },
      warnings,
    };
  });

  // Household-facing notes — only for what the profile changed, never for
  // things the user explicitly asked for.
  const notes: string[] = [];
  if (organicUpgradedNames.length > 0) {
    notes.push(
      `Applied household preference: set ${organicUpgradedNames.join(', ')} to organic.`,
    );
  }
  if (items.length > 0) {
    for (const filter of globalFilters) {
      notes.push(`Applied household filter ${filter} to all items.`);
    }
  }
  if (attachedPreferredBrands.length > 0) {
    notes.push(
      `Applied household preferred brands: ${attachedPreferredBrands.join(', ')}.`,
    );
  }

  return { resolved, notes };
}
