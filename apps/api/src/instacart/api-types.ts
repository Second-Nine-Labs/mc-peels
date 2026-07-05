/**
 * Instacart Developer Platform API wire types.
 *
 * Field names are snake_case exactly as the API sends/expects them
 * (verified against the live docs, July 2026). These types describe the
 * HTTP boundary only — everything above the wrapper speaks the camelCase
 * domain types in src/types.ts.
 *
 * The Developer Platform API is cart-assembly only: we POST line items,
 * Instacart returns a landing-page URL, and a human completes checkout on
 * Instacart with their own account (PRD section 3).
 */

import type { HealthFilter } from '../types.js';

// Retailers -----------------------------------------------------------------

/** One retailer from GET /idp/v1/retailers. */
export interface ApiRetailer {
  retailer_key: string;
  name: string;
  retailer_logo_url: string;
}

/** Response body for GET /idp/v1/retailers?postal_code=X&country_code=US|CA. */
export interface RetailersResponse {
  retailers: ApiRetailer[];
}

// Products link (shopping-list page) ----------------------------------------

/** A measurement alternative for a line item, e.g. { quantity: 2, unit: "lb" }. */
export interface ApiLineItemMeasurement {
  quantity: number;
  unit: string;
}

/**
 * Per-line-item search filters. `health_filters` values must come from the
 * enum Instacart documents (ORGANIC, GLUTEN_FREE, FAT_FREE, VEGAN, KOSHER,
 * SUGAR_FREE, LOW_FAT) — mirrored by HEALTH_FILTERS in src/types.ts.
 */
export interface ApiLineItemFilters {
  brand_filters?: string[];
  health_filters?: HealthFilter[];
}

/** One line item in a products-link request. Only `name` is required. */
export interface ApiLineItem {
  name: string;
  quantity?: number;
  unit?: string;
  display_text?: string;
  product_ids?: string[];
  upcs?: string[];
  line_item_measurements?: ApiLineItemMeasurement[];
  filters?: ApiLineItemFilters;
}

/** Optional landing-page behavior for the generated Instacart page. */
export interface ApiLandingPageConfiguration {
  partner_linkback_url?: string;
  enable_pantry_items?: boolean;
}

/**
 * Request body for POST /idp/v1/products/products_link.
 *
 * Note: there is NO documented field to pin a retailer here — store
 * selection happens on the Instacart landing page.
 */
export interface ProductsLinkRequest {
  /** Page title shown on the Instacart landing page. Required. */
  title: string;
  image_url?: string;
  link_type?: 'shopping_list' | 'recipe';
  /** Link lifetime in days; max 365. */
  expires_in?: number;
  instructions?: string[];
  line_items: ApiLineItem[];
  landing_page_configuration?: ApiLandingPageConfiguration;
}

/** Response body for POST /idp/v1/products/products_link. */
export interface ProductsLinkResponse {
  products_link_url: string;
}
