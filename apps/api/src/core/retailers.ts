import { InstacartApiError, getInstacartClient } from '../instacart/client.js';
import type { RetailerInfo } from '../types.js';
import { upstreamError } from './errors.js';
import { getHouseholdContext } from './households.js';

export interface ListRetailersOptions {
  householdId?: string;
  /** Defaults to the household's postal code / country. */
  postalCode?: string;
  countryCode?: string;
}

export async function listRetailers(
  userId: string,
  opts: ListRetailersOptions = {},
): Promise<RetailerInfo[]> {
  const ctx = await getHouseholdContext(userId, opts.householdId);
  const postalCode = opts.postalCode ?? ctx.household.postalCode;
  const countryCode = opts.countryCode ?? ctx.household.countryCode;
  try {
    return await getInstacartClient().listNearbyRetailers(postalCode, countryCode);
  } catch (err) {
    if (err instanceof InstacartApiError) {
      const reason = err.status > 0 ? `status ${err.status}` : 'network error';
      throw upstreamError(`Instacart retailer lookup failed (${reason}). Please try again.`);
    }
    throw err;
  }
}
