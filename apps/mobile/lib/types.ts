/**
 * Types for the MC Peels REST API (v1).
 * These mirror docs/api-contract.md exactly — snake_case throughout.
 */

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation_error'
  | 'conflict'
  | 'upstream_error'
  | 'internal_error';

export interface ErrorEnvelope {
  error: { code: ApiErrorCode | string; message: string };
}

// ---------------------------------------------------------------------------
// Identity

export interface ApiUser {
  id: string;
  email: string | null;
}

export type CountryCode = 'US' | 'CA';
export type MemberRole = 'owner' | 'member';

export interface Household {
  id: string;
  name: string;
  postal_code: string;
  country_code: CountryCode;
  preferred_retailer_key: string | null;
  created_at: string;
}

export interface Membership {
  household_id: string;
  role: MemberRole;
  household: Household;
}

export interface MeResponse {
  user: ApiUser;
  memberships: Membership[];
}

// ---------------------------------------------------------------------------
// Households

export interface CreateHouseholdBody {
  name: string;
  postal_code: string;
  country_code: CountryCode;
}

export interface UpdateHouseholdBody {
  name?: string;
  postal_code?: string;
  country_code?: CountryCode;
  /** null clears the preferred retailer */
  preferred_retailer_key?: string | null;
}

export interface HouseholdMember {
  user_id: string;
  role: MemberRole;
  joined_at: string;
}

export interface HouseholdDetailResponse {
  household: Household;
  members: HouseholdMember[];
  dietary_profile: DietaryProfile;
}

export interface InviteResponse {
  code: string;
  expires_at: string;
}

// ---------------------------------------------------------------------------
// Dietary profile

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

export interface DietaryProfile {
  prefer_organic: boolean;
  preferred_brands: string[];
  excluded_ingredients: string[];
  allergens: string[];
  health_filters: HealthFilter[];
  notes: string;
}

export const EMPTY_DIETARY_PROFILE: DietaryProfile = {
  prefer_organic: false,
  preferred_brands: [],
  excluded_ingredients: [],
  allergens: [],
  health_filters: [],
  notes: '',
};

// ---------------------------------------------------------------------------
// Retailers

export interface Retailer {
  retailer_key: string;
  name: string;
  retailer_logo_url: string;
}

export interface RetailersResponse {
  retailers: Retailer[];
}

// ---------------------------------------------------------------------------
// Carts

export interface LineItemInput {
  name: string;
  quantity?: number;
  unit?: string;
}

/** Exactly one of request_text / line_items is required. */
export interface CreateCartBody {
  household_id?: string;
  request_text?: string;
  line_items?: LineItemInput[];
  retailer_key?: string;
}

export interface AppliedFilters {
  health_filters: string[];
  brand_filters: string[];
}

export interface ResolvedLineItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  display_text: string;
  /** 'direct_request' in v1; recipe:<id> etc. arrive in phase 2 */
  source: string;
  applied_filters: AppliedFilters;
  warnings: string[];
}

export interface CreateCartResponse {
  cart_id: string;
  request_id: string;
  instacart_url: string;
  /** null when no retailer could be resolved (partial success). */
  retailer: Retailer | null;
  resolved_line_items: ResolvedLineItem[];
  /** One per enabled fulfillment service; absent from pre-rails servers. */
  offers?: Offer[];
  notes: string[];
}

// ---------------------------------------------------------------------------
// Fulfillment offers (parallel rails + price comparison)

export type OfferStatus = 'pending' | 'quoted' | 'unpriced' | 'failed';
export type OfferMatchStatus = 'matched' | 'no_match' | 'unpriced';
export type OfferMatchConfidence = 'high' | 'medium' | 'low';

export interface OfferStore {
  provider_store_id: string;
  name: string;
  address?: string;
  chain?: string;
  logo_url?: string | null;
}

export interface OfferMatchedProduct {
  product_id: string;
  upc?: string;
  description: string;
  brand?: string;
  size?: string;
  sold_by?: string;
}

export interface OfferItemMatch {
  line_item_id: string | null;
  requested_name: string;
  requested_quantity: number | null;
  requested_unit: string | null;
  status: OfferMatchStatus;
  confidence: OfferMatchConfidence | null;
  product: OfferMatchedProduct | null;
  quantity: number;
  unit_price_cents: number | null;
  regular_price_cents: number | null;
  promo_price_cents: number | null;
  line_total_cents: number | null;
  promo_savings_cents: number;
  /** Parsed package size for unit pricing; absent on pre-unit-pricing offers. */
  measure_quantity?: number | null;
  measure_unit?: string | null;
  warnings: string[];
}

export interface Offer {
  id: string;
  provider: string;
  display_name: string;
  capabilities: { quote: boolean; handoff: 'link' | 'account_cart_push' };
  status: OfferStatus;
  handoff_url: string | null;
  store: OfferStore | null;
  /** Items subtotal in cents — real shelf prices only, never an estimate. */
  subtotal_cents: number | null;
  promo_savings_cents: number;
  currency: string;
  matched_count: number;
  total_count: number;
  item_matches: OfferItemMatch[];
  notes: string[];
  quoted_at: string | null;
  expires_at: string | null;
}

export interface OffersRefreshBody {
  providers?: string[];
  force?: boolean;
}

export interface OffersRefreshResponse {
  offers: Offer[];
  /** provider -> linked, for the current user (e.g. { kroger: true }). */
  connections: Record<string, boolean>;
}

export interface ConnectionSummaryWire {
  provider: string;
  connected_at: string;
}

export interface ConnectionsResponse {
  connections: ConnectionSummaryWire[];
}

export interface KrogerConnectStartResponse {
  authorize_url: string;
}

export interface KrogerHandoffResponse {
  handoff_url: string;
  pushed_count: number;
  skipped: Array<{ line_item_id: string | null; name: string; reason: string }>;
  notes: string[];
}

/** A household's recurring item, for the Ask screen's "Your usuals" row. */
export interface UsualItem {
  name: string;
  count: number;
}

export interface UsualsResponse {
  usuals: UsualItem[];
}

export type CartStatus = 'created' | 'opened' | 'expired';

export interface CartSummary {
  id: string;
  title: string | null;
  instacart_url: string;
  /** null when the cart was built without a resolved retailer (partial success). */
  retailer_key: string | null;
  status: CartStatus;
  request_text: string | null;
  created_by_user_id: string;
  created_at: string;
}

export interface CartsResponse {
  carts: CartSummary[];
}

/**
 * GET /carts/:id — the contract says "cart plus its line items (same resolved
 * shape as POST response)" without pinning the exact envelope, so this type
 * tolerates both a flat cart object and a nested { cart: ... } wrapper.
 * The cart screen normalizes whichever arrives.
 */
export type CartDetailResponse = Partial<CartSummary> & {
  cart?: CartSummary;
  retailer?: Retailer | null;
  line_items?: ResolvedLineItem[];
  resolved_line_items?: ResolvedLineItem[];
  offers?: Offer[];
  notes?: string[];
};

// ---------------------------------------------------------------------------
// Recipes (the shelf)

export type RecipeProvenance = 'transcribed' | 'reconstructed';
export type RecipeConfidence = 'high' | 'medium' | 'low';

export interface RecipeIngredientWire {
  name: string;
  quantity: number | null;
  unit: string | null;
  pantry: boolean;
}

export interface SavedRecipe {
  id: string;
  household_id: string;
  source_url: string;
  source_platform: 'tiktok' | 'instagram' | 'pinterest' | 'youtube' | 'web' | string;
  creator: string | null;
  title: string;
  sub: string | null;
  description: string | null;
  cuisine: string;
  dish_type: string;
  serves: number;
  minutes: number;
  /** Chile scale 0-3; null when heat is not the point. */
  heat: number | null;
  ingredients: RecipeIngredientWire[];
  steps: string[];
  /** 'reconstructed' means the dish was rebuilt from hints — the UI says so. */
  provenance: RecipeProvenance;
  confidence: RecipeConfidence;
  notes: string[];
  /** Generated dish art (public CDN URL) — null until the pipeline lands one. */
  art_url: string | null;
  /** none | pending | ok | failed. */
  art_status: string;
  created_at: string;
}

export interface EnsureRecipeArtResponse {
  status: 'ok' | 'exists' | 'failed' | 'unconfigured';
  art_url: string | null;
}

export interface IngestRecipeBody {
  household_id?: string;
  url: string;
}

export interface IngestRecipeResponse {
  recipe: SavedRecipe;
  already_saved: boolean;
}

export interface CuisineCount {
  cuisine: string;
  count: number;
}

export interface ShelfResponse {
  recipes: SavedRecipe[];
  cuisine_counts: CuisineCount[];
}

// ---------------------------------------------------------------------------
// MCP access tokens

export interface CreatedTokenResponse {
  id: string;
  name: string;
  /** Plaintext token — returned exactly once at creation. */
  token: string;
}

export interface TokenSummary {
  id: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
}

export interface TokensResponse {
  tokens: TokenSummary[];
}
