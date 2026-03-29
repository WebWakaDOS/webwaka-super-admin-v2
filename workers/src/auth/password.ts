/**
 * WebWaka Super Admin v2 — Password Utilities
 * Blueprint Reference: Part 9.2 (Auth Security Standards)
 *
 * Uses PBKDF2 via the Web Crypto API — the only password hashing algorithm
 * available natively in the Cloudflare Workers runtime.
 *
 * Format: pbkdf2:<iterations>:<salt_hex>:<hash_hex>
 * Example: pbkdf2:310000:a1b2c3...:d4e5f6...
 *
 * PBKDF2 parameters:
 *  - Algorithm: SHA-256
 *  - Iterations: 310,000 (OWASP 2024 recommendation for PBKDF2-SHA256)
 *  - Salt: 16 bytes (128 bits) cryptographically random
 *  - Key length: 32 bytes (256 bits)
 *
 * NOTE: The migration seed hash (bcrypt) must be replaced with a PBKDF2 hash
 * via migration 011_fix_password_hashing.sql before this code is deployed.
 */

const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const HASH_PREFIX = 'pbkdf2';

/**
 * Hash a plaintext password using PBKDF2-SHA256.
 * Returns a portable string in the format: pbkdf2:<iterations>:<salt_hex>:<hash_hex>
 */
export async function hashPassword(plaintext: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plaintext),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    KEY_BYTES * 8
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${HASH_PREFIX}:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

/**
 * Verify a plaintext password against a stored PBKDF2 hash string.
 * Returns true only if the password matches. Uses timing-safe comparison.
 */
export async function verifyPassword(plaintext: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split(':');
    if (parts.length !== 4 || parts[0] !== HASH_PREFIX) return false;

    const iterations = parseInt(parts[1] ?? '0', 10);
    const saltHex = parts[2] ?? '';
    const storedHashHex = parts[3] ?? '';

    if (!iterations || !saltHex || !storedHashHex) return false;

    const salt = new Uint8Array(
      saltHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
    );

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(plaintext),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt,
        iterations,
      },
      keyMaterial,
      KEY_BYTES * 8
    );

    const candidateHex = Array.from(new Uint8Array(derivedBits))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Timing-safe comparison using crypto.subtle.verify via HMAC trick
    // Both strings are same length (hex of KEY_BYTES), so simple char-by-char
    // comparison with accumulated XOR is timing-safe enough for this context.
    if (candidateHex.length !== storedHashHex.length) return false;
    let diff = 0;
    for (let i = 0; i < candidateHex.length; i++) {
      diff |= candidateHex.charCodeAt(i) ^ storedHashHex.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}
