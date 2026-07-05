import { describe, expect, it, vi } from 'vitest';
import { InstacartApiError, createInstacartClient } from '../src/instacart/client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mkClient(fetchImpl: typeof fetch) {
  return createInstacartClient({
    apiKey: 'test-key',
    baseUrl: 'https://connect.example.test',
    fetchImpl,
  });
}

describe('listNearbyRetailers', () => {
  it('maps the wire shape to RetailerInfo', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        retailers: [
          { retailer_key: 'kroger', name: 'Kroger', retailer_logo_url: 'https://logo' },
          { retailer_key: 'aldi', name: 'Aldi', retailer_logo_url: '' },
        ],
      }),
    );
    const retailers = await mkClient(fetchImpl as typeof fetch).listNearbyRetailers(
      '10001',
      'US',
    );
    expect(retailers).toEqual([
      { retailerKey: 'kroger', name: 'Kroger', logoUrl: 'https://logo' },
      { retailerKey: 'aldi', name: 'Aldi', logoUrl: null },
    ]);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://connect.example.test/idp/v1/retailers?postal_code=10001&country_code=US');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
  });
});

describe('createProductsLinkPage', () => {
  it('returns the products link URL on success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { products_link_url: 'https://ic/list/1' }));
    const result = await mkClient(fetchImpl as typeof fetch).createProductsLinkPage({
      title: 'T',
      line_items: [{ name: 'bananas' }],
    });
    expect(result).toEqual({ productsLinkUrl: 'https://ic/list/1' });
  });

  it('throws InstacartApiError with status and parsed body on 4xx', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { errors: [{ message: 'bad item' }] }));
    const promise = mkClient(fetchImpl as typeof fetch).createProductsLinkPage({
      title: 'T',
      line_items: [{ name: 'x' }],
    });
    await expect(promise).rejects.toBeInstanceOf(InstacartApiError);
    await promise.catch((err: InstacartApiError) => {
      expect(err.status).toBe(422);
      expect(err.body).toEqual({ errors: [{ message: 'bad item' }] });
    });
    // 4xx must not be retried.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries once on 5xx and succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: 'unavailable' }))
      .mockResolvedValueOnce(jsonResponse(200, { products_link_url: 'https://ic/list/2' }));
    const result = await mkClient(fetchImpl as typeof fetch).createProductsLinkPage({
      title: 'T',
      line_items: [{ name: 'x' }],
    });
    expect(result.productsLinkUrl).toBe('https://ic/list/2');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries once on network failure and succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse(200, { products_link_url: 'https://ic/list/3' }));
    const result = await mkClient(fetchImpl as typeof fetch).createProductsLinkPage({
      title: 'T',
      line_items: [{ name: 'x' }],
    });
    expect(result.productsLinkUrl).toBe('https://ic/list/3');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('surfaces a repeated network failure as InstacartApiError status 0, not a raw error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const promise = mkClient(fetchImpl as typeof fetch).createProductsLinkPage({
      title: 'T',
      line_items: [{ name: 'x' }],
    });
    await expect(promise).rejects.toBeInstanceOf(InstacartApiError);
    await promise.catch((err: InstacartApiError) => {
      expect(err.status).toBe(0);
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
