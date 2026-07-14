/**
 * Kroger Public API HTTP client (developer.kroger.com).
 *
 * Mirrors the Instacart client's shape: injectable fetch, lazy config
 * resolution, one retry on 5xx/network, typed error. Two token worlds:
 *   - app token (client_credentials, scope product.compact) for catalog reads,
 *     memoized in module scope per warm serverless instance;
 *   - user tokens (authorization_code / refresh_token grants, scope
 *     cart.basic:write) for pushing items into the customer's own Kroger cart.
 *     Kroger ROTATES refresh tokens on every use — callers must persist the
 *     replacement (client.ts only surfaces it).
 *
 * Cart pushes are basket-assembly only; checkout is always a human on
 * kroger.com (PRD hard constraint).
 */

import { env } from '../../env.js';
import type {
  KrogerCartAddItem,
  KrogerLocation,
  KrogerLocationsResponse,
  KrogerProduct,
  KrogerProductsResponse,
  KrogerTokenResponse,
} from './api-types.js';

/** Per-attempt request timeout — quotes race an ~8.5s orchestrator deadline. */
const REQUEST_TIMEOUT_MS = 5_000;

export class KrogerApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'KrogerApiError';
    this.status = status;
    this.body = body;
  }
}

export interface KrogerUserGrant {
  accessToken: string;
  /** Rotated replacement — persist this or the grant dies. */
  refreshToken: string;
  expiresAt: Date;
  scopes: string;
}

export interface KrogerClientOptions {
  clientId?: string;
  clientSecret?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface KrogerClient {
  /** GET /v1/products — term search with per-store prices. */
  searchProducts(
    term: string,
    locationId: string,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<KrogerProduct[]>;
  /** GET /v1/locations — nearest stores for a zip (across all banners). */
  listLocations(zip: string, limit?: number, signal?: AbortSignal): Promise<KrogerLocation[]>;
  /** authorization_code grant → user tokens. */
  exchangeAuthCode(code: string, redirectUri: string): Promise<KrogerUserGrant>;
  /** refresh_token grant → NEW user tokens (refresh token rotates). */
  refreshUserToken(refreshToken: string): Promise<KrogerUserGrant>;
  /** PUT /v1/cart/add on behalf of a linked user. Resolves on 204. */
  addToCart(userAccessToken: string, items: KrogerCartAddItem[]): Promise<void>;
  /** Test hook: drop the memoized app token. */
  resetAppToken(): void;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (text === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function createKrogerClient(opts: KrogerClientOptions = {}): KrogerClient {
  const resolveClientId = () => {
    const id = opts.clientId ?? env().KROGER_CLIENT_ID;
    if (!id) throw new KrogerApiError('KROGER_CLIENT_ID is not configured.', 0, null);
    return id;
  };
  const resolveClientSecret = () => {
    const secret = opts.clientSecret ?? env().KROGER_CLIENT_SECRET;
    if (!secret) throw new KrogerApiError('KROGER_CLIENT_SECRET is not configured.', 0, null);
    return secret;
  };
  const resolveBaseUrl = () => opts.baseUrl ?? env().KROGER_BASE_URL;
  const fetchImpl = opts.fetchImpl ?? fetch;

  let appToken: { value: string; expiresAtMs: number } | null = null;

  function basicAuth(): string {
    return `Basic ${Buffer.from(`${resolveClientId()}:${resolveClientSecret()}`).toString('base64')}`;
  }

  async function attempt(path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    const signals = [AbortSignal.timeout(REQUEST_TIMEOUT_MS)];
    if (signal) signals.push(signal);
    return fetchImpl(`${resolveBaseUrl()}${path}`, {
      ...init,
      signal: AbortSignal.any(signals),
    });
  }

  /**
   * One retry on 5xx or network failure; NEVER on 429 (rate limits are a
   * budget problem, not a transient — the offer just reads 'failed').
   */
  async function request(path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    let res: Response;
    try {
      res = await attempt(path, init, signal);
      if (res.status >= 500) {
        await res.text().catch(() => undefined);
        res = await attempt(path, init, signal);
      }
    } catch (err) {
      // Respect deliberate aborts (orchestrator deadline) — do not retry into
      // a request whose caller has already moved on.
      if (signal?.aborted) throw err;
      try {
        res = await attempt(path, init, signal);
      } catch {
        throw new KrogerApiError(
          `Kroger API request failed: ${init.method ?? 'GET'} ${path} -> network error or timeout`,
          0,
          null,
        );
      }
    }
    if (!res.ok && res.status !== 204) {
      const body = await parseBody(res);
      throw new KrogerApiError(
        `Kroger API request failed: ${init.method ?? 'GET'} ${path} -> ${res.status}`,
        res.status,
        body,
      );
    }
    return res;
  }

  async function tokenGrant(form: Record<string, string>): Promise<KrogerTokenResponse> {
    const res = await request('/v1/connect/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: basicAuth(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form).toString(),
    });
    return (await res.json()) as KrogerTokenResponse;
  }

  function toUserGrant(data: KrogerTokenResponse): KrogerUserGrant {
    if (!data.refresh_token) {
      throw new KrogerApiError('Kroger token response is missing refresh_token.', 0, data);
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope ?? 'cart.basic:write',
    };
  }

  async function appAccessToken(): Promise<string> {
    if (appToken && Date.now() < appToken.expiresAtMs) return appToken.value;
    const data = await tokenGrant({
      grant_type: 'client_credentials',
      scope: 'product.compact',
    });
    appToken = {
      value: data.access_token,
      // Refresh a minute early so in-flight requests never carry a dead token.
      expiresAtMs: Date.now() + (data.expires_in - 60) * 1000,
    };
    return appToken.value;
  }

  return {
    async searchProducts(term, locationId, limit = 8, signal) {
      const token = await appAccessToken();
      const query = new URLSearchParams({
        'filter.term': term,
        'filter.locationId': locationId,
        'filter.limit': String(limit),
      });
      const res = await request(
        `/v1/products?${query.toString()}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
        signal,
      );
      const data = (await res.json()) as KrogerProductsResponse;
      return data.data ?? [];
    },

    async listLocations(zip, limit = 1, signal) {
      const token = await appAccessToken();
      const query = new URLSearchParams({
        'filter.zipCode.near': zip,
        'filter.limit': String(limit),
      });
      const res = await request(
        `/v1/locations?${query.toString()}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
        signal,
      );
      const data = (await res.json()) as KrogerLocationsResponse;
      return data.data ?? [];
    },

    async exchangeAuthCode(code, redirectUri) {
      return toUserGrant(
        await tokenGrant({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      );
    },

    async refreshUserToken(refreshToken) {
      return toUserGrant(
        await tokenGrant({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      );
    },

    async addToCart(userAccessToken, items) {
      await request('/v1/cart/add', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ items }),
      });
    },

    resetAppToken() {
      appToken = null;
    },
  };
}

let singleton: KrogerClient | null = null;

/** Lazy singleton for production use; config is still only read per call. */
export function getKrogerClient(): KrogerClient {
  if (!singleton) {
    singleton = createKrogerClient();
  }
  return singleton;
}
