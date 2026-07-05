/**
 * Shared domain types for the MC Peels core pipeline (PRD sections 6-8).
 *
 * These are the contracts between the NL parser, the dietary-profile applier,
 * the Instacart wrapper, the core pipeline, and both front doors (REST + MCP).
 */

/** Instacart-supported health filters, verified against live docs 2026-07. */
export const HEALTH_FILTERS = [
  'ORGANIC',
  'GLUTEN_FREE',
  'FAT_FREE',
  'VEGAN',
  'KOSHER',
  'SUGAR_FREE',
  'LOW_FAT',
] as const;
export type HealthFilter = (typeof HEALTH_FILTERS)[number];

export const ITEM_CATEGORIES = [
  'produce',
  'meat',
  'seafood',
  'dairy',
  'eggs',
  'bakery',
  'pantry',
  'frozen',
  'beverage',
  'snack',
  'household',
  'personal_care',
  'other',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

/** Categories where an "prefer organic" household preference is meaningfully applicable. */
export const ORGANIC_ELIGIBLE_CATEGORIES: ReadonlySet<ItemCategory> = new Set([
  'produce',
  'meat',
  'seafood',
  'dairy',
  'eggs',
  'frozen',
]);

/**
 * Output of the NL parser (Anthropic) for a single item.
 * Quantities are user-determined: null unless the user stated one (PRD section 6.2).
 */
export interface ParsedLineItem {
  /** Clean product name used for Instacart search matching, e.g. "bananas". */
  name: string;
  /** Only if the user stated one. Never invented. */
  quantity: number | null;
  /** Only if the user stated one (e.g. "lb", "each"). */
  unit: string | null;
  category: ItemCategory;
  /** Health filters the user explicitly asked for on this item ("organic bananas" -> ORGANIC). */
  explicitHealthFilters: HealthFilter[];
  /** Brands the user explicitly named on this item. */
  explicitBrands: string[];
  /**
   * Household preferred brands that plausibly apply to this item
   * (parser judgment; e.g. a dairy brand is not matched to bananas).
   */
  matchedPreferredBrands: string[];
  /**
   * Household allergens / excluded ingredients this item likely contains.
   * Surfaced as warnings — never treated as a safety guarantee (PRD section 8).
   */
  allergenConflicts: string[];
}

export interface ParseResult {
  items: ParsedLineItem[];
  /** Parser-level notes, e.g. parts of the request it could not interpret. */
  notes: string[];
}

/** Structured dietary rules for a household (PRD section 8). */
export interface DietaryProfileRules {
  preferOrganic: boolean;
  preferredBrands: string[];
  excludedIngredients: string[];
  allergens: string[];
  /** Additional Instacart health filters the household applies globally. */
  healthFilters: HealthFilter[];
  notes: string | null;
}

export const EMPTY_PROFILE: DietaryProfileRules = {
  preferOrganic: false,
  preferredBrands: [],
  excludedIngredients: [],
  allergens: [],
  healthFilters: [],
  notes: null,
};

/** A line item after the dietary profile has been applied — ready for Instacart. */
export interface ResolvedLineItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  /** Human-readable line, e.g. "Organic Bananas" — shown in-app and on Instacart. */
  displayText: string;
  source: 'direct_request';
  appliedFilters: {
    healthFilters: HealthFilter[];
    brandFilters: string[];
  };
  /** e.g. "may conflict with household allergen: peanuts" */
  warnings: string[];
}

export interface RetailerInfo {
  retailerKey: string;
  name: string;
  logoUrl: string | null;
}

export interface CreateCartInput {
  /** Optional when the user has a single household (the default case). */
  householdId?: string;
  userId: string;
  channel: 'app' | 'mcp';
  /** Free-text request. Exactly one of requestText / lineItems must be provided. */
  requestText?: string;
  /** Pre-structured items (MCP callers may pass these instead of text). */
  lineItems?: Array<{ name: string; quantity?: number; unit?: string }>;
  /** Overrides the household's preferred retailer for this cart. */
  retailerKey?: string;
}

export interface CreateCartResult {
  cartId: string;
  requestId: string;
  /** The deliverable: the Instacart checkout URL (PRD section 3). */
  instacartUrl: string;
  retailer: RetailerInfo | null;
  resolvedLineItems: ResolvedLineItem[];
  /**
   * Caller-facing notes: what the profile changed ("set bananas to organic"),
   * retailer fallbacks, allergen warnings, partial-success details.
   */
  notes: string[];
}
