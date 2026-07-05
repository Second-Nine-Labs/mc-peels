/**
 * Domain -> wire (snake_case JSON) mappers, matching docs/api-contract.md.
 */

import type { Household } from '../db/schema.js';
import type { CartDetail, CartSummary } from '../core/carts.js';
import type { DietaryProfileRules, ResolvedLineItem, RetailerInfo } from '../types.js';

export function householdJson(h: Household) {
  return {
    id: h.id,
    name: h.name,
    postal_code: h.postalCode,
    country_code: h.countryCode,
    preferred_retailer_key: h.preferredRetailerKey,
    created_at: h.createdAt.toISOString(),
  };
}

export function profileJson(p: DietaryProfileRules) {
  return {
    prefer_organic: p.preferOrganic,
    preferred_brands: p.preferredBrands,
    excluded_ingredients: p.excludedIngredients,
    allergens: p.allergens,
    health_filters: p.healthFilters,
    notes: p.notes,
  };
}

export function retailerJson(r: RetailerInfo) {
  return {
    retailer_key: r.retailerKey,
    name: r.name,
    retailer_logo_url: r.logoUrl,
  };
}

export function lineItemJson(item: ResolvedLineItem) {
  return {
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    display_text: item.displayText,
    source: item.source,
    applied_filters: {
      health_filters: item.appliedFilters.healthFilters,
      brand_filters: item.appliedFilters.brandFilters,
    },
    warnings: item.warnings,
  };
}

export function cartSummaryJson(c: CartSummary) {
  return {
    id: c.id,
    household_id: c.householdId,
    title: c.title,
    instacart_url: c.instacartUrl,
    retailer_key: c.retailerKey,
    status: c.status,
    request_text: c.requestText,
    created_by_user_id: c.createdByUserId,
    created_at: c.createdAt.toISOString(),
  };
}

export function cartDetailJson(c: CartDetail) {
  return {
    ...cartSummaryJson(c),
    line_items: c.lineItems.map(lineItemJson),
  };
}
