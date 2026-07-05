import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { TOKEN_PREFIX, generateToken, hashToken } from '../src/auth/tokens.js';

describe('generateToken', () => {
  it('produces mcp_-prefixed, unique, URL-safe tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, generateToken));
    expect(tokens.size).toBe(100);
    for (const token of tokens) {
      expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
      // 32 bytes base64url = 43 chars, no padding or unsafe characters.
      expect(token.slice(TOKEN_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });
});

describe('hashToken', () => {
  it('is deterministic hex sha256', () => {
    const token = 'mcp_example';
    const expected = createHash('sha256').update(token).digest('hex');
    expect(hashToken(token)).toBe(expected);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});
