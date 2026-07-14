/**
 * Kroger account linking (OAuth2 authorization-code flow).
 *
 * The state parameter is a short-lived HS256 JWT binding the flow to the
 * initiating user (uid claim) and their return destination. Identity on the
 * callback comes from that claim — never from a session — so a forged or
 * replayed callback can't attach tokens to someone else's account (CSRF /
 * session-swap immune). Signing key is derived from TOKEN_ENCRYPTION_KEY, so
 * no extra secret to manage.
 *
 * User grant scope is cart.basic:write ONLY (least privilege): product search
 * runs on the app's client_credentials token, not the user's.
 */

import { createHash } from 'node:crypto';

import { SignJWT, jwtVerify } from 'jose';

import { env } from '../../env.js';

const STATE_TTL_SECONDS = 10 * 60;
export const KROGER_USER_SCOPES = 'cart.basic:write';

export interface KrogerOAuthState {
  uid: string;
  returnTo: string;
}

function stateKey(): Uint8Array {
  const base = process.env.TOKEN_ENCRYPTION_KEY;
  if (!base) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not set — Kroger connect is unavailable.');
  }
  return createHash('sha256').update(`${base}:state`).digest();
}

/** The redirect_uri registered with Kroger — exact match required. */
export function krogerRedirectUri(): string {
  const base = env().API_PUBLIC_URL;
  if (!base) {
    throw new Error('API_PUBLIC_URL is not set — Kroger connect is unavailable.');
  }
  return `${base.replace(/\/+$/, '')}/api/v1/connect/kroger/callback`;
}

export async function signState(state: KrogerOAuthState): Promise<string> {
  return new SignJWT({ uid: state.uid, return_to: state.returnTo })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .setJti(crypto.randomUUID())
    .sign(stateKey());
}

/** Throws on tamper/expiry; returns the bound user + destination. */
export async function verifyState(token: string): Promise<KrogerOAuthState> {
  const { payload } = await jwtVerify(token, stateKey());
  if (typeof payload.uid !== 'string' || typeof payload.return_to !== 'string') {
    throw new Error('Malformed Kroger OAuth state.');
  }
  return { uid: payload.uid, returnTo: payload.return_to };
}

/**
 * Validate a post-OAuth return destination. Allowed: the app's custom scheme
 * (native), localhost (dev), and origins in CONNECT_RETURN_ORIGINS — the same
 * philosophy as the agent-connect allowlist in the mobile app, enforced
 * server-side because the callback redirect happens here.
 */
export function validateReturnTo(raw: string): string {
  if (raw.startsWith('mcpeels://')) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('return_to must be an absolute URL or mcpeels:// path.');
  }
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(isLocalhost && url.protocol === 'http:')) {
    throw new Error('return_to must use https.');
  }
  if (isLocalhost) return raw;
  const allowed = env()
    .CONNECT_RETURN_ORIGINS.split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (!allowed.includes(url.origin)) {
    throw new Error(`${url.origin} is not an approved return destination.`);
  }
  return raw;
}

/** The Kroger authorize URL the client navigates to. */
export function buildAuthorizeUrl(state: string): string {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: env().KROGER_CLIENT_ID ?? '',
    redirect_uri: krogerRedirectUri(),
    scope: KROGER_USER_SCOPES,
    state,
  });
  return `${env().KROGER_BASE_URL}/v1/connect/oauth2/authorize?${query.toString()}`;
}

/** Append ?kroger=... to the return destination (works for scheme URLs too). */
export function withResult(returnTo: string, result: 'connected' | 'error', reason?: string): string {
  const sep = returnTo.includes('?') ? '&' : '?';
  const suffix = result === 'connected' ? 'kroger=connected' : `kroger=error&reason=${encodeURIComponent(reason ?? 'unknown')}`;
  return `${returnTo}${sep}${suffix}`;
}
