/**
 * At-rest encryption for provider OAuth tokens (PRD hard constraint: MC Peels
 * holds user grants, so they must never sit in the database in plaintext).
 *
 * AES-256-GCM with a random 96-bit IV per encryption. Output format:
 *   v1.<b64url iv>.<b64url ciphertext>.<b64url tag>
 * The `v1.` prefix reserves key/format rotation. The AAD binds a ciphertext to
 * its row (`${userId}:${provider}`) so a value copied between rows fails to
 * decrypt rather than granting another user's tokens.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;

/**
 * Resolve and validate TOKEN_ENCRYPTION_KEY lazily. Read straight from
 * process.env (not env()) so unit tests don't need the full zod environment —
 * same reasoning as the injectable Instacart client options.
 */
function key(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not set — provider connections are unavailable.');
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== KEY_BYTES) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes of base64 (openssl rand -base64 32).');
  }
  cachedKey = buf;
  return buf;
}

/** Test hook: clear the memoized key after mutating process.env. */
export function resetTokenCryptoForTests(): void {
  cachedKey = null;
}

export function encryptToken(plaintext: string, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    ct.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

export function decryptToken(blob: string, aad: string): string {
  const parts = blob.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unrecognized encrypted token format.');
  }
  const [, ivB64, ctB64, tagB64] = parts;
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64!, 'base64url'));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tagB64!, 'base64url'));
  // GCM tag verification happens in final(); tampering or an AAD mismatch throws.
  return Buffer.concat([decipher.update(Buffer.from(ctB64!, 'base64url')), decipher.final()]).toString(
    'utf8',
  );
}
