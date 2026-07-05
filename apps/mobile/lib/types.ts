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
  email: string;
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
  retailer: Retailer;
  resolved_line_items: ResolvedLineItem[];
  notes: string[];
}

export type CartStatus = 'created' | 'opened' | 'expired';

export interface CartSummary {
  id: string;
  title: string | null;
  instacart_url: string;
  retailer_key: string;
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
  notes?: string[];
};

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
