import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_KEY = Buffer.alloc(32, 9).toString('base64');

/** oauth.ts reads env() (memoized) — import it fresh per configuration. */
async function freshOauth(extraEnv: Record<string, string> = {}) {
  vi.resetModules();
  process.env.DATABASE_URL = 'postgres://test';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.ANTHROPIC_API_KEY = 'test';
  process.env.INSTACART_API_KEY = 'test';
  process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  process.env.KROGER_CLIENT_ID = 'kroger-client';
  process.env.API_PUBLIC_URL = 'https://api.test';
  for (const [k, v] of Object.entries(extraEnv)) process.env[k] = v;
  return import('../src/fulfillment/kroger/oauth.js');
}

describe('kroger oauth', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    for (const k of [
      'TOKEN_ENCRYPTION_KEY',
      'KROGER_CLIENT_ID',
      'API_PUBLIC_URL',
      'CONNECT_RETURN_ORIGINS',
    ]) {
      delete process.env[k];
    }
  });

  it('signs and verifies state, binding uid and return_to', async () => {
    const oauth = await freshOauth();
    const token = await oauth.signState({ uid: 'user-1', returnTo: 'mcpeels://cart/abc' });
    const state = await oauth.verifyState(token);
    expect(state).toEqual({ uid: 'user-1', returnTo: 'mcpeels://cart/abc' });
  });

  it('rejects tampered and expired state', async () => {
    const oauth = await freshOauth();
    const token = await oauth.signState({ uid: 'user-1', returnTo: 'mcpeels://cart/abc' });
    await expect(oauth.verifyState(`${token}x`)).rejects.toThrow();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    await expect(oauth.verifyState(token)).rejects.toThrow();
    vi.useRealTimers();
  });

  it('builds the authorize URL with least-privilege scope and exact redirect', async () => {
    const oauth = await freshOauth();
    const url = new URL(oauth.buildAuthorizeUrl('signed-state'));
    expect(url.origin + url.pathname).toBe('https://api.kroger.com/v1/connect/oauth2/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('kroger-client');
    expect(url.searchParams.get('scope')).toBe('cart.basic:write');
    expect(url.searchParams.get('state')).toBe('signed-state');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.test/api/v1/connect/kroger/callback',
    );
  });

  describe('validateReturnTo', () => {
    it('always allows the app scheme and localhost', async () => {
      const oauth = await freshOauth();
      expect(oauth.validateReturnTo('mcpeels://cart/abc')).toBe('mcpeels://cart/abc');
      expect(oauth.validateReturnTo('http://localhost:8081/cart/abc')).toBe(
        'http://localhost:8081/cart/abc',
      );
    });

    it('allows configured origins, rejects everything else', async () => {
      const oauth = await freshOauth({
        CONNECT_RETURN_ORIGINS: 'https://mc-peels.secondninelabs.com',
      });
      expect(oauth.validateReturnTo('https://mc-peels.secondninelabs.com/cart/abc')).toBeTruthy();
      expect(() => oauth.validateReturnTo('https://evil.example.com/cart/abc')).toThrow(
        /not an approved/,
      );
      expect(() => oauth.validateReturnTo('http://mc-peels.secondninelabs.com/cart/abc')).toThrow(
        /https/,
      );
      expect(() => oauth.validateReturnTo('not a url')).toThrow(/absolute URL/);
    });
  });

  it('withResult appends the outcome to any destination shape', async () => {
    const oauth = await freshOauth();
    expect(oauth.withResult('mcpeels://cart/abc', 'connected')).toBe(
      'mcpeels://cart/abc?kroger=connected',
    );
    expect(oauth.withResult('https://a.test/cart/1?x=1', 'error', 'access_denied')).toBe(
      'https://a.test/cart/1?x=1&kroger=error&reason=access_denied',
    );
  });
});
