import { describe, expect, it } from 'vitest';
import {
  ACCESS_TOKEN_PREFIX,
  CODE_PREFIX,
  REFRESH_TOKEN_PREFIX,
  computeCodeChallenge,
  redirectUriAllowed,
} from '../src/auth/oauth.js';
import { TOKEN_PREFIX } from '../src/auth/tokens.js';

describe('computeCodeChallenge', () => {
  it('matches the RFC 7636 appendix B vector', () => {
    expect(computeCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('credential prefixes', () => {
  it('never collide with each other or with personal access tokens', () => {
    // /mcp routes on prefix: an OAuth access token must not look like a PAT.
    const prefixes = [TOKEN_PREFIX, CODE_PREFIX, ACCESS_TOKEN_PREFIX, REFRESH_TOKEN_PREFIX];
    for (const a of prefixes) {
      for (const b of prefixes) {
        if (a !== b) expect(a.startsWith(b)).toBe(false);
      }
    }
  });
});

describe('redirectUriAllowed', () => {
  it('allows the Third Brain callback and localhost dev', () => {
    expect(redirectUriAllowed('https://brainos.secondninelabs.com/api/mcpeels/callback')).toBe(true);
    expect(redirectUriAllowed('http://localhost:3000/api/mcpeels/callback')).toBe(true);
    expect(redirectUriAllowed('http://127.0.0.1:8787/cb')).toBe(true);
  });

  it('rejects unlisted origins, plain http, and garbage', () => {
    expect(redirectUriAllowed('https://evil.example.com/cb')).toBe(false);
    expect(redirectUriAllowed('http://brainos.secondninelabs.com/api/mcpeels/callback')).toBe(false);
    expect(redirectUriAllowed('not a url')).toBe(false);
    expect(redirectUriAllowed('')).toBe(false);
  });
});
