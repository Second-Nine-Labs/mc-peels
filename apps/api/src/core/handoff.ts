/**
 * Kroger cart-push handoff: fill the linked user's actual Kroger basket with
 * the quoted matches, then send them to kroger.com/cart to review and pay.
 * Basket assembly only — checkout stays human (PRD hard constraint).
 */

import { and, eq } from 'drizzle-orm';

import { getDb } from '../db/client.js';
import * as schema from '../db/schema.js';
import type { OfferItemMatch } from '../db/schema.js';
import { KrogerApiError, getKrogerClient, type KrogerClient, type KrogerUserGrant } from '../fulfillment/kroger/client.js';
import { getAuthorizedCart } from './carts.js';
import { deleteConnection, getConnection, saveConnection, type ProviderGrant } from './connections.js';
import { conflict, notConnected, upstreamError } from './errors.js';

const KROGER_CART_URL = 'https://www.kroger.com/cart';

/** Refresh when the access token has less than this much life left. */
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

export interface SkippedItem {
  lineItemId: string | null;
  name: string;
  reason: 'no_match' | 'unpriced' | 'no_upc';
}

export interface KrogerHandoffResult {
  handoffUrl: string;
  pushedCount: number;
  skipped: SkippedItem[];
  notes: string[];
}

/** A dead grant (revoked/expired refresh token) — relink is the only fix. */
function isDeadGrant(err: unknown): boolean {
  return err instanceof KrogerApiError && (err.status === 400 || err.status === 401);
}

async function freshAccessToken(
  client: KrogerClient,
  userId: string,
  grant: ProviderGrant,
  force = false,
): Promise<string> {
  if (!force && grant.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
    return grant.accessToken;
  }
  let rotated: KrogerUserGrant;
  try {
    rotated = await client.refreshUserToken(grant.refreshToken);
  } catch (err) {
    if (isDeadGrant(err)) {
      await deleteConnection(userId, 'kroger');
      throw notConnected('Your Kroger link expired — connect your account again.');
    }
    throw upstreamError('Kroger sign-in refresh failed. Please try again.');
  }
  // Kroger rotates refresh tokens on every use — persist or the link dies.
  await saveConnection(userId, 'kroger', rotated);
  return rotated.accessToken;
}

export async function krogerHandoff(
  userId: string,
  cartId: string,
): Promise<KrogerHandoffResult | null> {
  const row = await getAuthorizedCart(userId, cartId);
  if (!row) return null;

  const [offer] = await getDb()
    .select()
    .from(schema.cartOffers)
    .where(and(eq(schema.cartOffers.cartId, cartId), eq(schema.cartOffers.provider, 'kroger')))
    .limit(1);
  if (!offer || offer.status !== 'quoted') {
    throw conflict('No Kroger quote for this cart yet — refresh offers first.');
  }

  const grant = await getConnection(userId, 'kroger');
  if (!grant) {
    throw notConnected('Connect your Kroger account to send this cart.');
  }

  const pushable: Array<{ upc: string; quantity: number }> = [];
  const skipped: SkippedItem[] = [];
  for (const match of offer.itemMatches as OfferItemMatch[]) {
    if (match.status === 'matched' && match.product?.upc) {
      pushable.push({ upc: match.product.upc, quantity: Math.max(1, match.quantity) });
    } else {
      skipped.push({
        lineItemId: match.line_item_id,
        name: match.requested_name,
        reason: match.status === 'matched' ? 'no_upc' : match.status,
      });
    }
  }
  if (pushable.length === 0) {
    throw conflict('None of the quoted items can be pushed — shop this list on Kroger directly.');
  }

  const client = getKrogerClient();
  const items = pushable.map((p) => ({ ...p, modality: 'PICKUP' as const }));

  let accessToken = await freshAccessToken(client, userId, grant);
  try {
    await client.addToCart(accessToken, items);
  } catch (err) {
    if (!isDeadGrant(err)) {
      throw upstreamError('Kroger could not accept the cart right now. Please try again.');
    }
    // Access token rejected despite valid-looking expiry (revocation, clock
    // skew) — force one refresh-and-retry before declaring the link dead.
    const relinked = await getConnection(userId, 'kroger');
    if (!relinked) throw notConnected('Connect your Kroger account to send this cart.');
    accessToken = await freshAccessToken(client, userId, relinked, true);
    try {
      await client.addToCart(accessToken, items);
    } catch (retryErr) {
      if (isDeadGrant(retryErr)) {
        await deleteConnection(userId, 'kroger');
        throw notConnected('Your Kroger link expired — connect your account again.');
      }
      throw upstreamError('Kroger could not accept the cart right now. Please try again.');
    }
  }

  await getDb()
    .update(schema.cartOffers)
    .set({ handoffUrl: KROGER_CART_URL, updatedAt: new Date() })
    .where(eq(schema.cartOffers.id, offer.id));

  const notes = ['Review and pay on Kroger — MC Peels never handles payment.'];
  if (skipped.length > 0) {
    notes.push(
      `${skipped.length} item${skipped.length === 1 ? ' was' : 's were'} not pushed — add ${skipped.length === 1 ? 'it' : 'them'} on Kroger if needed.`,
    );
  }

  return {
    handoffUrl: KROGER_CART_URL,
    pushedCount: pushable.length,
    skipped,
    notes,
  };
}
