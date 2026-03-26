/**
 * auth.test.ts — Login flow, bcrypt, KV rate-limit TTL
 *
 * Run: cd workers && pnpm test src/__tests__/auth.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

// ── Schemas (mirror what is in index.ts) ──────────────────────────────────

const LoginSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
})

// ── KV rate-limit helpers (extracted from Workers handler logic) ──────────

interface KVStore {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_TTL = 60

async function checkRateLimit(kv: KVStore, ip: string): Promise<boolean> {
  const key = `rate:login:${ip}`
  const raw = await kv.get(key)
  const count = raw ? parseInt(raw, 10) : 0
  return count >= RATE_LIMIT_MAX
}

async function incrementRateLimit(kv: KVStore, ip: string): Promise<void> {
  const key = `rate:login:${ip}`
  const raw = await kv.get(key)
  const count = raw ? parseInt(raw, 10) : 0
  await kv.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_TTL })
}

// ── bcryptjs helpers ──────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs')
  return bcrypt.hash(password, 10)
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs')
  return bcrypt.compare(password, hash)
}

// ── Token generator (mirrors Workers implementation) ──────────────────────

function generateSessionToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Login — schema validation', () => {
  it('accepts valid credentials', () => {
    const r = LoginSchema.safeParse({ email: 'admin@webwaka.dev', password: 'secret123' })
    expect(r.success).toBe(true)
  })

  it('rejects invalid email format', () => {
    const r = LoginSchema.safeParse({ email: 'not-an-email', password: 'secret' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe('Valid email address is required')
  })

  it('rejects empty password', () => {
    const r = LoginSchema.safeParse({ email: 'admin@webwaka.dev', password: '' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe('Password is required')
  })

  it('rejects missing email', () => {
    const r = LoginSchema.safeParse({ password: 'secret' })
    expect(r.success).toBe(false)
  })

  it('rejects missing password', () => {
    const r = LoginSchema.safeParse({ email: 'admin@webwaka.dev' })
    expect(r.success).toBe(false)
  })
})

describe('bcryptjs — password hashing + comparison', () => {
  it('hashes a password and compares correctly', async () => {
    const plain = 'My$ecurePassword99'
    const hash = await hashPassword(plain)

    expect(hash).not.toBe(plain)
    expect(hash.startsWith('$2')).toBe(true) // bcrypt hash prefix

    const match = await comparePassword(plain, hash)
    expect(match).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery')
    const match = await comparePassword('wrong-password', hash)
    expect(match).toBe(false)
  })

  it('produces different hashes for the same input (salted)', async () => {
    const password = 'same-password'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)
    expect(hash1).not.toBe(hash2) // different salt each time
    // but both validate
    expect(await comparePassword(password, hash1)).toBe(true)
    expect(await comparePassword(password, hash2)).toBe(true)
  })
})

describe('KV rate limiting — 5 attempts / 60s', () => {
  let kvStore: Map<string, string>
  let kv: KVStore

  beforeEach(() => {
    kvStore = new Map()
    kv = {
      get: async (key) => kvStore.get(key) ?? null,
      put: async (key, value) => { kvStore.set(key, value) },
    }
  })

  it('allows first 5 attempts', async () => {
    const ip = '1.2.3.4'
    for (let i = 0; i < 5; i++) {
      const blocked = await checkRateLimit(kv, ip)
      expect(blocked).toBe(false)
      await incrementRateLimit(kv, ip)
    }
  })

  it('blocks on the 6th attempt', async () => {
    const ip = '5.6.7.8'
    for (let i = 0; i < 5; i++) {
      await incrementRateLimit(kv, ip)
    }
    const blocked = await checkRateLimit(kv, ip)
    expect(blocked).toBe(true)
  })

  it('uses IP-scoped KV key (rate:login:<ip>)', async () => {
    const ip = '10.0.0.1'
    await incrementRateLimit(kv, ip)
    expect(kvStore.has(`rate:login:${ip}`)).toBe(true)
  })

  it('different IPs have independent counters', async () => {
    const ip1 = '192.168.1.1'
    const ip2 = '192.168.1.2'
    for (let i = 0; i < 5; i++) await incrementRateLimit(kv, ip1)
    expect(await checkRateLimit(kv, ip1)).toBe(true)
    expect(await checkRateLimit(kv, ip2)).toBe(false)
  })

  it('increments counter correctly', async () => {
    const ip = '99.1.2.3'
    for (let i = 1; i <= 3; i++) {
      await incrementRateLimit(kv, ip)
      const val = kvStore.get(`rate:login:${ip}`)
      expect(val).toBe(String(i))
    }
  })
})

describe('Session token generation', () => {
  it('generates a 64-char hex string', () => {
    const token = generateSessionToken()
    expect(token).toHaveLength(64)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 50 }, generateSessionToken))
    expect(tokens.size).toBe(50) // all 50 are distinct
  })
})

describe('JWT_SECRET invariant — fail-safe not fail-open', () => {
  it('throws when JWT_SECRET is empty string', () => {
    const validateSecret = (secret: string | undefined) => {
      if (!secret || secret.trim() === '') {
        throw new Error('JWT_SECRET environment variable required')
      }
      return secret
    }
    expect(() => validateSecret('')).toThrow('JWT_SECRET environment variable required')
    expect(() => validateSecret(undefined)).toThrow('JWT_SECRET environment variable required')
    expect(() => validateSecret('   ')).toThrow('JWT_SECRET environment variable required')
  })

  it('passes when JWT_SECRET is set', () => {
    const validateSecret = (secret: string | undefined) => {
      if (!secret || secret.trim() === '') throw new Error('JWT_SECRET environment variable required')
      return secret
    }
    expect(validateSecret('my-256-bit-secret')).toBe('my-256-bit-secret')
  })
})
