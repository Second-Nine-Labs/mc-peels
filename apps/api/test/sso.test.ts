import { describe, expect, it } from 'vitest';
import { HANDOFF_NONCE_PREFIX, sanitizeRedirectPath } from '../src/auth/sso.js';
import { ACCESS_TOKEN_PREFIX, CODE_PREFIX, REFRESH_TOKEN_PREFIX } from '../src/auth/oauth.js';
import { TOKEN_PREFIX } from '../src/auth/tokens.js';

describe('sanitizeRedirectPath', () => {
  it('defaults an absent value to the root path', () => {
    expect(sanitizeRedirectPath(undefined)).toBe('/');
    expect(sanitizeRedirectPath(null)).toBe('/');
  });

  it('passes through same-origin paths', () => {
    expect(sanitizeRedirectPath('/')).toBe('/');
    expect(sanitizeRedirectPath('/household')).toBe('/household');
    expect(sanitizeRedirectPath('/cart/abc?tab=items')).toBe('/cart/abc?tab=items');
  });

  it('rejects everything that could leave the origin', () => {
    expect(sanitizeRedirectPath('https://evil.example.com/')).toBeNull();
    expect(sanitizeRedirectPath('//evil.example.com/')).toBeNull();
    expect(sanitizeRedirectPath('/\\evil.example.com')).toBeNull();
    expect(sanitizeRedirectPath('household')).toBeNull();
    expect(sanitizeRedirectPath('')).toBeNull();
    expect(sanitizeRedirectPath(42)).toBeNull();
  });
});

describe('handoff nonce prefix', () => {
  it('never collides with the other credential prefixes', () => {
    const prefixes = [
      TOKEN_PREFIX,
      CODE_PREFIX,
      ACCESS_TOKEN_PREFIX,
      REFRESH_TOKEN_PREFIX,
      HANDOFF_NONCE_PREFIX,
    ];
    for (const a of prefixes) {
      for (const b of prefixes) {
        if (a !== b) expect(a.startsWith(b)).toBe(false);
      }
    }
  });
});
