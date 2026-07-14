import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  decryptToken,
  encryptToken,
  resetTokenCryptoForTests,
} from '../src/fulfillment/token-crypto.js';

// 32 zero bytes, base64 — a valid (test-only) key.
const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

describe('token-crypto', () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
    resetTokenCryptoForTests();
  });

  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    resetTokenCryptoForTests();
  });

  it('round-trips a token with matching AAD', () => {
    const blob = encryptToken('kroger-access-token-abc123', 'user-1:kroger');
    expect(decryptToken(blob, 'user-1:kroger')).toBe('kroger-access-token-abc123');
  });

  it('emits the v1 four-part format with unique IVs', () => {
    const a = encryptToken('same-plaintext', 'user-1:kroger');
    const b = encryptToken('same-plaintext', 'user-1:kroger');
    expect(a.split('.')).toHaveLength(4);
    expect(a.startsWith('v1.')).toBe(true);
    expect(a).not.toBe(b); // random IV per encryption
  });

  it('rejects a ciphertext transplanted to another row (AAD mismatch)', () => {
    const blob = encryptToken('secret', 'user-1:kroger');
    expect(() => decryptToken(blob, 'user-2:kroger')).toThrow();
  });

  it('rejects tampered ciphertext (GCM tag failure)', () => {
    const blob = encryptToken('secret', 'user-1:kroger');
    const parts = blob.split('.');
    const ct = Buffer.from(parts[2]!, 'base64url');
    ct[0] = ct[0]! ^ 0xff;
    parts[2] = ct.toString('base64url');
    expect(() => decryptToken(parts.join('.'), 'user-1:kroger')).toThrow();
  });

  it('rejects unknown formats', () => {
    expect(() => decryptToken('v2.a.b.c', 'user-1:kroger')).toThrow(/format/i);
    expect(() => decryptToken('not-encrypted', 'user-1:kroger')).toThrow(/format/i);
  });

  it('fails loudly when the key is missing or malformed', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    resetTokenCryptoForTests();
    expect(() => encryptToken('x', 'a:b')).toThrow(/TOKEN_ENCRYPTION_KEY/);

    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(16).toString('base64'); // wrong size
    resetTokenCryptoForTests();
    expect(() => encryptToken('x', 'a:b')).toThrow(/32 bytes/);
  });
});
