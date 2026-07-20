/**
 * Shared pieces of the agent-connect surfaces: /connect (PAT handoff) and
 * /oauth/authorize (authorization-code flow). Both mint credentials into a
 * redirect, so both must agree on which destinations are trustworthy.
 */

const DEFAULT_ALLOWED_ORIGINS = ['https://brainos.secondninelabs.com'];

export function allowedOrigins(): string[] {
  const fromEnv = (process.env.EXPO_PUBLIC_CONNECT_REDIRECT_ORIGINS ?? '')
    .split(',')
    .map((s: string) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
}

export type RedirectCheck =
  | { kind: 'none' }
  | { kind: 'ok'; url: URL }
  | { kind: 'rejected'; reason: string };

export function checkRedirect(raw: string | undefined): RedirectCheck {
  if (!raw) return { kind: 'none' };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: 'rejected', reason: 'The redirect_uri is not a valid absolute URL.' };
  }
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(isLocalhost && url.protocol === 'http:')) {
    return { kind: 'rejected', reason: 'The redirect_uri must use https.' };
  }
  // localhost is always allowed (standard practice for local agent development;
  // an attacker cannot receive tokens on the victim's own machine).
  if (isLocalhost || allowedOrigins().includes(url.origin)) {
    return { kind: 'ok', url };
  }
  return {
    kind: 'rejected',
    reason: `${url.origin} is not an approved destination for MC Peels tokens.`,
  };
}

export function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
