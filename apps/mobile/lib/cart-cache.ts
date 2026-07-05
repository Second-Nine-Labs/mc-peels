/**
 * Tiny in-memory cache of POST /carts results, keyed by cart_id.
 *
 * Why: the create response carries the resolved line items and the
 * partial-success `notes` ("what MC Peels applied"). The cart detail screen
 * merges this with GET /carts/:id so those notes are always shown right after
 * building a cart, even if the GET envelope omits them.
 */

import type { CreateCartResponse } from './types';

const cache = new Map<string, CreateCartResponse>();

export function rememberCartResult(result: CreateCartResponse): void {
  cache.set(result.cart_id, result);
}

export function getRememberedCart(cartId: string): CreateCartResponse | undefined {
  return cache.get(cartId);
}
