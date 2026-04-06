/**
 * WebWaka Super Admin API v2
 * Phase 3: Complete Hono API — 35+ endpoints
 *
 * Endpoints:
 *   Health:       GET /health, GET /health/services, GET /health/metrics, POST /health/check
 *   Auth:         POST /auth/login, POST /auth/logout, GET /auth/me
 *   Tenants:      GET /tenants, POST /tenants, GET /tenants/:id, PUT /tenants/:id, DELETE /tenants/:id
 *   Partners:     GET /partners, POST /partners, GET /partners/:id, PUT /partners/:id, DELETE /partners/:id, POST /partners/:id/suites
 *   Deployments:  GET /deployments, GET /deployments/:id, PUT /deployments/:id/status, POST /deployments/refresh
 *   Operations:   GET /operations/metrics, GET /operations/summary, POST /operations/metrics, GET /operations/ai-usage
 *   AI Quotas:    GET /ai-quotas/:tenantId, PUT /ai-quotas/:tenantId, POST /ai-quotas/:tenantId/reset
 *   Billing:      GET /billing/ledger, GET /billing/summary, POST /billing/entry
 *   Modules:      GET /modules, GET /modules/:tenantId, PUT /modules/:tenantId/:moduleId
 *   Settings:     GET /settings, PUT /settings
 *
 * Compliance: 7 Core Invariants (Nigeria First, Build Once Use Infinitely, etc.)
 * Security:   Hardened 2026-03-29 — PBKDF2 password verification, signed JWTs,
 *             secureCORS (no wildcard in prod), KV-backed rate limiting
 * Date: 2026-03-21 | Updated: 2026-03-29
 */

import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import type { Context as HonoContext } from 'hono'
import { hashPassword, verifyPassword } from './auth/password'
import { z } from 'zod'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type Bindings = {
  // D1 Databases
  TENANTS_DB: D1Database
  BILLING_DB: D1Database
  RBAC_DB: D1Database
  MODULES_DB: D1Database
  HEALTH_DB: D1Database

  // KV Namespaces
  SESSIONS_KV: KVNamespace
  FEATURE_FLAGS_KV: KVNamespace
  CACHE_KV: KVNamespace
  NOTIFICATIONS_KV: KVNamespace
  RATE_LIMIT_KV: KVNamespace

  // Service Bindings (T-FND-03: Cross-repo tenant provisioning)
  COMMERCE_WORKER: Fetcher

  // Environment variables
  JWT_SECRET: string
  ENVIRONMENT: string
  INTER_SERVICE_SECRET: string
}

type Context = HonoContext<{ Bindings: Bindings }>

// ============================================================================
// INITIALIZATION
// ============================================================================

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger())

// ============================================================================
// SECURITY: Environment-aware CORS — never wildcard in production
// ============================================================================
const ALLOWED_ORIGINS_STAGING = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://super-admin-staging.webwaka.app',
]
const ALLOWED_ORIGINS_PRODUCTION = [
  'https://admin.webwaka.app',
  'https://super-admin.webwaka.app',
]
app.use('*', async (c, next) => {
  const env = c.env.ENVIRONMENT || 'development'
  const origin = c.req.header('Origin') || ''
  const allowed =
    env === 'production'
      ? ALLOWED_ORIGINS_PRODUCTION
      : env === 'staging'
        ? ALLOWED_ORIGINS_STAGING
        : true // development: allow all
  const isAllowed = allowed === true || (Array.isArray(allowed) && allowed.includes(origin))
  if (c.req.method === 'OPTIONS') {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    }
    if (isAllowed) headers['Access-Control-Allow-Origin'] = origin || '*'
    return new Response(null, { status: 204, headers })
  }
  await next()
  if (isAllowed && origin) {
    c.res.headers.set('Access-Control-Allow-Origin', origin)
    c.res.headers.set('Access-Control-Allow-Credentials', 'true')
    c.res.headers.set('Vary', 'Origin')
  }
})

// ============================================================================
// SECURITY HEADERS MIDDLEWARE
// ============================================================================
app.use('*', async (c, next) => {
  await next()
  c.res.headers.set('X-Content-Type-Options', 'nosniff')
  c.res.headers.set('X-Frame-Options', 'DENY')
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (c.env.ENVIRONMENT === 'production') {
    c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
})

// ============================================================================
// ZOD SCHEMAS — input validation for all POST/PUT endpoints
// ============================================================================

const LoginSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
})

const TenantCreateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  email: z.string().email('Valid email address is required'),
  industry: z.string().min(1, 'industry is required'),
  domain: z.string().optional(),
  // T-FND-03: Additional fields for Commerce provisioning
  type: z.enum(['retail', 'multi_vendor', 'vendor']).optional(),
  modules: z.record(z.any()).optional(),
  syncPreferences: z.record(z.any()).optional(),
  theme: z.object({
    primaryColor: z.string().optional(),
    logoUrl: z.string().optional(),
  }).optional(),
})

const TenantUpdateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'TRIAL', 'CHURNED']).optional(),
  industry: z.string().optional(),
  domain: z.string().optional(),
})

const PartnerCreateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  email: z.string().email('Valid email address is required'),
  phone: z.string().optional(),
  company: z.string().optional(),
  tier: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
  commission_rate_percent: z.number().min(0).max(100).optional(),
  ndpr_consent: z.literal(true, { message: 'NDPR consent is required (Nigeria First invariant)' }),
  monthly_fee_kobo: z.number().int().optional(),
  notes: z.string().optional(),
})

const PartnerUpdateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'CHURNED']).optional(),
  tier: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
  commission_rate_percent: z.number().min(0).max(100).optional(),
  monthly_fee_kobo: z.number().int().optional(),
  notes: z.string().optional(),
})

const PartnerSuiteSchema = z.object({
  suite: z.string().min(1, 'suite is required'),
  action: z.enum(['assign', 'revoke', 'suspend'], {
    message: 'action must be assign, revoke, or suspend',
  }),
})

const DeploymentStatusSchema = z.object({
  worker_status: z.string().optional(),
  pages_status: z.string().optional(),
  last_pipeline_status: z.string().optional(),
  last_commit_sha: z.string().optional(),
})

const OperationsMetricsSchema = z.object({
  tenant_id: z.string().min(1, 'tenant_id is required'),
  suite: z.string().min(1, 'suite is required'),
  metric_date: z.string().min(1, 'metric_date is required'),
  gross_revenue_kobo: z.number().int().default(0),
  net_revenue_kobo: z.number().int().default(0),
  commission_paid_kobo: z.number().int().default(0),
  transaction_count: z.number().int().default(0),
  active_users: z.number().int().default(0),
  uptime_percent: z.number().min(0).max(100).default(100),
  error_rate_percent: z.number().min(0).default(0),
  avg_response_ms: z.number().default(0),
  ai_tokens_used: z.number().int().default(0),
  ai_cost_kobo: z.number().int().default(0),
  ai_vendor: z.string().nullable().optional(),
})

const AIQuotaUpdateSchema = z.object({
  monthly_token_limit: z.number().int().optional(),
  daily_token_limit: z.number().int().optional(),
  active_vendor: z.string().optional(),
  byok_key_ref: z.string().nullable().optional(),
})

const AIQuotaResetSchema = z.object({
  resetType: z.enum(['daily', 'monthly'], {
    message: 'resetType must be daily or monthly',
  }),
})

// ── Feature Flags ────────────────────────────────────────────────────────────
const FeatureFlagSetSchema = z.object({
  tier: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
  flags: z.object({
    advanced_analytics: z.boolean(),
    ai_recommendations: z.boolean(),
    multi_currency: z.boolean(),
    offline_mode: z.boolean(),
  }),
  quotas: z.object({
    api_requests_per_day: z.number().int().min(0),
    // -1 = unlimited (Enterprise)
    max_users: z.number().int().min(-1),
    max_storage_mb: z.number().int().min(-1),
    ai_tokens_per_month: z.number().int().min(0),
  }),
})

const BillingEntrySchema = z.object({
  tenant_id: z.string().min(1, 'tenant_id is required'),
  entry_type: z.string().min(1, 'entry_type is required'),
  account_from: z.string().optional(),
  account_to: z.string().optional(),
  amount_kobo: z.number().int('amount_kobo must be an integer (Nigeria First: kobo only)'),
  description: z.string().optional(),
})

const ModuleToggleSchema = z.object({
  enabled: z.boolean({ required_error: 'enabled (boolean) is required' }),
})

const SettingsUpdateSchema = z.object({
  apiRateLimit: z.number().int().optional(),
  sessionTimeout: z.number().int().optional(),
  maintenanceMode: z.boolean().optional(),
  maxTenantCount: z.number().int().optional(),
}).passthrough()

const HealthAlertSchema = z.object({
  alert_type: z.string().min(1, 'alert_type is required'),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL'], {
    message: 'severity must be INFO, WARNING, or CRITICAL',
  }),
  message: z.string().min(1, 'message is required'),
})

const ApiKeyCreateSchema = z.object({
  name: z.string().min(2, 'API key name must be at least 2 characters'),
})

const AuditLogEntrySchema = z.object({
  user_id: z.string().min(1, 'user_id is required'),
  action: z.string().min(1, 'action is required'),
  resource_type: z.string().min(1, 'resource_type is required'),
  resource_id: z.string().optional(),
})

const HealthCheckSchema = z.object({
  services: z.array(z.string()).optional(),
})

/**
 * parseBody — validates request body against a Zod schema.
 * Throws HTTP 400 with the first validation error message on failure.
 */
function parseBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? 'Validation error'
    throw new HTTPException(400, { message: msg })
  }
  return result.data
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function apiResponse(success: boolean, data?: any, errors?: string[]) {
  return { success, data, errors }
}

function generateId(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  let id = prefix + '-'
  for (let i = 0; i < 12; i++) {
    id += chars[bytes[i] % chars.length]
  }
  return id
}

// ============================================================================
// SECURITY: JWT helpers — sign and verify HS256 tokens (Workers-native)
// ============================================================================
async function verifyJWT(token: string, secret: string): Promise<any | null> {
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.')
    if (!headerB64 || !payloadB64 || !sigB64) return null
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const data = enc.encode(`${headerB64}.${payloadB64}`)
    const sig = Uint8Array.from(
      atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
      (ch) => ch.charCodeAt(0)
    )
    const valid = await crypto.subtle.verify('HMAC', key, sig, data)
    if (!valid) return null
    const payloadDecoded = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const payloadBytes2 = Uint8Array.from(payloadDecoded, (ch) => ch.charCodeAt(0))
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes2))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

async function signJWT(
  payload: Record<string, any>,
  secret: string,
  expiresInSeconds = 86400
): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const now = Math.floor(Date.now() / 1000)
  const payloadJson = JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds })
  const payloadBytes = new TextEncoder().encode(payloadJson)
  const fullPayload = btoa(String.fromCharCode(...payloadBytes))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${fullPayload}`))
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${header}.${fullPayload}.${sig}`
}

// Parse the auth_token value from a raw Cookie header string.
function parseCookieToken(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rest] = part.split('=')
    if (rawKey.trim() === 'auth_token') return rest.join('=').trim() || null
  }
  return null
}

// Build a Set-Cookie string for the auth token.
// Secure flag is omitted on non-production so localhost (http) dev still works.
function buildAuthCookieStr(token: string, maxAge: number, env: string): string {
  const secure = env === 'production' || env === 'staging' ? '; Secure' : ''
  return `auth_token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`
}

// Build a Set-Cookie string that immediately expires the auth cookie.
function buildClearCookieStr(env: string): string {
  const secure = env === 'production' || env === 'staging' ? '; Secure' : ''
  return `auth_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
}

async function getAuthPayload(c: any): Promise<any | null> {
  const secret = c.env.JWT_SECRET
  if (!secret) return null

  // Prefer the HttpOnly cookie (browser clients)
  const cookieHeader = c.req.header('Cookie') || ''
  const cookieToken = parseCookieToken(cookieHeader)
  if (cookieToken) return verifyJWT(cookieToken, secret)

  // Fall back to Authorization: Bearer header (API clients / test suite)
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) return verifyJWT(authHeader.slice(7), secret)

  return null
}

/**
 * requirePermission — throws HTTPException on failure, returns void on success.
 *   401 Unauthorized — no token present, token signature invalid, or token expired.
 *   403 Forbidden    — valid token but the caller lacks the required permission.
 *
 * tenantId and permissions are ALWAYS sourced from the verified JWT payload
 * — client-provided headers are never consulted for authorization decisions.
 */
async function requirePermission(c: any, permission: string): Promise<void> {
  const payload = await getAuthPayload(c)
  if (!payload) throw new HTTPException(401, { message: 'Unauthorized' })
  const allowed =
    payload.permissions?.includes(permission) ||
    payload.permissions?.includes('read:all') ||
    payload.role === 'SUPER_ADMIN'
  if (!allowed) throw new HTTPException(403, { message: 'Forbidden' })
}

/**
 * requireAuth — throws 401 if no valid JWT is present. Returns the decoded payload.
 * Use this for endpoints that need authentication but not a specific permission.
 */
async function requireAuth(c: any): Promise<any> {
  const payload = await getAuthPayload(c)
  if (!payload) throw new HTTPException(401, { message: 'Unauthorized' })
  return payload
}
async function getTenantId(c: any): Promise<string> {
  const payload = await getAuthPayload(c)
  // tenantId ALWAYS from JWT payload — NEVER from request headers
  return payload?.tenantId || 'super-admin'
}

// ============================================================================
// SECURITY: KV-backed sliding-window rate limiter
// ============================================================================
async function checkRateLimit(
  c: any,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const kvKey = `rl:${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`
    const current = await c.env.RATE_LIMIT_KV.get(kvKey)
    const count = current ? parseInt(current, 10) : 0
    if (count >= limit) return { allowed: false, remaining: 0 }
    await c.env.RATE_LIMIT_KV.put(kvKey, String(count + 1), { expirationTtl: windowSeconds })
    return { allowed: true, remaining: limit - count - 1 }
  } catch {
    return { allowed: true, remaining: limit } // fail open on KV error
  }
}

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * POST /auth/login
 * Authenticate user — verifies PBKDF2 password, issues signed JWT
 * Rate limited: 10 attempts per 15 minutes per IP
 */
app.post('/auth/login', async (c) => {
  try {
    // Rate limit: 10 attempts per 15 minutes per IP
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
    const rl = await checkRateLimit(c, `login:${ip}`, 10, 900)
    if (!rl.allowed) {
      throw new HTTPException(429, { message: 'Too many login attempts. Please try again later.' })
    }

    const { email, password } = await c.req.json()
    if (!email || !password) {
      throw new HTTPException(400, { message: 'email and password are required' })
    }
    if (!c.env.JWT_SECRET) {
      console.error('FATAL: JWT_SECRET is not configured')
      throw new HTTPException(500, { message: 'Internal server error' })
    }

    // Fetch user WITH password_hash — never expose hash in response
    const result = await c.env.RBAC_DB.prepare(
      `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.tenant_id, r.name as role
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.email = ? AND u.status = 'ACTIVE'`
    )
      .bind(email)
      .first()

    // SECURITY: always run password check to prevent timing-based user enumeration.
    // Use a dummy hash if user not found so timing is consistent.
    const storedHash =
      (result?.password_hash as string) ||
      'pbkdf2:310000:0000000000000000:0000000000000000000000000000000000000000000000000000000000000000'
    const passwordValid = await verifyPassword(password, storedHash)

    if (!result || !passwordValid) {
      throw new HTTPException(401, { message: 'Invalid credentials' })
    }

    const permissionsResult = await c.env.RBAC_DB.prepare(
      `SELECT p.name FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = (SELECT id FROM roles WHERE name = ?)`
    )
      .bind(result.role || 'CUSTOMER')
      .all()

    const permissions = permissionsResult.results?.map((r: any) => r.name) || []

    // Issue a signed JWT — stateless, no KV session storage required
    const token = await signJWT(
      {
        sub: result.id as string,
        email: result.email as string,
        name: `${result.first_name} ${result.last_name}`,
        tenantId: result.tenant_id as string,
        role: result.role as string,
        permissions,
      },
      c.env.JWT_SECRET,
      86400 // 24 hours
    )

    // Update last_login_at
    await c.env.RBAC_DB.prepare(
      `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
      .bind(result.id)
      .run()

    // Set the JWT as an HttpOnly cookie — never expose it in the response body
    const maxAge = 86400 // 24 hours
    c.header('Set-Cookie', buildAuthCookieStr(token, maxAge, c.env.ENVIRONMENT || 'development'))

    const tokenExpiresAt = Math.floor(Date.now() / 1000) + maxAge

    return c.json(
      apiResponse(true, {
        tokenExpiresAt,
        user: {
          id: result.id,
          email: result.email,
          name: `${result.first_name} ${result.last_name}`,
          role: result.role,
          permissions,
          tenantId: result.tenant_id,
        },
      })
    )
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Login error:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * POST /auth/refresh
 * Exchange a valid (non-expired) JWT for a new one with a fresh 24-hour expiry.
 * The original token must still be valid to prevent refresh after expiry.
 */
app.post('/auth/refresh', async (c) => {
  try {
    const payload = await getAuthPayload(c)
    if (!payload) throw new HTTPException(401, { message: 'Unauthorized' })

    const newToken = await signJWT(
      {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        tenantId: payload.tenantId,
        role: payload.role,
        permissions: payload.permissions,
      },
      c.env.JWT_SECRET,
      86400 // 24 hours
    )

    // Rotate the HttpOnly cookie — replace old token with the new one
    const maxAge = 86400
    c.header('Set-Cookie', buildAuthCookieStr(newToken, maxAge, c.env.ENVIRONMENT || 'development'))

    const tokenExpiresAt = Math.floor(Date.now() / 1000) + maxAge

    return c.json(apiResponse(true, { tokenExpiresAt }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * POST /auth/logout
 * Clears the HttpOnly auth cookie. Server-side blocklist can be added later via jti.
 */
app.post('/auth/logout', async (c) => {
  c.header('Set-Cookie', buildClearCookieStr(c.env.ENVIRONMENT || 'development'))
  return c.json(apiResponse(true, { message: 'Logged out successfully' }))
})

/**
 * GET /auth/me
 * Returns current user info from verified JWT payload
 */
app.get('/auth/me', async (c) => {
  try {
    const payload = await getAuthPayload(c)
    if (!payload) throw new HTTPException(401, { message: 'Unauthorized' })
    return c.json(
      apiResponse(true, {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        tenantId: payload.tenantId,
        role: payload.role,
        permissions: payload.permissions,
        // exp is already in the JWT payload; expose it so the client can schedule
        // a proactive token refresh without ever reading the HttpOnly cookie.
        tokenExpiresAt: payload.exp,
      })
    )
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// HEALTH CHECK ENDPOINTS
// ============================================================================

/**
 * GET /health
 * Basic health check — returns status, version, environment
 */
app.get('/health', (c) => {
  return c.json(
    apiResponse(true, {
      status: 'ok',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'unknown',
      suite: 'super-admin',
    })
  )
})

/**
 * GET /health/services
 * Health status of all registered services
 */
app.get('/health/services', async (c) => {
  try {
    const result = await c.env.HEALTH_DB.prepare(
      `SELECT service_name, status, uptime_percent, response_time_ms, error_count, last_check_at
       FROM service_health
       ORDER BY service_name ASC`
    ).all()
    return c.json(apiResponse(true, result.results))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching service health:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * GET /health/metrics
 * System metrics from the last hour
 */
app.get('/health/metrics', async (c) => {
  try {
    const result = await c.env.HEALTH_DB.prepare(
      `SELECT metric_name, metric_value, unit, recorded_at
       FROM system_metrics
       WHERE recorded_at > datetime('now', '-1 hour')
       ORDER BY recorded_at DESC
       LIMIT 50`
    ).all()
    return c.json(apiResponse(true, result.results))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching metrics:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * POST /health/check
 * Run an on-demand health check against all suite endpoints
 */
app.post('/health/check', async (c) => {
  try {
    const suiteEndpoints = [
      { suite: 'civic', url: 'https://webwaka-civic-api-prod.webwaka.workers.dev/health' },
      { suite: 'commerce', url: 'https://webwaka-commerce-api-prod.webwaka.workers.dev/health' },
      { suite: 'transport', url: 'https://webwaka-transport-api-prod.webwaka.workers.dev/health' },
    ]

    const results = await Promise.allSettled(
      suiteEndpoints.map(async ({ suite, url }) => {
        const start = Date.now()
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
          const ms = Date.now() - start
          const id = generateId('hc')
          await c.env.HEALTH_DB.prepare(
            `INSERT OR IGNORE INTO platform_health_checks
             (id, suite, environment, endpoint_url, http_status, response_ms, is_healthy, checked_at)
             VALUES (?, ?, 'PRODUCTION', ?, ?, ?, ?, CURRENT_TIMESTAMP)`
          )
            .bind(id, suite, url, res.status, ms, res.ok ? 1 : 0)
            .run()
          return { suite, url, status: res.status, ms, healthy: res.ok }
        } catch (e: any) {
          const id = generateId('hc')
          await c.env.HEALTH_DB.prepare(
            `INSERT OR IGNORE INTO platform_health_checks
             (id, suite, environment, endpoint_url, http_status, response_ms, is_healthy, error_message, checked_at)
             VALUES (?, ?, 'PRODUCTION', ?, NULL, NULL, 0, ?, CURRENT_TIMESTAMP)`
          )
            .bind(id, suite, url, e.message || 'timeout')
            .run()
          return { suite, url, status: null, ms: null, healthy: false, error: e.message }
        }
      })
    )

    const checks = results.map((r) => (r.status === 'fulfilled' ? r.value : { error: 'failed' }))
    return c.json(apiResponse(true, { checks, checkedAt: new Date().toISOString() }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error running health check:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// TENANT MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /tenants
 * List all tenants (paginated)
 */
app.get('/tenants', async (c) => {
  try {
    await requirePermission(c, 'read:tenants')

    const page = Number(c.req.query('page') || 1)
    const limit = Math.min(Number(c.req.query('limit') || 20), 100)
    const offset = (page - 1) * limit
    const status = c.req.query('status')

    let query = `SELECT id, name, email, status, industry, domain, tenant_id, created_at
                 FROM tenants WHERE deleted_at IS NULL`
    const params: any[] = []
    if (status) {
      query += ` AND status = ?`
      params.push(status)
    }
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const result = await c.env.TENANTS_DB.prepare(query).bind(...params).all()
    const countResult = await c.env.TENANTS_DB.prepare(
      `SELECT COUNT(*) as total FROM tenants WHERE deleted_at IS NULL`
    ).first()

    return c.json(
      apiResponse(true, {
        tenants: result.results,
        pagination: { page, limit, total: Number(countResult?.total || 0) },
      })
    )
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching tenants:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * POST /tenants
 * Create new tenant and provision across vertical workers (T-FND-03)
 */
app.post('/tenants', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const { name, email, industry, domain, type, modules, syncPreferences, theme } = parseBody(
      TenantCreateSchema,
      await c.req.json()
    )

    const tenantId = generateId('tenant')

    // Step 1: Create tenant record in Super Admin DB
    await c.env.TENANTS_DB.prepare(
      `INSERT INTO tenants (id, name, email, status, industry, domain, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, 'ACTIVE', ?, ?, 'super-admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(tenantId, name, email, industry, domain || null)
      .run()

    // Step 2: Provision tenant in Commerce worker via Service Binding
    // BUG-02 FIX (T-FND-03 QA): Removed insecure '|| default-secret' fallback.
    //   If INTER_SERVICE_SECRET is not configured, fail fast with 500 rather than
    //   silently accepting 'default-secret' as a valid credential.
    // BUG-04 FIX (T-FND-03 QA): Refactored rollback to a single path — the original
    //   code had two separate DELETE calls (one inside the inner if-block and one in
    //   the outer catch), causing a duplicate DELETE on provisioning failure.
    try {
      const internalSecret = c.env.INTER_SERVICE_SECRET
      if (!internalSecret) {
        console.error('[PROVISION] INTER_SERVICE_SECRET is not configured — cannot provision tenant')
        // Rollback: Delete tenant from TENANTS_DB before failing
        await c.env.TENANTS_DB.prepare('DELETE FROM tenants WHERE id = ?').bind(tenantId).run()
        throw new HTTPException(500, { message: 'Internal server configuration error' })
      }

      const provisionResponse = await c.env.COMMERCE_WORKER.fetch(
        'http://internal/internal/provision-tenant',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': internalSecret,
          },
          body: JSON.stringify({
            tenantId,
            name,
            type: type || 'retail',
            domain: domain || `${tenantId}.webwaka.app`,
            currency: 'NGN',
            timezone: 'Africa/Lagos',
            modules,
            syncPreferences,
            theme,
          }),
        }
      )

      const provisionResult: any = await provisionResponse.json()
      if (!provisionResult.success) {
        console.error('[PROVISION] Commerce provisioning failed:', provisionResult.error)
        // Rollback: Delete tenant from TENANTS_DB (single rollback path — BUG-04 fix)
        await c.env.TENANTS_DB.prepare('DELETE FROM tenants WHERE id = ?').bind(tenantId).run()
        throw new HTTPException(500, { message: 'Failed to provision tenant in Commerce worker' })
      }

      console.log(`[PROVISION] Tenant ${tenantId} provisioned in Commerce worker`)
    } catch (err) {
      if (err instanceof HTTPException) throw err
      // Unexpected error (network, JSON parse, etc.) — rollback and re-throw
      console.error('[PROVISION] Service binding call failed unexpectedly:', err)
      await c.env.TENANTS_DB.prepare('DELETE FROM tenants WHERE id = ?').bind(tenantId).run()
      throw new HTTPException(500, { message: 'Failed to communicate with Commerce worker' })
    }

    // Step 3: Emit tenant.provisioned event (unified WebWakaEvent<T> schema from T-FND-01)
    try {
      const event = {
        event: 'tenant.provisioned',
        tenantId,
        payload: {
          tenantId,
          name,
          email,
          industry,
          domain: domain || `${tenantId}.webwaka.app`,
          type: type || 'retail',
          provisionedAt: Date.now(),
        },
        timestamp: Date.now(),
      }

      // Publish to NOTIFICATIONS_KV for event bus (24h TTL)
      await c.env.NOTIFICATIONS_KV.put(
        `event:tenant.provisioned:${tenantId}:${Date.now()}`,
        JSON.stringify(event),
        { expirationTtl: 86400 }
      )

      console.log(`[EVENT] tenant.provisioned emitted for ${tenantId}`)
    } catch (err) {
      // Event emission failure should not block tenant creation
      console.error('[EVENT] Failed to emit tenant.provisioned event:', err)
    }

    return c.json(
      apiResponse(true, { id: tenantId, name, email, status: 'ACTIVE', industry, domain }),
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error creating tenant:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * GET /tenants/:id
 * Get single tenant by ID
 */
app.get('/tenants/:id', async (c) => {
  try {
    await requirePermission(c, 'read:tenants')

    const id = c.req.param('id')
    const result = await c.env.TENANTS_DB.prepare(
      `SELECT id, name, email, status, industry, domain, tenant_id, created_at, updated_at
       FROM tenants WHERE id = ? AND deleted_at IS NULL`
    )
      .bind(id)
      .first()

    if (!result) throw new HTTPException(404, { message: 'Tenant not found' })
    return c.json(apiResponse(true, result))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * PUT /tenants/:id
 * Update tenant
 */
app.put('/tenants/:id', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const id = c.req.param('id')
    const body = parseBody(TenantUpdateSchema, await c.req.json())
    const allowed = ['name', 'email', 'status', 'industry', 'domain']
    const updates: string[] = []
    const params: any[] = []

    for (const key of allowed) {
      if ((body as any)[key] !== undefined) {
        updates.push(`${key} = ?`)
        params.push((body as any)[key])
      }
    }

    if (updates.length === 0) {
      throw new HTTPException(400, { message: 'No valid fields to update' })
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)

    await c.env.TENANTS_DB.prepare(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`
    )
      .bind(...params)
      .run()

    const updated = await c.env.TENANTS_DB.prepare(
      `SELECT id, name, email, status, industry, domain, updated_at FROM tenants WHERE id = ?`
    )
      .bind(id)
      .first()

    return c.json(apiResponse(true, updated))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * DELETE /tenants/:id
 * Soft-delete tenant
 */
app.delete('/tenants/:id', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const id = c.req.param('id')
    await c.env.TENANTS_DB.prepare(
      `UPDATE tenants SET deleted_at = CURRENT_TIMESTAMP, status = 'CHURNED', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND deleted_at IS NULL`
    )
      .bind(id)
      .run()

    return c.json(apiResponse(true, { id, deleted: true }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// PARTNER MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /partners
 * List all partners (paginated, filterable by status/tier)
 */
app.get('/partners', async (c) => {
  try {
    await requirePermission(c, 'read:tenants')

    const page = Number(c.req.query('page') || 1)
    const limit = Math.min(Number(c.req.query('limit') || 20), 100)
    const offset = (page - 1) * limit
    const status = c.req.query('status')
    const tier = c.req.query('tier')

    let query = `SELECT id, name, email, phone, company, status, tier, commission_rate_percent,
                        assigned_suites, ndpr_consent, monthly_fee_kobo, created_at
                 FROM partners WHERE 1=1`
    const params: any[] = []

    if (status) { query += ` AND status = ?`; params.push(status) }
    if (tier) { query += ` AND tier = ?`; params.push(tier) }
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const result = await c.env.TENANTS_DB.prepare(query).bind(...params).all()

    // Build filtered count query (mirrors the WHERE clause above, minus LIMIT/OFFSET)
    let countQuery = `SELECT COUNT(*) as total FROM partners WHERE 1=1`
    const countParams: any[] = []
    if (status) { countQuery += ` AND status = ?`; countParams.push(status) }
    if (tier) { countQuery += ` AND tier = ?`; countParams.push(tier) }
    const countResult = countParams.length
      ? await c.env.TENANTS_DB.prepare(countQuery).bind(...countParams).first()
      : await c.env.TENANTS_DB.prepare(countQuery).first()

    return c.json(
      apiResponse(true, {
        partners: result.results,
        pagination: { page, limit, total: Number(countResult?.total || 0) },
      })
    )
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching partners:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * POST /partners
 * Onboard a new partner
 */
app.post('/partners', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const { name, email, phone, company, tier, commission_rate_percent, ndpr_consent, monthly_fee_kobo, notes } =
      parseBody(PartnerCreateSchema, await c.req.json())

    const id = generateId('partner')
    const now = new Date().toISOString()

    await c.env.TENANTS_DB.prepare(
      `INSERT INTO partners
       (id, name, email, phone, company, status, tier, commission_rate_percent,
        assigned_suites, ndpr_consent, ndpr_consent_at, monthly_fee_kobo, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, '[]', 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(
        id, name, email,
        phone || null, company || null,
        tier || 'STARTER',
        commission_rate_percent || 10.0,
        now,
        monthly_fee_kobo || 0,
        notes || null
      )
      .run()

    return c.json(
      apiResponse(true, { id, name, email, status: 'PENDING', tier: tier || 'STARTER' }),
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error creating partner:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * GET /partners/:id
 * Get single partner with suite assignments
 */
app.get('/partners/:id', async (c) => {
  try {
    await requirePermission(c, 'read:tenants')

    const id = c.req.param('id')
    const partner = await c.env.TENANTS_DB.prepare(
      `SELECT id, name, email, phone, company, status, tier, commission_rate_percent,
              assigned_suites, ndpr_consent, ndpr_consent_at, monthly_fee_kobo, notes, created_at, updated_at
       FROM partners WHERE id = ?`
    )
      .bind(id)
      .first()

    if (!partner) throw new HTTPException(404, { message: 'Partner not found' })

    // Get suite assignments
    const assignments = await c.env.TENANTS_DB.prepare(
      `SELECT suite, status, assigned_at, assigned_by FROM partner_suite_assignments WHERE partner_id = ?`
    )
      .bind(id)
      .all()

    return c.json(apiResponse(true, { ...partner, suiteAssignments: assignments.results }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * PUT /partners/:id
 * Update partner details
 */
app.put('/partners/:id', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const id = c.req.param('id')
    const body = parseBody(PartnerUpdateSchema, await c.req.json())
    const allowed = ['name', 'email', 'phone', 'company', 'status', 'tier', 'commission_rate_percent', 'monthly_fee_kobo', 'notes']
    const updates: string[] = []
    const params: any[] = []

    for (const key of allowed) {
      if ((body as any)[key] !== undefined) {
        updates.push(`${key} = ?`)
        params.push((body as any)[key])
      }
    }

    if (updates.length === 0) throw new HTTPException(400, { message: 'No valid fields to update' })

    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)

    await c.env.TENANTS_DB.prepare(
      `UPDATE partners SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...params)
      .run()

    const updated = await c.env.TENANTS_DB.prepare(
      `SELECT id, name, email, status, tier, updated_at FROM partners WHERE id = ?`
    )
      .bind(id)
      .first()

    return c.json(apiResponse(true, updated))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * DELETE /partners/:id
 * Soft-delete (churn) partner
 */
app.delete('/partners/:id', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const id = c.req.param('id')
    await c.env.TENANTS_DB.prepare(
      `UPDATE partners SET status = 'CHURNED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
      .bind(id)
      .run()

    return c.json(apiResponse(true, { id, status: 'CHURNED' }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * POST /partners/:id/suites
 * Assign or revoke suite access for a partner
 */
app.post('/partners/:id/suites', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const partnerId = c.req.param('id')
    const { suite, action } = parseBody(PartnerSuiteSchema, await c.req.json())

    const status = action === 'assign' ? 'ACTIVE' : action === 'suspend' ? 'SUSPENDED' : 'REVOKED'
    const id = generateId('psa')

    await c.env.TENANTS_DB.prepare(
      `INSERT INTO partner_suite_assignments (id, partner_id, suite, assigned_at, assigned_by, status)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'super-admin', ?)
       ON CONFLICT(partner_id, suite) DO UPDATE SET status = ?, assigned_by = 'super-admin'`
    )
      .bind(id, partnerId, suite, status, status)
      .run()

    // Update assigned_suites JSON array on partner record
    const assignments = await c.env.TENANTS_DB.prepare(
      `SELECT suite FROM partner_suite_assignments WHERE partner_id = ? AND status = 'ACTIVE'`
    )
      .bind(partnerId)
      .all()

    const activeSuites = JSON.stringify(assignments.results.map((r: any) => r.suite))
    await c.env.TENANTS_DB.prepare(
      `UPDATE partners SET assigned_suites = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
      .bind(activeSuites, partnerId)
      .run()

    return c.json(apiResponse(true, { partnerId, suite, status, activeSuites }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error assigning suite:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// DEPLOYMENT MANAGER ENDPOINTS
// ============================================================================

/**
 * GET /deployments
 * List all deployments (filterable by suite/environment)
 */
app.get('/deployments', async (c) => {
  try {
    await requirePermission(c, 'read:tenants')

    const suite = c.req.query('suite')
    const environment = c.req.query('environment')

    let query = `SELECT id, tenant_id, suite, environment, worker_name, worker_url, worker_status,
                        pages_project, pages_url, pages_status, d1_migrated,
                        github_repo, github_branch, last_pipeline_status, last_pipeline_at, updated_at
                 FROM deployments WHERE 1=1`
    const params: any[] = []

    if (suite) { query += ` AND suite = ?`; params.push(suite) }
    if (environment) { query += ` AND environment = ?`; params.push(environment) }
    query += ` ORDER BY updated_at DESC`

    const result = await c.env.TENANTS_DB.prepare(query).bind(...params).all()
    return c.json(apiResponse(true, result.results))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching deployments:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * GET /deployments/:id
 * Get single deployment details
 */
app.get('/deployments/:id', async (c) => {
  try {
    await requirePermission(c, 'read:tenants')

    const id = c.req.param('id')
    const result = await c.env.TENANTS_DB.prepare(
      `SELECT * FROM deployments WHERE id = ?`
    )
      .bind(id)
      .first()

    if (!result) throw new HTTPException(404, { message: 'Deployment not found' })
    return c.json(apiResponse(true, result))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * PUT /deployments/:id/status
 * Update deployment status (worker/pages/pipeline)
 */
app.put('/deployments/:id/status', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const id = c.req.param('id')
    const { worker_status, pages_status, last_pipeline_status, last_commit_sha } =
      parseBody(DeploymentStatusSchema, await c.req.json())

    const updates: string[] = []
    const params: any[] = []

    if (worker_status) { updates.push('worker_status = ?'); params.push(worker_status) }
    if (pages_status) { updates.push('pages_status = ?'); params.push(pages_status) }
    if (last_pipeline_status) {
      updates.push('last_pipeline_status = ?')
      updates.push('last_pipeline_at = CURRENT_TIMESTAMP')
      params.push(last_pipeline_status)
    }
    if (last_commit_sha) { updates.push('last_commit_sha = ?'); params.push(last_commit_sha) }

    if (updates.length === 0) throw new HTTPException(400, { message: 'No valid status fields provided' })

    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)

    await c.env.TENANTS_DB.prepare(
      `UPDATE deployments SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...params)
      .run()

    const updated = await c.env.TENANTS_DB.prepare(`SELECT * FROM deployments WHERE id = ?`)
      .bind(id)
      .first()

    return c.json(apiResponse(true, updated))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * POST /deployments/refresh
 * Refresh deployment status from Cloudflare API (simulated)
 */
app.post('/deployments/refresh', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    // In production this would call Cloudflare API to get real deployment status
    // For now, we return the current state and mark as refreshed
    const result = await c.env.TENANTS_DB.prepare(
      `SELECT id, suite, environment, worker_status, pages_status FROM deployments`
    ).all()

    return c.json(
      apiResponse(true, {
        refreshed: result.results?.length || 0,
        timestamp: new Date().toISOString(),
        deployments: result.results,
      })
    )
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// OPERATIONS ANALYTICS ENDPOINTS
// ============================================================================

/**
 * GET /operations/metrics
 * Get operations metrics (paginated, filterable by suite/date)
 */
app.get('/operations/metrics', async (c) => {
  try {
    await requirePermission(c, 'read:tenants')

    const suite = c.req.query('suite')
    const tenantId = c.req.query('tenantId')
    const dateFrom = c.req.query('dateFrom') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const dateTo = c.req.query('dateTo') || new Date().toISOString().split('T')[0]

    let query = `SELECT id, tenant_id, suite, metric_date, gross_revenue_kobo, net_revenue_kobo,
                        commission_paid_kobo, transaction_count, active_users,
                        uptime_percent, error_rate_percent, avg_response_ms,
                        ai_tokens_used, ai_cost_kobo, ai_vendor
                 FROM operations_metrics
                 WHERE metric_date BETWEEN ? AND ?`
    const params: any[] = [dateFrom, dateTo]

    if (suite) { query += ` AND suite = ?`; params.push(suite) }
    if (tenantId) { query += ` AND tenant_id = ?`; params.push(tenantId) }
    query += ` ORDER BY metric_date DESC LIMIT 200`

    const result = await c.env.TENANTS_DB.prepare(query).bind(...params).all()
    return c.json(apiResponse(true, result.results))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching operations metrics:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * GET /operations/summary
 * Aggregated operations summary across all suites
 */
app.get('/operations/summary', async (c) => {
  try {
    await requirePermission(c, 'read:tenants')

    const cacheKey = 'cache:operations:summary'
    const cached = await c.env.CACHE_KV.get(cacheKey)
    if (cached) return c.json(apiResponse(true, JSON.parse(cached)))

    const result = await c.env.TENANTS_DB.prepare(
      `SELECT suite,
              SUM(gross_revenue_kobo) as total_revenue_kobo,
              SUM(transaction_count) as total_transactions,
              AVG(uptime_percent) as avg_uptime,
              AVG(error_rate_percent) as avg_error_rate,
              SUM(ai_tokens_used) as total_ai_tokens
       FROM operations_metrics
       WHERE metric_date >= date('now', '-30 days')
       GROUP BY suite`
    ).all()

    const tenantCount = await c.env.TENANTS_DB.prepare(
      `SELECT COUNT(*) as total FROM tenants WHERE deleted_at IS NULL AND status = 'ACTIVE'`
    ).first()

    const partnerCount = await c.env.TENANTS_DB.prepare(
      `SELECT COUNT(*) as total FROM partners WHERE status = 'ACTIVE'`
    ).first()

    const summary = {
      suiteMetrics: result.results,
      activeTenants: Number(tenantCount?.total || 0),
      activePartners: Number(partnerCount?.total || 0),
      generatedAt: new Date().toISOString(),
    }

    await c.env.CACHE_KV.put(cacheKey, JSON.stringify(summary), { expirationTtl: 300 })
    return c.json(apiResponse(true, summary))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching operations summary:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * POST /operations/metrics
 * Ingest operations metrics for a tenant/suite
 */
app.post('/operations/metrics', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const {
      tenant_id, suite, metric_date,
      gross_revenue_kobo, net_revenue_kobo, commission_paid_kobo,
      transaction_count, active_users,
      uptime_percent, error_rate_percent, avg_response_ms,
      ai_tokens_used, ai_cost_kobo, ai_vendor,
    } = parseBody(OperationsMetricsSchema, await c.req.json())

    const id = generateId('om')
    await c.env.TENANTS_DB.prepare(
      `INSERT OR REPLACE INTO operations_metrics
       (id, tenant_id, suite, metric_date, gross_revenue_kobo, net_revenue_kobo,
        commission_paid_kobo, transaction_count, active_users,
        uptime_percent, error_rate_percent, avg_response_ms,
        ai_tokens_used, ai_cost_kobo, ai_vendor, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(
        id, tenant_id, suite, metric_date,
        gross_revenue_kobo, net_revenue_kobo, commission_paid_kobo,
        transaction_count, active_users,
        uptime_percent, error_rate_percent, avg_response_ms,
        ai_tokens_used, ai_cost_kobo, ai_vendor
      )
      .run()

    // Invalidate summary cache
    await c.env.CACHE_KV.delete('cache:operations:summary')

    return c.json(apiResponse(true, { id, tenant_id, suite, metric_date }), { status: 201 })
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error ingesting metrics:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * GET /operations/ai-usage
 * AI usage breakdown across all tenants (Vendor Neutral AI invariant)
 */
app.get('/operations/ai-usage', async (c) => {
  try {
    await requirePermission(c, 'read:tenants')

    const result = await c.env.TENANTS_DB.prepare(
      `SELECT ai_vendor,
              SUM(ai_tokens_used) as total_tokens,
              SUM(ai_cost_kobo) as total_cost_kobo,
              COUNT(DISTINCT tenant_id) as tenant_count
       FROM operations_metrics
       WHERE metric_date >= date('now', '-30 days')
         AND ai_vendor IS NOT NULL
       GROUP BY ai_vendor
       ORDER BY total_tokens DESC`
    ).all()

    return c.json(
      apiResponse(true, {
        vendorBreakdown: result.results,
        note: 'Vendor Neutral AI — no lock-in to any single AI provider',
        period: 'last_30_days',
      })
    )
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// AI QUOTA MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /ai-quotas/:tenantId
 * Get AI usage quota for a tenant
 */
app.get('/ai-quotas/:tenantId', async (c) => {
  try {
    await requirePermission(c, 'read:tenants')

    const tenantId = c.req.param('tenantId')
    const result = await c.env.TENANTS_DB.prepare(
      `SELECT id, tenant_id, monthly_token_limit, daily_token_limit,
              tokens_used_this_month, tokens_used_today, cost_this_month_kobo,
              active_vendor, last_reset_at, updated_at
       FROM ai_usage_quotas WHERE tenant_id = ?`
    )
      .bind(tenantId)
      .first()

    if (!result) {
      // Return default quota if not configured
      return c.json(
        apiResponse(true, {
          tenant_id: tenantId,
          monthly_token_limit: 1000000,
          daily_token_limit: 50000,
          tokens_used_this_month: 0,
          tokens_used_today: 0,
          cost_this_month_kobo: 0,
          active_vendor: 'platform',
        })
      )
    }

    return c.json(apiResponse(true, result))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * PUT /ai-quotas/:tenantId
 * Update AI quota limits and vendor configuration for a tenant
 */
app.put('/ai-quotas/:tenantId', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const tenantId = c.req.param('tenantId')
    const { monthly_token_limit, daily_token_limit, active_vendor, byok_key_ref } =
      parseBody(AIQuotaUpdateSchema, await c.req.json())

    const id = generateId('aiq')
    await c.env.TENANTS_DB.prepare(
      `INSERT INTO ai_usage_quotas
       (id, tenant_id, monthly_token_limit, daily_token_limit, active_vendor, byok_key_ref,
        tokens_used_this_month, tokens_used_today, cost_this_month_kobo,
        last_reset_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(tenant_id) DO UPDATE SET
         monthly_token_limit = COALESCE(?, monthly_token_limit),
         daily_token_limit = COALESCE(?, daily_token_limit),
         active_vendor = COALESCE(?, active_vendor),
         byok_key_ref = COALESCE(?, byok_key_ref),
         updated_at = CURRENT_TIMESTAMP`
    )
      .bind(
        id, tenantId,
        monthly_token_limit || 1000000,
        daily_token_limit || 50000,
        active_vendor || 'platform',
        byok_key_ref || null,
        monthly_token_limit, daily_token_limit, active_vendor, byok_key_ref
      )
      .run()

    const updated = await c.env.TENANTS_DB.prepare(
      `SELECT * FROM ai_usage_quotas WHERE tenant_id = ?`
    )
      .bind(tenantId)
      .first()

    return c.json(apiResponse(true, updated))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * POST /ai-quotas/:tenantId/reset
 * Reset daily/monthly AI usage counters for a tenant
 */
app.post('/ai-quotas/:tenantId/reset', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const tenantId = c.req.param('tenantId')
    const { resetType } = parseBody(AIQuotaResetSchema, await c.req.json())

    if (resetType === 'daily') {
      await c.env.TENANTS_DB.prepare(
        `UPDATE ai_usage_quotas SET tokens_used_today = 0, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ?`
      )
        .bind(tenantId)
        .run()
    } else if (resetType === 'monthly') {
      await c.env.TENANTS_DB.prepare(
        `UPDATE ai_usage_quotas
         SET tokens_used_this_month = 0, tokens_used_today = 0, cost_this_month_kobo = 0,
             last_reset_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ?`
      )
        .bind(tenantId)
        .run()
    } else {
      throw new HTTPException(400, { message: 'resetType must be daily or monthly' })
    }

    return c.json(apiResponse(true, { tenantId, resetType, resetAt: new Date().toISOString() }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// FEATURE FLAG ENDPOINTS
// ============================================================================
//
// KV key format : tenant:{tenantId}:flags
// KV namespace  : FEATURE_FLAGS_KV
//
// Key pattern is consistent with the module registry which writes:
//   tenant:{tenantId}:module:{moduleId}
// This allows listing all keys for a tenant with prefix "tenant:{tenantId}:"
//
// Downstream vertical workers read flags with a single KV lookup:
//   const config = await FEATURE_FLAGS_KV.get(`tenant:${tenantId}:flags`, 'json')
//
// KV value JSON schema (TenantFeatureConfig):
//   {
//     tenant_id       : string                              — tenant identifier
//     tier            : "STARTER" | "PROFESSIONAL" | "ENTERPRISE"
//     flags: {
//       advanced_analytics  : boolean  — ff-001: Advanced analytics dashboard
//       ai_recommendations  : boolean  — ff-002: ML-based recommendations engine
//       multi_currency      : boolean  — ff-003: Multi-currency (NGN + USD + GHS …)
//       offline_mode        : boolean  — ff-004: Progressive offline-first mode
//     },
//     quotas: {
//       api_requests_per_day  : number  — daily API call cap (-1 = unlimited)
//       max_users             : number  — user seat limit (-1 = unlimited)
//       max_storage_mb        : number  — storage cap in MiB (-1 = unlimited)
//       ai_tokens_per_month   : number  — monthly AI token budget (0 = disabled)
//     },
//     updated_at : ISO 8601 timestamp of last write
//     updated_by : email of the super-admin who last wrote this record
//   }
//
// Tier defaults (applied on GET when no KV record exists):
//   STARTER      : all flags false except offline_mode=true; low quotas
//   PROFESSIONAL : advanced_analytics & ai_recommendations enabled; full quotas
//   ENTERPRISE   : all flags true; unlimited users/storage
// ============================================================================

/** Per-tier default feature configs */
const TIER_DEFAULTS: Record<string, { flags: Record<string, boolean>; quotas: Record<string, number> }> = {
  STARTER: {
    flags: { advanced_analytics: false, ai_recommendations: false, multi_currency: false, offline_mode: true },
    quotas: { api_requests_per_day: 1000, max_users: 10, max_storage_mb: 5120, ai_tokens_per_month: 0 },
  },
  PROFESSIONAL: {
    flags: { advanced_analytics: true, ai_recommendations: true, multi_currency: false, offline_mode: true },
    quotas: { api_requests_per_day: 10000, max_users: 100, max_storage_mb: 51200, ai_tokens_per_month: 500000 },
  },
  ENTERPRISE: {
    flags: { advanced_analytics: true, ai_recommendations: true, multi_currency: true, offline_mode: true },
    quotas: { api_requests_per_day: 100000, max_users: -1, max_storage_mb: -1, ai_tokens_per_month: 1000000 },
  },
}

/**
 * GET /feature-flags/:tenantId
 * Read feature flags for a tenant from FEATURE_FLAGS_KV.
 * Falls back to tier-based defaults if no record exists.
 */
app.get('/feature-flags/:tenantId', async (c) => {
  try {
    await requirePermission(c, 'read:tenants')

    const tenantId = c.req.param('tenantId')

    // Fast global read from KV
    const stored = await c.env.FEATURE_FLAGS_KV.get(`tenant:${tenantId}:flags`, 'json') as any

    if (stored) {
      return c.json(apiResponse(true, { ...stored, is_default: false }))
    }

    // No record — derive tier from TENANTS_DB then return defaults
    const tenant = await c.env.TENANTS_DB.prepare(
      `SELECT tier FROM tenants WHERE id = ?`
    ).bind(tenantId).first()

    const tier = (tenant?.tier as string) || 'STARTER'
    const defaults = TIER_DEFAULTS[tier] || TIER_DEFAULTS.STARTER

    return c.json(
      apiResponse(true, {
        tenant_id: tenantId,
        tier,
        flags: defaults.flags,
        quotas: defaults.quotas,
        is_default: true,
      })
    )
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * PUT /feature-flags/:tenantId
 * Write (or replace) feature flags for a tenant in FEATURE_FLAGS_KV.
 * Full object must be supplied — use GET first to read existing values.
 */
app.put('/feature-flags/:tenantId', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const tenantId = c.req.param('tenantId')
    const authPayload = await getAuthPayload(c)
    const body = parseBody(FeatureFlagSetSchema, await c.req.json())

    // Bug fix #2: Verify the tenant exists before writing to KV.
    // Without this check, super-admins could create orphan KV entries
    // for arbitrary (non-existent) tenant IDs.
    const tenantExists = await c.env.TENANTS_DB.prepare(
      `SELECT id FROM tenants WHERE id = ?`
    ).bind(tenantId).first()

    if (!tenantExists) {
      throw new HTTPException(404, { message: `Tenant '${tenantId}' not found` })
    }

    const config = {
      tenant_id: tenantId,
      tier: body.tier,
      flags: body.flags,
      quotas: body.quotas,
      updated_at: new Date().toISOString(),
      updated_by: authPayload?.email || 'system',
    }

    // Persist to KV — no TTL; flags are long-lived configuration
    await c.env.FEATURE_FLAGS_KV.put(`tenant:${tenantId}:flags`, JSON.stringify(config))

    // Audit trail
    await c.env.TENANTS_DB.prepare(
      `INSERT OR IGNORE INTO audit_logs
         (id, user_id, action, resource_type, resource_id, new_value, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      generateId('afl'),
      authPayload?.sub || 'system',
      'UPDATE_FEATURE_FLAGS',
      'tenant_feature_flags',
      tenantId,
      JSON.stringify({ tier: body.tier, flags: body.flags }),
    ).run().catch(() => {}) // non-fatal

    return c.json(apiResponse(true, config))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * DELETE /feature-flags/:tenantId
 * Remove the custom feature flag record for a tenant, reverting to tier defaults.
 */
app.delete('/feature-flags/:tenantId', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const tenantId = c.req.param('tenantId')
    await c.env.FEATURE_FLAGS_KV.delete(`tenant:${tenantId}:flags`)

    return c.json(apiResponse(true, {
      tenant_id: tenantId,
      message: 'Feature flags reset to tier defaults',
    }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// BILLING ENDPOINTS
// ============================================================================

/**
 * GET /billing/ledger
 * Get ledger entries for tenant
 */
app.get('/billing/ledger', async (c) => {
  try {
    await requirePermission(c, 'read:billing')

    const tenantId = await getTenantId(c)
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200)
    const offset = Math.max(parseInt(c.req.query('offset') || '0', 10), 0)

    const [rows, countRow] = await Promise.all([
      c.env.BILLING_DB.prepare(
        `SELECT id, entry_type, account_from, account_to, amount_kobo, description, created_at
         FROM ledger_entries
         WHERE tenant_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
        .bind(tenantId, limit, offset)
        .all(),
      c.env.BILLING_DB.prepare(
        `SELECT COUNT(*) as total FROM ledger_entries WHERE tenant_id = ?`
      )
        .bind(tenantId)
        .first<{ total: number }>(),
    ])

    return c.json(apiResponse(true, {
      entries: rows.results,
      total: countRow?.total ?? 0,
      limit,
      offset,
    }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching ledger:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * GET /billing/summary
 * Get billing summary (cached in KV)
 */
app.get('/billing/summary', async (c) => {
  try {
    await requirePermission(c, 'read:billing')
    const tenantId = await getTenantId(c)
    const cacheKey = `cache:tenant:${tenantId}:ledger:summary`

    const cached = await c.env.CACHE_KV.get(cacheKey)
    if (cached) return c.json(apiResponse(true, JSON.parse(cached)))

    // All-time totals
    const allTime = await c.env.BILLING_DB.prepare(
      `SELECT
        SUM(CASE WHEN entry_type = 'REVENUE' THEN amount_kobo ELSE 0 END) as total_revenue,
        SUM(CASE WHEN entry_type = 'COMMISSION' THEN amount_kobo ELSE 0 END) as total_commissions,
        SUM(CASE WHEN entry_type = 'PAYOUT' THEN amount_kobo ELSE 0 END) as total_payouts
       FROM ledger_entries WHERE tenant_id = ?`
    )
      .bind(tenantId)
      .first()

    // MTD: current calendar month
    const mtdResult = await c.env.BILLING_DB.prepare(
      `SELECT SUM(CASE WHEN entry_type = 'REVENUE' THEN amount_kobo ELSE 0 END) as revenue
       FROM ledger_entries
       WHERE tenant_id = ?
         AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    )
      .bind(tenantId)
      .first()

    // YTD: current calendar year
    const ytdResult = await c.env.BILLING_DB.prepare(
      `SELECT SUM(CASE WHEN entry_type = 'REVENUE' THEN amount_kobo ELSE 0 END) as revenue
       FROM ledger_entries
       WHERE tenant_id = ?
         AND strftime('%Y', created_at) = strftime('%Y', 'now')`
    )
      .bind(tenantId)
      .first()

    const summary = {
      mtd: Number(mtdResult?.revenue) || 0,
      ytd: Number(ytdResult?.revenue) || 0,
      balance: (Number(allTime?.total_revenue) || 0) - (Number(allTime?.total_payouts) || 0),
      totalRevenue: Number(allTime?.total_revenue) || 0,
      totalCommissions: Number(allTime?.total_commissions) || 0,
      totalPayouts: Number(allTime?.total_payouts) || 0,
      lastUpdated: Date.now(),
    }

    await c.env.CACHE_KV.put(cacheKey, JSON.stringify(summary), { expirationTtl: 900 })
    return c.json(apiResponse(true, summary))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching billing summary:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * POST /billing/entry
 * Create a new ledger entry (all amounts in kobo — Nigeria First invariant)
 */
app.post('/billing/entry', async (c) => {
  try {
    await requirePermission(c, 'write:billing')

    const { tenant_id, entry_type, account_from, account_to, amount_kobo, description } =
      parseBody(BillingEntrySchema, await c.req.json())

    const id = generateId('le')
    await c.env.BILLING_DB.prepare(
      `INSERT INTO ledger_entries
       (id, tenant_id, entry_type, account_from, account_to, amount_kobo, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(id, tenant_id, entry_type, account_from || null, account_to || null, amount_kobo, description || null)
      .run()

    // Invalidate billing cache
    await c.env.CACHE_KV.delete(`cache:tenant:${tenant_id}:ledger:summary`)

    return c.json(apiResponse(true, { id, tenant_id, entry_type, amount_kobo }), { status: 201 })
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error creating ledger entry:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// MODULE MANAGEMENT ENDPOINTS
// ============================================================================

app.get('/modules', async (c) => {
  try {
    await requirePermission(c, 'read:tenants')

    const result = await c.env.MODULES_DB.prepare(
      `SELECT id, name, description, version, status, category FROM modules ORDER BY name ASC`
    ).all()

    return c.json(apiResponse(true, result.results))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

app.get('/modules/:tenantId', async (c) => {
  try {
    const tenantId = c.req.param('tenantId')
    const result = await c.env.MODULES_DB.prepare(
      `SELECT m.id, m.name, m.description, m.version, m.status, tm.enabled
       FROM modules m
       LEFT JOIN tenant_modules tm ON m.id = tm.module_id AND tm.tenant_id = ?
       ORDER BY m.name ASC`
    )
      .bind(tenantId)
      .all()

    return c.json(apiResponse(true, result.results))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

app.put('/modules/:tenantId/:moduleId', async (c) => {
  try {
    await requirePermission(c, 'manage:modules')

    const { tenantId, moduleId } = c.req.param()
    const { enabled } = parseBody(ModuleToggleSchema, await c.req.json())

    const id = `tm_${tenantId}_${moduleId}`
    await c.env.MODULES_DB.prepare(
      `INSERT OR REPLACE INTO tenant_modules (id, tenant_id, module_id, enabled, enabled_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(id, tenantId, moduleId, enabled ? 1 : 0)
      .run()

    const flagKey = `tenant:${tenantId}:module:${moduleId}`
    await c.env.FEATURE_FLAGS_KV.put(flagKey, JSON.stringify({ enabled, updatedAt: Date.now() }))

    return c.json(apiResponse(true, { id, tenantId, moduleId, enabled }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// SETTINGS ENDPOINTS
// ============================================================================

const PLATFORM_SETTINGS_DEFAULTS = {
  apiRateLimit: 1000,
  sessionTimeout: 3600,
  maintenanceMode: false,
  maxTenantCount: 10000,
  coreInvariants: [
    'Build Once Use Infinitely',
    'Mobile First',
    'PWA First',
    'Offline First',
    'Nigeria First',
    'Africa First',
    'Vendor Neutral AI',
  ],
  version: '2.0.0',
}

app.get('/settings', async (c) => {
  try {
    await requirePermission(c, 'read:settings')

    const stored = await c.env.FEATURE_FLAGS_KV.get('platform:settings', 'json') as Record<string, unknown> | null
    const settings = { ...PLATFORM_SETTINGS_DEFAULTS, ...(stored || {}) }
    return c.json(apiResponse(true, settings))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})


app.put('/settings', async (c) => {
  try {
    await requirePermission(c, 'manage:settings')  // T-05: was incorrectly 'write:tenants'

    const body = parseBody(SettingsUpdateSchema, await c.req.json())
    // Merge with existing persisted settings (preserve unspecified fields)
    const existing = await c.env.FEATURE_FLAGS_KV.get('platform:settings', 'json') as Record<string, unknown> | null
    const merged = { ...PLATFORM_SETTINGS_DEFAULTS, ...(existing || {}), ...body, updatedAt: Date.now() }
    await c.env.FEATURE_FLAGS_KV.put('platform:settings', JSON.stringify(merged))
    return c.json(apiResponse(true, { updated: true, settings: merged }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// TENANT STATS ENDPOINT — GET /tenants/stats
// ============================================================================

/**
 * GET /tenants/stats
 * Returns aggregate counts and revenue across all tenants
 */
app.get('/tenants/stats', async (c) => {
  try {
    await requireAuth(c)

    const [counts, revenue] = await Promise.all([
      c.env.TENANTS_DB.prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) as suspended,
          SUM(CASE WHEN status = 'TRIAL' THEN 1 ELSE 0 END) as trial,
          SUM(CASE WHEN status = 'CHURNED' THEN 1 ELSE 0 END) as churned
         FROM tenants WHERE deleted_at IS NULL`
      ).first(),
      c.env.BILLING_DB.prepare(
        `SELECT
          SUM(CASE WHEN entry_type = 'REVENUE' THEN amount_kobo ELSE 0 END) as total_revenue_kobo,
          SUM(CASE WHEN entry_type = 'COMMISSION' THEN amount_kobo ELSE 0 END) as total_commission_kobo
         FROM ledger_entries`
      ).first(),
    ])

    return c.json(apiResponse(true, {
      totalTenants: Number(counts?.total || 0),
      activeTenants: Number(counts?.active || 0),
      suspendedTenants: Number(counts?.suspended || 0),
      trialTenants: Number(counts?.trial || 0),
      churnedTenants: Number(counts?.churned || 0),
      totalRevenueKobo: Number(revenue?.total_revenue_kobo || 0),
      totalCommissionKobo: Number(revenue?.total_commission_kobo || 0),
    }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching tenant stats:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// BILLING METRICS & COMMISSIONS — GET /billing/metrics, GET /billing/commissions
// ============================================================================

/**
 * GET /billing/metrics
 * Aggregated billing metrics for the platform
 */
app.get('/billing/metrics', async (c) => {
  try {
    await requirePermission(c, 'read:billing')

    const tenantId = await getTenantId(c)
    const cacheKey = `cache:billing:metrics:${tenantId}`
    const cached = await c.env.CACHE_KV.get(cacheKey)
    if (cached) return c.json(apiResponse(true, JSON.parse(cached)))

    const [summary, plans] = await Promise.all([
      c.env.BILLING_DB.prepare(
        `SELECT
          SUM(CASE WHEN entry_type = 'REVENUE' THEN amount_kobo ELSE 0 END) as total_revenue,
          SUM(CASE WHEN entry_type = 'COMMISSION' THEN amount_kobo ELSE 0 END) as total_commissions,
          SUM(CASE WHEN entry_type = 'PAYOUT' THEN amount_kobo ELSE 0 END) as total_payouts,
          COUNT(DISTINCT CASE WHEN entry_type = 'REVENUE' THEN date(created_at) END) as active_days,
          COUNT(*) as total_entries
         FROM ledger_entries
         WHERE created_at > datetime('now', '-30 days')`
      ).first(),
      c.env.BILLING_DB.prepare(
        `SELECT COUNT(*) as active_plans FROM billing_plans WHERE status = 'ACTIVE'`
      ).first(),
    ])

    const metrics = {
      totalRevenueKobo: Number(summary?.total_revenue || 0),
      totalCommissionsKobo: Number(summary?.total_commissions || 0),
      totalPayoutsKobo: Number(summary?.total_payouts || 0),
      netRevenueKobo: Number(summary?.total_revenue || 0) - Number(summary?.total_payouts || 0),
      activeBillingPlans: Number(plans?.active_plans || 0),
      totalLedgerEntries: Number(summary?.total_entries || 0),
      periodDays: 30,
      generatedAt: new Date().toISOString(),
    }

    await c.env.CACHE_KV.put(cacheKey, JSON.stringify(metrics), { expirationTtl: 300 })
    return c.json(apiResponse(true, metrics))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching billing metrics:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * GET /billing/commissions
 * List commissions with pagination
 */
app.get('/billing/commissions', async (c) => {
  try {
    await requirePermission(c, 'read:billing')

    const page = Math.max(1, Number(c.req.query('page') || 1))
    const limit = Math.min(Number(c.req.query('limit') || 20), 100)
    const offset = (page - 1) * limit
    const status = c.req.query('status')

    let query = `SELECT id, tenant_id, affiliate_id, level, transaction_id, amount_kobo, rate_percent, status, created_at, paid_at
                 FROM commissions`
    const params: any[] = []
    if (status) {
      query += ` WHERE status = ?`
      params.push(status)
    }
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const [results, countResult] = await Promise.all([
      c.env.BILLING_DB.prepare(query).bind(...params).all(),
      c.env.BILLING_DB.prepare(
        `SELECT COUNT(*) as total FROM commissions${status ? ' WHERE status = ?' : ''}`
      ).bind(...(status ? [status] : [])).first(),
    ])

    return c.json(apiResponse(true, {
      commissions: results.results,
      pagination: { page, limit, total: Number(countResult?.total || 0) },
    }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching commissions:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// HEALTH STATUS & ALERTS — GET /health/status, GET /health/alerts
// ============================================================================

/**
 * GET /health/status
 * Overall platform health status (aggregate across all services)
 */
app.get('/health/status', async (c) => {
  try {
    const [services, unresolvedAlerts] = await Promise.all([
      c.env.HEALTH_DB.prepare(
        `SELECT service_name, status, uptime_percent, response_time_ms, last_check_at
         FROM service_health ORDER BY service_name`
      ).all(),
      c.env.HEALTH_DB.prepare(
        `SELECT COUNT(*) as count FROM alerts WHERE resolved = 0`
      ).first(),
    ])

    const serviceList = services.results as any[]
    const downCount = serviceList.filter((s: any) => s.status === 'DOWN').length
    const degradedCount = serviceList.filter((s: any) => s.status === 'DEGRADED').length
    const overallStatus = downCount > 0 ? 'DOWN' : degradedCount > 0 ? 'DEGRADED' : 'HEALTHY'
    const avgUptime = serviceList.length > 0
      ? serviceList.reduce((acc: number, s: any) => acc + (s.uptime_percent || 100), 0) / serviceList.length
      : 100

    return c.json(apiResponse(true, {
      status: overallStatus,
      services: serviceList.length,
      servicesDown: downCount,
      servicesDegraded: degradedCount,
      avgUptimePercent: Math.round(avgUptime * 100) / 100,
      unresolvedAlerts: Number(unresolvedAlerts?.count || 0),
      checkedAt: new Date().toISOString(),
    }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching health status:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * GET /health/alerts
 * List system alerts with optional resolved filter
 */
app.get('/health/alerts', async (c) => {
  try {
    const resolved = c.req.query('resolved')
    const limit = Math.min(Number(c.req.query('limit') || 50), 200)

    let query = `SELECT id, alert_type, severity, message, resolved, created_at, resolved_at
                 FROM alerts`
    const params: any[] = []
    if (resolved === 'false' || resolved === '0') {
      query += ` WHERE resolved = 0`
    } else if (resolved === 'true' || resolved === '1') {
      query += ` WHERE resolved = 1`
    }
    query += ` ORDER BY created_at DESC LIMIT ?`
    params.push(limit)

    const result = await c.env.HEALTH_DB.prepare(query).bind(...params).all()
    return c.json(apiResponse(true, result.results))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching alerts:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * POST /health/alerts
 * Create a system alert (internal use / monitoring hooks)
 */
app.post('/health/alerts', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const { alert_type, severity, message: msg } = parseBody(HealthAlertSchema, await c.req.json())

    const id = generateId('alert')
    await c.env.HEALTH_DB.prepare(
      `INSERT INTO alerts (id, alert_type, severity, message, resolved, created_at)
       VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`
    ).bind(id, alert_type, severity, msg).run()

    return c.json(apiResponse(true, { id, alert_type, severity, message: msg }), { status: 201 })
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// SETTINGS: API KEYS — GET/POST/DELETE /settings/api-keys
// ============================================================================

/**
 * GET /settings/api-keys
 * List API keys for the current tenant (key hash shown, not plaintext)
 */
app.get('/settings/api-keys', async (c) => {
  try {
    const session = await requireAuth(c)
    const tenantId = session.tenantId || 'super-admin'

    const kvKey = `apikeys:${tenantId}`
    const raw = await c.env.CACHE_KV.get(kvKey)
    const keys = raw ? JSON.parse(raw) : []

    return c.json(apiResponse(true, keys))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * POST /settings/api-keys
 * Generate a new API key for the current tenant
 */
app.post('/settings/api-keys', async (c) => {
  try {
    const session = await requireAuth(c)
    await requirePermission(c, 'manage:settings')

    const { name } = parseBody(ApiKeyCreateSchema, await c.req.json())

    const tenantId = session.tenantId || 'super-admin'
    const kvKey = `apikeys:${tenantId}`

    // Generate a random API key
    const keyBytes = crypto.getRandomValues(new Uint8Array(32))
    const keyHex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    const apiKey = `ww_${keyHex}`

    // Hash for storage (never store plaintext)
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(apiKey))
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

    const newEntry = {
      id: generateId('key'),
      name: name.trim(),
      keyHint: `ww_...${keyHex.slice(-8)}`,
      keyHash: hashHex,
      tenantId,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    }

    const raw = await c.env.CACHE_KV.get(kvKey)
    const keys = raw ? JSON.parse(raw) : []
    keys.push(newEntry)
    await c.env.CACHE_KV.put(kvKey, JSON.stringify(keys))

    // Return the plaintext key ONCE — client must store it
    return c.json(apiResponse(true, {
      ...newEntry,
      apiKey, // Only returned on creation
    }), { status: 201 })
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * DELETE /settings/api-keys/:id
 * Revoke an API key
 */
app.delete('/settings/api-keys/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    await requirePermission(c, 'manage:settings')

    const keyId = c.req.param('id')
    const tenantId = session.tenantId || 'super-admin'
    const kvKey = `apikeys:${tenantId}`

    const raw = await c.env.CACHE_KV.get(kvKey)
    const keys = raw ? JSON.parse(raw) : []
    const filtered = keys.filter((k: any) => k.id !== keyId)

    if (filtered.length === keys.length) {
      throw new HTTPException(404, { message: 'API key not found' })
    }

    await c.env.CACHE_KV.put(kvKey, JSON.stringify(filtered))
    return c.json(apiResponse(true, { deleted: true, id: keyId }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// AUDIT LOG — GET /settings/audit-log, POST /settings/audit-log
// ============================================================================

/**
 * GET /settings/audit-log
 * Paginated audit log entries from RBAC_DB
 */
app.get('/settings/audit-log', async (c) => {
  try {
    await requirePermission(c, 'read:settings')

    const page = Math.max(1, Number(c.req.query('page') || 1))
    const limit = Math.min(Number(c.req.query('limit') || 50), 200)
    const offset = (page - 1) * limit
    const action = c.req.query('action')
    const userId = c.req.query('user_id')

    let query = `SELECT id, user_id, action, resource_type, resource_id, ip_address, created_at
                 FROM audit_log WHERE 1=1`
    const params: any[] = []
    if (action) { query += ` AND action = ?`; params.push(action) }
    if (userId) { query += ` AND user_id = ?`; params.push(userId) }
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const [results, countResult] = await Promise.all([
      c.env.RBAC_DB.prepare(query).bind(...params).all(),
      c.env.RBAC_DB.prepare(
        `SELECT COUNT(*) as total FROM audit_log`
      ).first(),
    ])

    return c.json(apiResponse(true, {
      entries: results.results,
      pagination: { page, limit, total: Number(countResult?.total || 0) },
    }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching audit log:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * POST /settings/audit-log
 * Append an audit log entry (called server-side from sensitive operations)
 * This is an internal endpoint — only accessible with write:tenants permission
 */
app.post('/settings/audit-log', async (c) => {
  try {
    await requirePermission(c, 'write:tenants')

    const { user_id, action, resource_type, resource_id } = parseBody(AuditLogEntrySchema, await c.req.json())

    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null
    const id = generateId('audit')
    await c.env.RBAC_DB.prepare(
      `INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(id, user_id, action, resource_type, resource_id || null, ip).run()

    return c.json(apiResponse(true, { id, action, resource_type }), { status: 201 })
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// AUDIT LOG ALIASES — /audit-log (canonical) mirrors /settings/audit-log
// The frontend calls /audit-log; keep /settings/audit-log for backward compat.
// ============================================================================
app.get('/audit-log', async (c) => {
  try {
    await requirePermission(c, 'read:settings')

    const page = Math.max(1, Number(c.req.query('page') || 1))
    const limit = Math.min(Number(c.req.query('limit') || 50), 200)
    const offset = (page - 1) * limit
    const action = c.req.query('action')
    const userId = c.req.query('user_id')
    const search = c.req.query('search')

    let query = `SELECT id, user_id, action, resource_type, resource_id, ip_address, created_at
                 FROM audit_log WHERE 1=1`
    const params: any[] = []
    if (action) { query += ` AND action = ?`; params.push(action) }
    if (userId) { query += ` AND user_id = ?`; params.push(userId) }
    if (search) { query += ` AND (action LIKE ? OR resource_type LIKE ? OR user_id LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`) }
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    // Filtered count
    let countQuery = `SELECT COUNT(*) as total FROM audit_log WHERE 1=1`
    const countParams: any[] = []
    if (action) { countQuery += ` AND action = ?`; countParams.push(action) }
    if (userId) { countQuery += ` AND user_id = ?`; countParams.push(userId) }
    if (search) { countQuery += ` AND (action LIKE ? OR resource_type LIKE ? OR user_id LIKE ?)`; countParams.push(`%${search}%`, `%${search}%`, `%${search}%`) }

    const [results, countResult] = await Promise.all([
      c.env.RBAC_DB.prepare(query).bind(...params).all(),
      countParams.length
        ? c.env.RBAC_DB.prepare(countQuery).bind(...countParams).first()
        : c.env.RBAC_DB.prepare(countQuery).first(),
    ])

    return c.json(apiResponse(true, {
      entries: results.results,
      pagination: { page, limit, total: Number(countResult?.total || 0) },
    }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching audit log:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Circuit breaker state (in-memory per isolate)
const CIRCUIT_BREAKER: Record<string, { failures: number; openUntil: number }> = {}
const CB_THRESHOLD = 5
const CB_RESET_MS = 30_000

function isCircuitOpen(key: string): boolean {
  const state = CIRCUIT_BREAKER[key]
  if (!state) return false
  if (Date.now() < state.openUntil) return true
  delete CIRCUIT_BREAKER[key]
  return false
}

function recordFailure(key: string): void {
  if (!CIRCUIT_BREAKER[key]) CIRCUIT_BREAKER[key] = { failures: 0, openUntil: 0 }
  CIRCUIT_BREAKER[key].failures += 1
  if (CIRCUIT_BREAKER[key].failures >= CB_THRESHOLD) {
    CIRCUIT_BREAKER[key].openUntil = Date.now() + CB_RESET_MS
    console.error(`[circuit-breaker] OPEN for "${key}" after ${CB_THRESHOLD} failures — reset in ${CB_RESET_MS / 1000}s`)
  }
}

function resetCircuit(key: string): void {
  delete CIRCUIT_BREAKER[key]
}

export { isCircuitOpen, recordFailure, resetCircuit }

app.onError(async (err, c) => {
  const status = err instanceof HTTPException ? err.status : 500
  const message = err instanceof HTTPException ? err.message : 'Internal server error'

  console.error(`[error] ${c.req.method} ${c.req.path} → ${status}:`, err)

  // For 5xx errors: insert alert into HEALTH_DB if available
  if (status >= 500) {
    recordFailure('global')
    try {
      const db = (c.env as any).HEALTH_DB
      if (db) {
        const alertId = generateId('alert')
        await db.prepare(
          `INSERT OR IGNORE INTO alerts (id, service, severity, message, resolved, created_at)
           VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`
        ).bind(
          alertId,
          c.req.path,
          'critical',
          `${status} error on ${c.req.method} ${c.req.path}: ${message}`
        ).run().catch(() => {})
      }
    } catch {
      // Alert insert failure must never mask the original error response
    }
  } else {
    resetCircuit('global')
  }

  return c.json(apiResponse(false, null, [message]), { status })
})

app.notFound((c) => {
  return c.json(apiResponse(false, null, ['Not found']), { status: 404 })
})

// ============================================================================
// EXPORT
// ============================================================================

export default app
