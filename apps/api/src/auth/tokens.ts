/**
 * Personal access tokens for MCP clients (e.g. Third Brain's Chief of Staff).
 * Only a SHA-256 hash is persisted; the plaintext is returned exactly once.
 */

import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { notFound } from '../core/errors.js';
import { getDb, schema } from '../db/client.js';

export const TOKEN_PREFIX = 'mcp_';

/**
 * 32 random bytes, hex — prefixed so tokens are recognizable in configs.
 * Hex (not base64url) on purpose: `-` breaks browser double-click selection,
 * and a hand-selected token that loses characters hashes to nothing. Hex plus
 * the `_` in the prefix selects as one word. Old base64url tokens still verify.
 */
export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createApiToken(userId: string, name: string) {
  const token = generateToken();
  const [row] = await getDb()
    .insert(schema.apiTokens)
    .values({ userId, name, tokenHash: hashToken(token) })
    .returning();
  return { id: row!.id, name: row!.name, createdAt: row!.createdAt, token };
}

export async function listApiTokens(userId: string) {
  return getDb()
    .select({
      id: schema.apiTokens.id,
      name: schema.apiTokens.name,
      lastUsedAt: schema.apiTokens.lastUsedAt,
      createdAt: schema.apiTokens.createdAt,
    })
    .from(schema.apiTokens)
    .where(eq(schema.apiTokens.userId, userId))
    .orderBy(desc(schema.apiTokens.createdAt));
}

export async function revokeApiToken(userId: string, tokenId: string): Promise<void> {
  const deleted = await getDb()
    .delete(schema.apiTokens)
    .where(and(eq(schema.apiTokens.id, tokenId), eq(schema.apiTokens.userId, userId)))
    .returning({ id: schema.apiTokens.id });
  if (deleted.length === 0) {
    throw notFound('Token not found');
  }
}

/**
 * Resolve an MCP bearer token to its user, or null if unknown.
 * `touch: false` skips the last_used_at update — used by the paste-to-verify
 * endpoint so a pre-flight check doesn't masquerade as real agent traffic.
 */
export async function verifyMcpToken(
  token: string,
  opts: { touch?: boolean } = {},
): Promise<{ userId: string } | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.apiTokens)
    .where(eq(schema.apiTokens.tokenHash, hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (opts.touch !== false) {
    await db
      .update(schema.apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.apiTokens.id, row.id));
  }
  return { userId: row.userId };
}
