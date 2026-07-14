import { describe, expect, it, vi } from 'vitest';

import { KrogerApiError, createKrogerClient } from '../src/fulfillment/kroger/client.js';

const TOKEN_JSON = { access_token: 'app-token', expires_in: 1800, token_type: 'bearer' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientWith(fetchImpl: typeof fetch) {
  return createKrogerClient({
    clientId: 'id',
    clientSecret: 'secret',
    baseUrl: 'https://kroger.test',
    fetchImpl,
  });
}

describe('kroger client', () => {
  it('fetches an app token with Basic auth, then memoizes it', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      if (String(url).endsWith('/v1/connect/oauth2/token')) return jsonResponse(TOKEN_JSON);
      return jsonResponse({ data: [] });
    }) as unknown as typeof fetch;

    const client = clientWith(fetchImpl);
    await client.searchProducts('bananas', '01400943');
    await client.searchProducts('eggs', '01400943');

    const tokenCalls = calls.filter((c) => c.url.includes('/oauth2/token'));
    expect(tokenCalls).toHaveLength(1);
    expect((tokenCalls[0]!.init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('id:secret').toString('base64')}`,
    );
    expect(String(tokenCalls[0]!.init.body)).toContain('grant_type=client_credentials');
    expect(String(tokenCalls[0]!.init.body)).toContain('scope=product.compact');
  });

  it('builds the products query with term, locationId, and limit', async () => {
    let productsUrl = '';
    const fetchImpl = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes('/oauth2/token')) return jsonResponse(TOKEN_JSON);
      productsUrl = u;
      return jsonResponse({ data: [] });
    }) as unknown as typeof fetch;

    await clientWith(fetchImpl).searchProducts('organic bananas', '01400943', 8);
    const url = new URL(productsUrl);
    expect(url.pathname).toBe('/v1/products');
    expect(url.searchParams.get('filter.term')).toBe('organic bananas');
    expect(url.searchParams.get('filter.locationId')).toBe('01400943');
    expect(url.searchParams.get('filter.limit')).toBe('8');
  });

  it('retries once on 5xx, then succeeds', async () => {
    let productCalls = 0;
    const fetchImpl = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes('/oauth2/token')) return jsonResponse(TOKEN_JSON);
      productCalls += 1;
      if (productCalls === 1) return jsonResponse({ error: 'boom' }, 502);
      return jsonResponse({ data: [{ productId: 'a', description: 'Bananas' }] });
    }) as unknown as typeof fetch;

    const products = await clientWith(fetchImpl).searchProducts('bananas', '1');
    expect(productCalls).toBe(2);
    expect(products).toHaveLength(1);
  });

  it('does NOT retry on 429 — surfaces the rate limit', async () => {
    let productCalls = 0;
    const fetchImpl = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes('/oauth2/token')) return jsonResponse(TOKEN_JSON);
      productCalls += 1;
      return jsonResponse({ error: 'slow down' }, 429);
    }) as unknown as typeof fetch;

    await expect(clientWith(fetchImpl).searchProducts('bananas', '1')).rejects.toMatchObject({
      name: 'KrogerApiError',
      status: 429,
    });
    expect(productCalls).toBe(1);
  });

  it('addToCart sends PUT /v1/cart/add with the user token and resolves on 204', async () => {
    let cartInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).endsWith('/v1/cart/add')) {
        cartInit = init;
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected ${String(url)}`);
    }) as unknown as typeof fetch;

    await clientWith(fetchImpl).addToCart('user-token', [
      { upc: '0000000004011', quantity: 2, modality: 'PICKUP' },
    ]);
    expect(cartInit?.method).toBe('PUT');
    expect((cartInit?.headers as Record<string, string>).Authorization).toBe('Bearer user-token');
    expect(JSON.parse(String(cartInit?.body))).toEqual({
      items: [{ upc: '0000000004011', quantity: 2, modality: 'PICKUP' }],
    });
  });

  it('exchanges an auth code and surfaces the rotated refresh token', async () => {
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      expect(String(url)).toContain('/oauth2/token');
      const form = String(init?.body);
      expect(form).toContain('grant_type=authorization_code');
      expect(form).toContain('code=abc');
      expect(form).toContain(`redirect_uri=${encodeURIComponent('https://api.test/cb')}`);
      return jsonResponse({
        access_token: 'user-access',
        refresh_token: 'rotated-refresh',
        expires_in: 1800,
        token_type: 'bearer',
        scope: 'cart.basic:write',
      });
    }) as unknown as typeof fetch;

    const grant = await clientWith(fetchImpl).exchangeAuthCode('abc', 'https://api.test/cb');
    expect(grant.accessToken).toBe('user-access');
    expect(grant.refreshToken).toBe('rotated-refresh');
    expect(grant.scopes).toBe('cart.basic:write');
    expect(grant.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('refreshUserToken posts the refresh grant', async () => {
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const form = String(init?.body);
      expect(form).toContain('grant_type=refresh_token');
      expect(form).toContain('refresh_token=old-token');
      return jsonResponse({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 1800,
        token_type: 'bearer',
      });
    }) as unknown as typeof fetch;

    const grant = await clientWith(fetchImpl).refreshUserToken('old-token');
    expect(grant.refreshToken).toBe('new-refresh');
  });

  it('errors carry status and parsed body', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ errors: { reason: 'bad token' } }, 401),
    ) as unknown as typeof fetch;
    try {
      await clientWith(fetchImpl).addToCart('expired', []);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(KrogerApiError);
      expect((err as KrogerApiError).status).toBe(401);
      expect((err as KrogerApiError).body).toEqual({ errors: { reason: 'bad token' } });
    }
  });
});
