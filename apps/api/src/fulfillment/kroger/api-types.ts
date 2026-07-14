/**
 * Kroger Public API wire types (developer.kroger.com, verified 2026-07).
 * Only the fields MC Peels reads — the live payloads carry much more.
 */

/** POST /v1/connect/oauth2/token (all grant types). */
export interface KrogerTokenResponse {
  access_token: string;
  /** Only present on authorization_code / refresh_token grants. Rotates on use. */
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

/** GET /v1/locations?filter.zipCode.near= */
export interface KrogerLocation {
  locationId: string;
  chain: string;
  name: string;
  address?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

export interface KrogerLocationsResponse {
  data: KrogerLocation[];
}

/** One sellable item variant of a product (price present only with locationId). */
export interface KrogerProductItem {
  itemId?: string;
  size?: string;
  soldBy?: string;
  price?: {
    regular?: number;
    promo?: number;
  };
}

/** GET /v1/products?filter.term=&filter.locationId= */
export interface KrogerProduct {
  productId: string;
  upc?: string;
  brand?: string;
  description: string;
  categories?: string[];
  items?: KrogerProductItem[];
}

export interface KrogerProductsResponse {
  data: KrogerProduct[];
}

/** PUT /v1/cart/add body item. Human reviews/pays on kroger.com afterwards. */
export interface KrogerCartAddItem {
  upc: string;
  quantity: number;
  modality: 'PICKUP' | 'DELIVERY';
}

/**
 * The slice of a product we persist in the match cache and item matches —
 * enough to re-rank, price, and later push to a cart without re-fetching.
 */
export interface KrogerCandidate {
  product_id: string;
  upc?: string;
  brand?: string;
  description: string;
  size?: string;
  sold_by?: string;
  regular_cents: number | null;
  promo_cents: number | null;
}
