/**
 * Typed client for the MC Peels REST API (docs/api-contract.md).
 *
 * - Attaches the Supabase access token as a Bearer header.
 * - Parses the standard error envelope: { error: { code, message } }.
 * - On 401, signs the user out — the auth gate in app/_layout.tsx then routes
 *   back to the sign-in screen.
 */

import { supabase } from './supabase';
import type {
  CartDetailResponse,
  CartsResponse,
  ConnectionsResponse,
  CreateCartBody,
  CreateCartResponse,
  CreateHouseholdBody,
  CreatedTokenResponse,
  DietaryProfile,
  ErrorEnvelope,
  Household,
  HouseholdDetailResponse,
  IngestRecipeBody,
  IngestRecipeResponse,
  InviteResponse,
  KrogerConnectStartResponse,
  KrogerHandoffResponse,
  MeResponse,
  OffersRefreshBody,
  OffersRefreshResponse,
  RetailersResponse,
  SeedStartersBody,
  SeedStartersResponse,
  ShelfResponse,
  StartersResponse,
  TokensResponse,
  UpdateHouseholdBody,
} from './types';

const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
const BASE_URL = `${API_ORIGIN}/api/v1`;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

type QueryParams = Record<string, string | number | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
}

function buildQuery(query: QueryParams | undefined): string {
  if (!query) return '';
  const parts = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}${buildQuery(options.query)}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Could not reach MC Peels. Check your connection and try again.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON body (e.g. a gateway error page); fall through to status handling.
  }

  if (!response.ok) {
    const envelope = payload as ErrorEnvelope | null;
    const code = envelope?.error?.code ?? 'internal_error';
    const message = envelope?.error?.message ?? `Request failed (${response.status}).`;

    if (response.status === 401) {
      // Invalid/expired session: signing out flips the auth gate to sign-in.
      await supabase.auth.signOut();
    }

    throw new ApiError(response.status, code, message);
  }

  return payload as T;
}

export const api = {
  // Identity -----------------------------------------------------------------
  getMe: () => request<MeResponse>('/me'),

  // Households ---------------------------------------------------------------
  createHousehold: (body: CreateHouseholdBody) =>
    request<Household>('/households', { method: 'POST', body }),

  getHousehold: (householdId: string) =>
    request<HouseholdDetailResponse>(`/households/${householdId}`),

  updateHousehold: (householdId: string, body: UpdateHouseholdBody) =>
    request<Household>(`/households/${householdId}`, { method: 'PATCH', body }),

  createInvite: (householdId: string) =>
    request<InviteResponse>(`/households/${householdId}/invites`, { method: 'POST' }),

  joinHousehold: (code: string) =>
    request<Household>('/households/join', { method: 'POST', body: { code } }),

  // Dietary profile ----------------------------------------------------------
  getDietaryProfile: (householdId: string) =>
    request<DietaryProfile>(`/households/${householdId}/dietary-profile`),

  updateDietaryProfile: (householdId: string, profile: DietaryProfile) =>
    request<DietaryProfile>(`/households/${householdId}/dietary-profile`, {
      method: 'PUT',
      body: profile,
    }),

  // Retailers ------------------------------------------------------------
  getRetailers: (params: { household_id?: string; postal_code?: string; country_code?: string } = {}) =>
    request<RetailersResponse>('/retailers', { query: params }),

  // Carts ----------------------------------------------------------------
  createCart: (body: CreateCartBody) =>
    request<CreateCartResponse>('/carts', { method: 'POST', body }),

  listCarts: (params: { household_id?: string; limit?: number } = {}) =>
    request<CartsResponse>('/carts', { query: params }),

  getCart: (cartId: string) => request<CartDetailResponse>(`/carts/${cartId}`),

  markCartOpened: (cartId: string) =>
    request<CartDetailResponse>(`/carts/${cartId}/opened`, { method: 'POST' }),

  // Fulfillment offers (price comparison + parallel rails) -------------------
  refreshOffers: (cartId: string, body: OffersRefreshBody = {}) =>
    request<OffersRefreshResponse>(`/carts/${cartId}/offers/refresh`, { method: 'POST', body }),

  krogerHandoff: (cartId: string) =>
    request<KrogerHandoffResponse>(`/carts/${cartId}/handoff/kroger`, { method: 'POST', body: {} }),

  krogerConnectStart: (returnTo: string) =>
    request<KrogerConnectStartResponse>('/connect/kroger/start', {
      query: { return_to: returnTo },
    }),

  getConnections: () => request<ConnectionsResponse>('/connections'),

  disconnectProvider: (provider: string) =>
    request<void>(`/connections/${provider}`, { method: 'DELETE' }),

  // Recipes (the shelf) ------------------------------------------------------
  ingestRecipe: (body: IngestRecipeBody) =>
    request<IngestRecipeResponse>('/recipes', { method: 'POST', body }),

  listRecipes: (params: { household_id?: string; limit?: number } = {}) =>
    request<ShelfResponse>('/recipes', { query: params }),

  deleteRecipe: (recipeId: string) =>
    request<void>(`/recipes/${recipeId}`, { method: 'DELETE' }),

  // Starters (onboarding's first stock) --------------------------------------
  getStarters: () => request<StartersResponse>('/recipes/starters'),

  seedStarters: (body: SeedStartersBody) =>
    request<SeedStartersResponse>('/recipes/starters', { method: 'POST', body }),

  // MCP access tokens ------------------------------------------------------
  createToken: (name: string) =>
    request<CreatedTokenResponse>('/tokens', { method: 'POST', body: { name } }),

  listTokens: () => request<TokensResponse>('/tokens'),

  deleteToken: (tokenId: string) =>
    request<void>(`/tokens/${tokenId}`, { method: 'DELETE' }),
};
