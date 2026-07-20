/**
 * Cross-app session handoff: an agent host (Third Brain) trades a member's MCP
 * bearer for a one-time URL that opens the MC Peels web app already signed in
 * as that member. Contract + security properties: docs/fix-third-brain-connect.md
 * ("NEW ASK — session handoff").
 *
 * Two hops, so nothing long-lived ever rides a URL:
 *  1. POST /api/v1/sso/handoff (MCP bearer auth) mints a single-use 60s nonce,
 *     returned in a URL *fragment* — fragments never reach server access logs.
 *  2. The web app's /auth/handoff screen posts the nonce to /sso/redeem; only
 *     then is a Supabase magiclink token_hash minted (GoTrue admin REST, same
 *     service-role pattern as art/storage.ts) and handed to the browser, which
 *     burns it immediately via supabase.auth.verifyOtp. GoTrue enforces
 *     single-use; the token lives for milliseconds in practice.
 */

import { randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { env } from '../env.js';
import { getDb, schema } from '../db/client.js';
import { hashToken } from './tokens.js';

export const HANDOFF_NONCE_PREFIX = 'mcph_';
export const HANDOFF_NONCE_TTL_MS = 60_000;

/** Where the handoff URL points — the consumer web app, not this API. */
export function webOrigin(): string {
  return env().WEB_PUBLIC_URL.replace(/\/+$/, '');
}

/**
 * redirect_to must be a path on the MC Peels origin: open-redirect guard.
 * Absent → "/". Absolute URLs, protocol-relative (`//host`), and backslash
 * variants (browsers normalize `\` to `/`) are rejected, not repaired.
 */
export function sanitizeRedirectPath(raw: unknown): string | null {
  if (raw === undefined || raw === null) return '/';
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  return raw;
}

export async function createHandoffNonce(
  userId: string,
  redirectTo: string,
): Promise<{ nonce: string; expiresIn: number }> {
  const nonce = HANDOFF_NONCE_PREFIX + randomBytes(32).toString('base64url');
  await getDb()
    .insert(schema.ssoHandoffNonces)
    .values({
      nonceHash: hashToken(nonce),
      userId,
      redirectTo,
      expiresAt: new Date(Date.now() + HANDOFF_NONCE_TTL_MS),
    });
  return { nonce, expiresIn: HANDOFF_NONCE_TTL_MS / 1000 };
}

function adminHeaders(serviceKey: string): Record<string, string> {
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
  };
}

async function adminUserEmail(base: string, serviceKey: string, userId: string): Promise<string | null> {
  const response = await fetch(`${base}/auth/v1/admin/users/${userId}`, {
    headers: adminHeaders(serviceKey),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { email?: string };
  return typeof json.email === 'string' && json.email.length > 0 ? json.email : null;
}

/** GoTrue's generate_link response is flat in some versions, nested in others. */
async function mintMagiclinkTokenHash(
  base: string,
  serviceKey: string,
  email: string,
): Promise<string | null> {
  const response = await fetch(`${base}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: adminHeaders(serviceKey),
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as {
    hashed_token?: string;
    properties?: { hashed_token?: string };
  };
  const hash = json.hashed_token ?? json.properties?.hashed_token;
  return typeof hash === 'string' && hash.length > 0 ? hash : null;
}

/**
 * Atomically consume a nonce, then mint the short-lived Supabase credential
 * for its user. null = unknown/expired/already-used nonce (one 401 for all
 * three — a probe learns nothing). Throws on missing server config or a
 * GoTrue failure, which surface as 500s: those are our bugs, not the caller's.
 */
export async function redeemHandoffNonce(
  nonce: string,
): Promise<{ tokenHash: string; redirectTo: string } | null> {
  if (!nonce.startsWith(HANDOFF_NONCE_PREFIX)) return null;
  const consumed = await getDb()
    .update(schema.ssoHandoffNonces)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(schema.ssoHandoffNonces.nonceHash, hashToken(nonce)),
        isNull(schema.ssoHandoffNonces.consumedAt),
        gt(schema.ssoHandoffNonces.expiresAt, new Date()),
      ),
    )
    .returning();
  const row = consumed[0];
  if (!row) return null;

  const serviceKey = env().SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  const base = env().SUPABASE_URL.replace(/\/+$/, '');

  const email = await adminUserEmail(base, serviceKey, row.userId);
  if (!email) throw new Error(`Handoff user ${row.userId} has no resolvable email`);
  const tokenHash = await mintMagiclinkTokenHash(base, serviceKey, email);
  if (!tokenHash) throw new Error('GoTrue generate_link returned no token hash');

  return { tokenHash, redirectTo: row.redirectTo };
}
