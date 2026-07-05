import { InstacartApiError, getInstacartClient } from '../instacart/client';
import type { RetailerInfo } from '../types';
import { upstreamError } from './errors';
import { getHouseholdContext } from './households';

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
      throw upstreamError(
        `Instacart retailer lookup failed (status ${err.status}). Please try again.`,
      );
    }
    throw err;
  }
}
