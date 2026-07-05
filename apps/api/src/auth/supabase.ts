import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { unauthorized } from '../core/errors';
import { env } from '../env';

export interface AuthenticatedUser {
  userId: string;
  email: string | null;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${env().SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

/**
 * Verify a Supabase access token. Uses the legacy HS256 project secret when
 * SUPABASE_JWT_SECRET is configured; otherwise verifies against the project's
 * JWKS endpoint (newer asymmetric signing keys).
 */
export async function verifySupabaseToken(token: string): Promise<AuthenticatedUser> {
  let payload: JWTPayload;
  try {
    const secret = env().SUPABASE_JWT_SECRET;
    if (secret) {
      ({ payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        audience: 'authenticated',
      }));
    } else {
      ({ payload } = await jwtVerify(token, getJwks(), { audience: 'authenticated' }));
    }
  } catch {
    throw unauthorized('Invalid or expired access token');
  }

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw unauthorized('Token has no subject');
  }
  return {
    userId: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
  };
}
