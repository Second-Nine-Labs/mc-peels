import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { TOKEN_PREFIX, generateToken, hashToken } from '../src/auth/tokens.js';

describe('generateToken', () => {
  it('produces mcp_-prefixed, unique, double-click-selectable tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, generateToken));
    expect(tokens.size).toBe(100);
    for (const token of tokens) {
      expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
      // 32 bytes hex = 64 chars. Hex on purpose: no `-`, so browser word
      // selection grabs the whole token (base64url tokens got hand-copied
      // with characters missing — that was Third Brain's -32001).
      expect(token.slice(TOKEN_PREFIX.length)).toMatch(/^[0-9a-f]{64}$/);
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
