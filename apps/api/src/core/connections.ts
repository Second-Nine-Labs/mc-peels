/**
 * Linked provider accounts (Kroger today). Tokens are encrypted at rest and
 * NEVER leave the server — clients only ever see { provider, connected_at }.
 */

import { and, eq } from 'drizzle-orm';

import { getDb } from '../db/client.js';
import * as schema from '../db/schema.js';
import { decryptToken, encryptToken } from '../fulfillment/token-crypto.js';

export interface ProviderGrant {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string;
}

export interface ConnectionSummary {
  provider: string;
  connectedAt: Date;
}

function aad(userId: string, provider: string): string {
  return `${userId}:${provider}`;
}

/** Upsert a grant (initial link AND refresh-token rotation both land here). */
export async function saveConnection(
  userId: string,
  provider: string,
  grant: ProviderGrant,
): Promise<void> {
  const values = {
    userId,
    provider,
    accessTokenEnc: encryptToken(grant.accessToken, aad(userId, provider)),
    refreshTokenEnc: encryptToken(grant.refreshToken, aad(userId, provider)),
    accessTokenExpiresAt: grant.expiresAt,
    scopes: grant.scopes,
  };
  await getDb()
    .insert(schema.providerConnections)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.providerConnections.userId, schema.providerConnections.provider],
      set: { ...values, updatedAt: new Date() },
    });
}

/** Decrypted grant for server-side use, or null when not linked. */
export async function getConnection(
  userId: string,
  provider: string,
): Promise<ProviderGrant | null> {
  const [row] = await getDb()
    .select()
    .from(schema.providerConnections)
    .where(
      and(
        eq(schema.providerConnections.userId, userId),
        eq(schema.providerConnections.provider, provider),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    accessToken: decryptToken(row.accessTokenEnc, aad(userId, provider)),
    refreshToken: decryptToken(row.refreshTokenEnc, aad(userId, provider)),
    expiresAt: row.accessTokenExpiresAt,
    scopes: row.scopes,
  };
}

/** Drop a link (user revoke, or invalid_grant cleanup). */
export async function deleteConnection(userId: string, provider: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(schema.providerConnections)
    .where(
      and(
        eq(schema.providerConnections.userId, userId),
        eq(schema.providerConnections.provider, provider),
      ),
    )
    .returning({ id: schema.providerConnections.id });
  return deleted.length > 0;
}

export async function listConnections(userId: string): Promise<ConnectionSummary[]> {
  const rows = await getDb()
    .select()
    .from(schema.providerConnections)
    .where(eq(schema.providerConnections.userId, userId));
  return rows.map((r) => ({ provider: r.provider, connectedAt: r.createdAt }));
}
