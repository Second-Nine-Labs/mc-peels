/**
 * Domain -> wire (snake_case JSON) mappers, matching docs/api-contract.md.
 */

import type { CartOffer, Household, Recipe } from '../db/schema.js';
import type { CartDetail, CartSummary } from '../core/carts.js';
import type { StarterDish } from '../core/starters.js';
import { providerMeta } from '../fulfillment/registry.js';
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
    offers: c.offers.map(offerJson),
  };
}

export function offerJson(o: CartOffer) {
  const meta = providerMeta(o.provider);
  return {
    id: o.id,
    provider: o.provider,
    display_name: meta.displayName,
    capabilities: meta.capabilities,
    status: o.status,
    handoff_url: o.handoffUrl,
    store: o.store,
    subtotal_cents: o.subtotalCents,
    promo_savings_cents: o.promoSavingsCents,
    currency: o.currency,
    matched_count: o.matchedCount,
    total_count: o.totalCount,
    item_matches: o.itemMatches,
    notes: o.notes,
    quoted_at: o.quotedAt?.toISOString() ?? null,
    expires_at: o.expiresAt?.toISOString() ?? null,
  };
}

export function starterJson(s: StarterDish) {
  return {
    id: s.id,
    title: s.title,
    sub: s.sub,
    description: s.description,
    cuisine: s.cuisine,
    dish_type: s.dishType,
    serves: s.serves,
    minutes: s.minutes,
    heat: s.heat,
    ingredients: s.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity ?? null,
      unit: i.unit ?? null,
      pantry: i.pantry === true,
    })),
    steps: s.steps,
  };
}

export function recipeJson(r: Recipe) {
  return {
    id: r.id,
    household_id: r.householdId,
    source_url: r.sourceUrl,
    source_platform: r.sourcePlatform,
    creator: r.creator,
    title: r.title,
    sub: r.sub,
    description: r.description,
    cuisine: r.cuisine,
    dish_type: r.dishType,
    serves: r.serves,
    minutes: r.minutes,
    heat: r.heat,
    ingredients: r.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity ?? null,
      unit: i.unit ?? null,
      pantry: i.pantry === true,
    })),
    steps: r.steps,
    provenance: r.provenance,
    confidence: r.confidence,
    notes: r.notes,
    created_at: r.createdAt.toISOString(),
  };
}
