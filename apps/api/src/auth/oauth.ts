/**
 * OAuth 2.0 (authorization-code + PKCE) for agent hosts — Third Brain's
 * "Sign in with MC Peels". Contract: docs/third-brain-oauth-build.md.
 *
 * All credentials are opaque random strings stored as SHA-256 hashes, like
 * api_tokens: access tokens are revocable-by-row instead of stateless JWTs,
 * which keeps /mcp auth symmetric with verifyMcpToken and needs no signing key.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getDb, schema } from '../db/client.js';
import { hashToken } from './tokens.js';

/** The one registered client. Public PKCE client — no secret; PKCE is the proof. */
export const OAUTH_CLIENT_ID = 'third-brain';

export const OAUTH_SCOPE = 'groceries';

/** Prefixes keep the three credential kinds recognizable in logs and configs. */
export const CODE_PREFIX = 'mcpc_';
export const ACCESS_TOKEN_PREFIX = 'mcpa_';
export const REFRESH_TOKEN_PREFIX = 'mcpr_';

export const CODE_TTL_MS = 60_000;
export const ACCESS_TOKEN_TTL_S = 3600;

const DEFAULT_REDIRECT_ORIGINS = ['https://brainos.secondninelabs.com'];

/**
 * Server-side mirror of the web app's redirect allowlist (connect.tsx checks
 * the same rules client-side, but the API must not trust the client).
 */
export function redirectUriAllowed(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(isLocalhost && url.protocol === 'http:')) return false;
  if (isLocalhost) return true;
  const fromEnv = (process.env.CONNECT_REDIRECT_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const origins = fromEnv.length > 0 ? fromEnv : DEFAULT_REDIRECT_ORIGINS;
  return origins.includes(url.origin);
}

/** RFC 7636 S256: base64url(sha256(ascii(verifier))). */
export function computeCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function challengeMatches(verifier: string, expectedChallenge: string): boolean {
  const got = Buffer.from(computeCodeChallenge(verifier));
  const want = Buffer.from(expectedChallenge);
  return got.length === want.length && timingSafeEqual(got, want);
}

function opaque(prefix: string): string {
  return prefix + randomBytes(32).toString('base64url');
}

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
};

/** Mint a one-time authorization code bound to the consenting user + request. */
export async function createAuthorizationCode(input: {
  userId: string;
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scope: string;
}): Promise<{ code: string; expiresIn: number }> {
  const code = opaque(CODE_PREFIX);
  await getDb()
    .insert(schema.oauthCodes)
    .values({
      codeHash: hashToken(code),
      userId: input.userId,
      clientId: input.clientId,
      codeChallenge: input.codeChallenge,
      redirectUri: input.redirectUri,
      scope: input.scope,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
  return { code, expiresIn: CODE_TTL_MS / 1000 };
}

async function mintTokenPair(userId: string, clientId: string, scope: string): Promise<TokenPair> {
  const db = getDb();
  const accessToken = opaque(ACCESS_TOKEN_PREFIX);
  const refreshToken = opaque(REFRESH_TOKEN_PREFIX);
  await db.insert(schema.oauthAccessTokens).values({
    tokenHash: hashToken(accessToken),
    userId,
    clientId,
    scope,
    expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_S * 1000),
  });
  await db.insert(schema.oauthRefreshTokens).values({
    tokenHash: hashToken(refreshToken),
    userId,
    clientId,
    scope,
  });
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_S, scope };
}

/**
 * authorization_code grant. Consuming the code is a single conditional UPDATE,
 * so a replayed code loses the race and gets invalid_grant. Per RFC 6749 the
 * code burns even when the PKCE/redirect checks that follow it fail.
 */
export async function exchangeAuthorizationCode(input: {
  code: string;
  redirectUri: string;
  clientId: string;
  codeVerifier: string;
}): Promise<TokenPair | null> {
  const consumed = await getDb()
    .update(schema.oauthCodes)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(schema.oauthCodes.codeHash, hashToken(input.code)),
        isNull(schema.oauthCodes.consumedAt),
        gt(schema.oauthCodes.expiresAt, new Date()),
      ),
    )
    .returning();
  const row = consumed[0];
  if (!row) return null;
  if (row.clientId !== input.clientId) return null;
  if (row.redirectUri !== input.redirectUri) return null;
  if (!challengeMatches(input.codeVerifier, row.codeChallenge)) return null;
  return mintTokenPair(row.userId, row.clientId, row.scope);
}

/**
 * refresh_token grant, with rotation: the presented token is revoked in the
 * same conditional UPDATE that validates it, and a fresh pair is returned.
 */
export async function refreshAccessToken(input: {
  refreshToken: string;
  clientId: string;
}): Promise<TokenPair | null> {
  if (!input.refreshToken.startsWith(REFRESH_TOKEN_PREFIX)) return null;
  const revoked = await getDb()
    .update(schema.oauthRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.oauthRefreshTokens.tokenHash, hashToken(input.refreshToken)),
        isNull(schema.oauthRefreshTokens.revokedAt),
      ),
    )
    .returning();
  const row = revoked[0];
  if (!row) return null;
  if (row.clientId !== input.clientId) return null;
  return mintTokenPair(row.userId, row.clientId, row.scope);
}

/** Resolve an OAuth access token to its user, or null if unknown/expired. */
export async function verifyOAuthAccessToken(token: string): Promise<{ userId: string } | null> {
  if (!token.startsWith(ACCESS_TOKEN_PREFIX)) return null;
  const rows = await getDb()
    .select({ userId: schema.oauthAccessTokens.userId })
    .from(schema.oauthAccessTokens)
    .where(
      and(
        eq(schema.oauthAccessTokens.tokenHash, hashToken(token)),
        gt(schema.oauthAccessTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
