/**
 * The direct-shopping pipeline (PRD section 6):
 * request -> parse -> apply dietary profile -> resolve retailer ->
 * build Instacart link -> persist -> hand off the checkout URL.
 */

import { desc, eq } from 'drizzle-orm';
import { ParserError, parseRequest, parseStructuredItems } from '../ai/parser.js';
import { getDb, schema } from '../db/client.js';
import type { Cart, CartOffer, LineItem } from '../db/schema.js';
import { env } from '../env.js';
import { listOffers, seedRowsForNewCart } from '../fulfillment/offer-rows.js';
import { InstacartApiError, getInstacartClient } from '../instacart/client.js';
import { buildProductsLinkPayload, withRetailerHint } from '../instacart/payload.js';
import { applyProfile } from '../profile/apply.js';
import type {
  CreateCartInput,
  CreateCartResult,
  HealthFilter,
  ParseResult,
  ResolvedLineItem,
  RetailerInfo,
} from '../types.js';
import { upstreamError, validationError } from './errors.js';
import { getHouseholdContext } from './households.js';

export interface CartSummary {
  id: string;
  householdId: string;
  title: string;
  instacartUrl: string;
  retailerKey: string | null;
  status: 'created' | 'opened' | 'expired';
  requestText: string;
  createdByUserId: string;
  createdAt: Date;
}

export interface CartDetail extends CartSummary {
  lineItems: ResolvedLineItem[];
  /** One row per enabled fulfillment provider, csv order. */
  offers: CartOffer[];
}

export async function createCart(input: CreateCartInput): Promise<CreateCartResult> {
  const ctx = await getHouseholdContext(input.userId, input.householdId);
  const household = ctx.household;

  // 1-2. Validate + parse (quantities are user-determined; never invented).
  const requestText = input.requestText?.trim() ?? '';
  const hasText = requestText.length > 0;
  const hasItems = (input.lineItems?.length ?? 0) > 0;
  if (hasText === hasItems) {
    throw validationError('Provide exactly one of request_text or line_items.');
  }

  let parsed: ParseResult;
  try {
    parsed = hasText
      ? await parseRequest(requestText, ctx.profile)
      : await parseStructuredItems(input.lineItems!, ctx.profile);
  } catch (err) {
    if (err instanceof ParserError) {
      // Raw Anthropic error details stay server-side (information disclosure).
      console.error('Parser failure:', err);
      throw upstreamError(
        err.userMessage ?? 'Could not parse the grocery request right now. Please try again.',
      );
    }
    throw err;
  }
  if (parsed.items.length === 0) {
    const detail = parsed.notes.length > 0 ? ` ${parsed.notes.join(' ')}` : '';
    throw validationError(`No grocery items could be parsed from the request.${detail}`);
  }

  // 3. Apply the household dietary profile (deterministic).
  const { resolved, notes: profileNotes } = applyProfile(parsed.items, ctx.profile);

  // 4. Resolve retailer: explicit override > household preference > nearest.
  // Failures here are partial successes, not fatal (PRD section 10).
  const notes: string[] = [];
  let retailerKey = input.retailerKey ?? household.preferredRetailerKey ?? null;
  let retailer: RetailerInfo | null = null;
  const instacart = getInstacartClient();
  try {
    const nearby = await instacart.listNearbyRetailers(
      household.postalCode,
      household.countryCode,
    );
    if (retailerKey) {
      retailer =
        nearby.find((r) => r.retailerKey === retailerKey) ??
        ({ retailerKey, name: retailerKey, logoUrl: null } satisfies RetailerInfo);
    } else if (nearby.length > 0) {
      retailer = nearby[0]!;
      retailerKey = retailer.retailerKey;
      notes.push(
        `No preferred retailer set; using ${retailer.name}. You can set one in household settings.`,
      );
    } else {
      notes.push(
        'No retailers were found near your postal code; you can pick any available store on Instacart.',
      );
    }
  } catch {
    if (retailerKey) {
      retailer = { retailerKey, name: retailerKey, logoUrl: null };
    }
    notes.push(
      'Retailer lookup failed; the link still works — pick your store on Instacart.',
    );
  }

  // 5. Build the cart page on Instacart. This failure IS fatal: no link, no cart.
  const title = `MC Peels · ${new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`;
  const payload = buildProductsLinkPayload(title, resolved, {
    partnerLinkbackUrl: env().APP_BASE_URL,
  });
  let instacartUrl: string;
  try {
    ({ productsLinkUrl: instacartUrl } = await instacart.createProductsLinkPage(payload));
  } catch (err) {
    if (err instanceof InstacartApiError) {
      const reason = err.status > 0 ? `status ${err.status}` : 'network error';
      throw upstreamError(
        `Instacart could not build the cart page (${reason}). Please try again.`,
      );
    }
    throw err;
  }
  instacartUrl = withRetailerHint(instacartUrl, retailerKey);

  // 6. Persist request, cart, and tagged line items in one transaction.
  const rawText = hasText
    ? requestText
    : input
        .lineItems!.map((i) =>
          [i.quantity, i.unit, i.name].filter((v) => v !== undefined && v !== '').join(' '),
        )
        .join(', ');

  const { cartId, requestId, offers } = await getDb().transaction(async (tx) => {
    const [request] = await tx
      .insert(schema.requests)
      .values({
        householdId: household.id,
        requestedByUserId: input.userId,
        rawText,
        channel: input.channel,
      })
      .returning();
    const [cart] = await tx
      .insert(schema.carts)
      .values({
        householdId: household.id,
        requestId: request!.id,
        retailerKey,
        title,
        instacartUrl,
        createdByUserId: input.userId,
      })
      .returning();
    const insertedItems = await tx
      .insert(schema.lineItems)
      .values(
        resolved.map((item) => ({
          requestId: request!.id,
          householdId: household.id,
          cartId: cart!.id,
          source: item.source,
          name: item.name,
          quantity: item.quantity === null ? null : String(item.quantity),
          unit: item.unit,
          appliedFilters: {
            health_filters: item.appliedFilters.healthFilters,
            brand_filters: item.appliedFilters.brandFilters,
          },
          resolvedDisplayText: item.displayText,
          warnings: item.warnings,
        })),
      )
      .returning();
    // Seed one offer per enabled rail (static data — real quotes come later
    // via POST /carts/:id/offers/refresh, never blocking cart creation).
    const seedRows = seedRowsForNewCart(household, cart!, insertedItems);
    const seededOffers =
      seedRows.length > 0
        ? await tx.insert(schema.cartOffers).values(seedRows).returning()
        : [];
    return { cartId: cart!.id, requestId: request!.id, offers: seededOffers };
  });

  // 7. Hand off. Notes tell the caller exactly what was applied (PRD section 6.7).
  return {
    cartId,
    requestId,
    instacartUrl,
    retailer,
    resolvedLineItems: resolved,
    offers,
    notes: [...profileNotes, ...notes, ...parsed.notes],
  };
}

// Reads -----------------------------------------------------------------------

function rowToResolvedItem(row: LineItem): ResolvedLineItem {
  return {
    name: row.name,
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit,
    displayText: row.resolvedDisplayText,
    source: 'direct_request',
    appliedFilters: {
      healthFilters: (row.appliedFilters?.health_filters ?? []) as HealthFilter[],
      brandFilters: row.appliedFilters?.brand_filters ?? [],
    },
    warnings: row.warnings ?? [],
  };
}

function toSummary(cart: Cart, requestText: string): CartSummary {
  return {
    id: cart.id,
    householdId: cart.householdId,
    title: cart.title,
    instacartUrl: cart.instacartUrl,
    retailerKey: cart.retailerKey,
    status: cart.status,
    requestText,
    createdByUserId: cart.createdByUserId,
    createdAt: cart.createdAt,
  };
}

/** Fetch a cart the user can see (membership enforced), or null. */
export async function getAuthorizedCart(userId: string, cartId: string) {
  const rows = await getDb()
    .select({ cart: schema.carts, request: schema.requests })
    .from(schema.carts)
    .innerJoin(schema.requests, eq(schema.carts.requestId, schema.requests.id))
    .where(eq(schema.carts.id, cartId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Throws forbidden if the user is not a member of the cart's household.
  await getHouseholdContext(userId, row.cart.householdId);
  return row;
}

export async function getCartWithItems(
  userId: string,
  cartId: string,
): Promise<CartDetail | null> {
  const row = await getAuthorizedCart(userId, cartId);
  if (!row) return null;
  const [items, offers] = await Promise.all([
    getDb().select().from(schema.lineItems).where(eq(schema.lineItems.cartId, cartId)),
    listOffers(cartId),
  ]);
  return {
    ...toSummary(row.cart, row.request.rawText),
    lineItems: items.map(rowToResolvedItem),
    offers,
  };
}

export async function listRecentCarts(
  userId: string,
  opts: { householdId?: string; limit?: number } = {},
): Promise<CartSummary[]> {
  const ctx = await getHouseholdContext(userId, opts.householdId);
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const rows = await getDb()
    .select({ cart: schema.carts, request: schema.requests })
    .from(schema.carts)
    .innerJoin(schema.requests, eq(schema.carts.requestId, schema.requests.id))
    .where(eq(schema.carts.householdId, ctx.household.id))
    .orderBy(desc(schema.carts.createdAt))
    .limit(limit);
  return rows.map((r) => toSummary(r.cart, r.request.rawText));
}

/** Best-effort local status only — Instacart reports no order state back (PRD section 7). */
export async function markCartOpened(
  userId: string,
  cartId: string,
): Promise<CartSummary | null> {
  const row = await getAuthorizedCart(userId, cartId);
  if (!row) return null;
  if (row.cart.status !== 'created') {
    return toSummary(row.cart, row.request.rawText);
  }
  const [updated] = await getDb()
    .update(schema.carts)
    .set({ status: 'opened', updatedAt: new Date() })
    .where(eq(schema.carts.id, cartId))
    .returning();
  return toSummary(updated!, row.request.rawText);
}
