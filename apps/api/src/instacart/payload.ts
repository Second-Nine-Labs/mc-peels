/**
 * Pure payload builders for the Instacart products-link endpoint.
 *
 * No I/O here: these functions translate resolved domain line items
 * (src/types.ts) into the snake_case wire shape (./api-types) and are
 * trivially unit-testable.
 */

import type { ResolvedLineItem } from '../types';
import type { ApiLineItem, ProductsLinkRequest } from './api-types';

export interface BuildProductsLinkOptions {
  /** Shown as a "back to partner" link on the Instacart landing page. */
  partnerLinkbackUrl?: string;
  /** Free-text instructions displayed on the landing page. */
  instructions?: string[];
}

/**
 * Build a POST /idp/v1/products/products_link body from resolved line items.
 *
 * Quantity/unit are omitted entirely when null — quantities are
 * user-determined and never invented (PRD section 6.2). Instacart defaults
 * quantity to 1 on its end, which is acceptable display behavior; the human
 * resolves final amounts at checkout.
 */
export function buildProductsLinkPayload(
  title: string,
  items: ResolvedLineItem[],
  opts?: BuildProductsLinkOptions,
): ProductsLinkRequest {
  const payload: ProductsLinkRequest = {
    title,
    link_type: 'shopping_list',
    line_items: items.map(toApiLineItem),
  };

  if (opts?.instructions && opts.instructions.length > 0) {
    payload.instructions = opts.instructions;
  }
  if (opts?.partnerLinkbackUrl) {
    payload.landing_page_configuration = {
      partner_linkback_url: opts.partnerLinkbackUrl,
    };
  }

  return payload;
}

function toApiLineItem(item: ResolvedLineItem): ApiLineItem {
  const lineItem: ApiLineItem = {
    name: item.name,
    display_text: item.displayText,
  };

  // Never invent quantities (PRD section 6.2): only pass through what the
  // user actually stated.
  if (item.quantity !== null) {
    lineItem.quantity = item.quantity;
  }
  if (item.unit !== null) {
    lineItem.unit = item.unit;
  }

  const { healthFilters, brandFilters } = item.appliedFilters;
  // Include the filters object only when at least one filter array is non-empty.
  if (healthFilters.length > 0 || brandFilters.length > 0) {
    lineItem.filters = {
      ...(brandFilters.length > 0 ? { brand_filters: brandFilters } : {}),
      ...(healthFilters.length > 0 ? { health_filters: healthFilters } : {}),
    };
  }

  return lineItem;
}

/**
 * Append a `retailer_key=<key>` query param to a products-link URL.
 *
 * Best-effort, UNDOCUMENTED hint only: the Instacart Developer Platform has
 * no documented way to pin a retailer in the request or the link — the
 * documented behavior is that the shopper picks the store on the landing
 * page. If Instacart ignores (or stops honoring) this param, the link still
 * works and the human simply chooses the store themselves.
 */
export function withRetailerHint(url: string, retailerKey: string | null | undefined): string {
  if (!retailerKey) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('retailer_key', retailerKey);
    return parsed.toString();
  } catch {
    // Not a parseable absolute URL — return it untouched rather than corrupt it.
    return url;
  }
}
