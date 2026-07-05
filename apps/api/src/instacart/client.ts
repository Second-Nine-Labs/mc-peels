/**
 * Instacart Developer Platform HTTP client.
 *
 * Holds the single server-side partner API key (PRD sections 3, 9, 10):
 * nothing outside MC Peels ever calls Instacart, and no Instacart user
 * credentials are ever handled. This client only assembles cart pages —
 * checkout is always completed by a human on Instacart.
 */

import { env, INSTACART_BASE_URLS } from '../env';
import type { RetailerInfo } from '../types';
import type {
  ProductsLinkRequest,
  ProductsLinkResponse,
  RetailersResponse,
} from './api-types';

/** Per-attempt request timeout. */
const REQUEST_TIMEOUT_MS = 15_000;

/** Thrown on any non-2xx Instacart response, carrying the parsed error body. */
export class InstacartApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'InstacartApiError';
    this.status = status;
    this.body = body;
  }
}

export interface InstacartClientOptions {
  /** Defaults to env().INSTACART_API_KEY, read lazily at call time. */
  apiKey?: string;
  /** Defaults to INSTACART_BASE_URLS[env().INSTACART_ENV], read lazily at call time. */
  baseUrl?: string;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface InstacartClient {
  /** GET /idp/v1/retailers — nearby retailers for a postal code (US/CA). */
  listNearbyRetailers(postalCode: string, countryCode: string): Promise<RetailerInfo[]>;
  /**
   * POST /idp/v1/products/products_link — build a shopping-list page and
   * return the Instacart URL a human opens to review and check out.
   */
  createProductsLinkPage(payload: ProductsLinkRequest): Promise<{ productsLinkUrl: string }>;
}

/** Parse a response body as JSON when possible, falling back to raw text. */
async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (text === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function createInstacartClient(opts: InstacartClientOptions = {}): InstacartClient {
  // Defaults are resolved lazily inside request() — not here — so tests can
  // construct a client with injected options without a full environment.
  const resolveApiKey = () => opts.apiKey ?? env().INSTACART_API_KEY;
  const resolveBaseUrl = () => opts.baseUrl ?? INSTACART_BASE_URLS[env().INSTACART_ENV];
  const fetchImpl = opts.fetchImpl ?? fetch;

  async function attempt(path: string, init: RequestInit): Promise<Response> {
    return fetchImpl(`${resolveBaseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${resolveApiKey()}`,
        Accept: 'application/json',
        ...(init.body != null ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  /** Execute a request with one retry on 5xx or network/timeout failure. */
  async function request<T>(path: string, init: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await attempt(path, init);
      if (res.status >= 500) {
        // Consume the failed body so the connection can be reused, then retry once.
        await res.text().catch(() => undefined);
        res = await attempt(path, init);
      }
    } catch {
      // Network error or timeout — retry once. A second failure surfaces as an
      // InstacartApiError (status 0) so callers map it to upstream_error
      // rather than a generic 500.
      try {
        res = await attempt(path, init);
      } catch (err) {
        throw new InstacartApiError(
          `Instacart API request failed: ${init.method ?? 'GET'} ${path} -> network error or timeout`,
          0,
          null,
        );
      }
    }

    if (!res.ok) {
      const body = await parseBody(res);
      throw new InstacartApiError(
        `Instacart API request failed: ${init.method ?? 'GET'} ${path} -> ${res.status}`,
        res.status,
        body,
      );
    }
    return (await res.json()) as T;
  }

  return {
    async listNearbyRetailers(postalCode, countryCode) {
      const query = new URLSearchParams({
        postal_code: postalCode,
        country_code: countryCode,
      });
      const data = await request<RetailersResponse>(`/idp/v1/retailers?${query.toString()}`, {
        method: 'GET',
      });
      return (data.retailers ?? []).map(
        (r): RetailerInfo => ({
          retailerKey: r.retailer_key,
          name: r.name,
          logoUrl: r.retailer_logo_url || null,
        }),
      );
    },

    async createProductsLinkPage(payload) {
      const data = await request<ProductsLinkResponse>('/idp/v1/products/products_link', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return { productsLinkUrl: data.products_link_url };
    },
  };
}

let singleton: InstacartClient | null = null;

/** Lazy singleton for production use; env is still only read per call. */
export function getInstacartClient(): InstacartClient {
  if (!singleton) {
    singleton = createInstacartClient();
  }
  return singleton;
}
