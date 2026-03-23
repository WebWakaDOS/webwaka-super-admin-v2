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
 * Date: 2026-03-21
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import bcrypt from 'bcryptjs'
import { signJWT } from '@webwaka/core'
import type { Context as HonoContext } from 'hono'

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

  // Environment variables
  JWT_SECRET: string
  ENVIRONMENT: string
}

type Context = HonoContext<{ Bindings: Bindings }>

// ============================================================================
// INITIALIZATION
// ============================================================================

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
)

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function apiResponse(success: boolean, data?: any, errors?: string[]) {
  return { success, data, errors }
}

function generateId(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = prefix + '-'
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

async function getTenantId(c: any): Promise<string> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return 'super-admin'
  const token = authHeader.replace('Bearer ', '')
  try {
    const session = await c.env.SESSIONS_KV.get(token)
    if (session) {
      const data = JSON.parse(session)
      return data.tenantId || 'super-admin'
    }
  } catch (_) {}
  return 'super-admin'
}

async function requirePermission(c: any, permission: string): Promise<boolean> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return false
  const token = authHeader.replace('Bearer ', '')
  try {
    const session = await c.env.SESSIONS_KV.get(token)
    if (session) {
      const data = JSON.parse(session)
      return (
        data.permissions?.includes(permission) ||
        data.permissions?.includes('read:all') ||
        data.role === 'SUPER_ADMIN'
      )
    }
  } catch (_) {}
  return false
}

// ============================================================================
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
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * POST /auth/login
 * Authenticate user and return session token
 */
app.post('/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json()

    const result = await c.env.RBAC_DB.prepare(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.tenant_id, u.password_hash, r.name as role
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.email = ? AND u.status = 'ACTIVE'`
    )
      .bind(email)
      .first()


    if (!result) {
      throw new HTTPException(401, { message: 'Invalid credentials' })
    }

    const isValidPassword = await bcrypt.compare(password, result.password_hash)
    if (!isValidPassword) {
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

    const token = await signJWT({
      sub: result.id,
      email: result.email,
      tenantId: result.tenant_id,
      role: result.role || 'CUSTOMER',
      permissions
    }, c.env.JWT_SECRET || 'default-secret-for-dev-only')

    await c.env.SESSIONS_KV.put(
      'session:' + token,

      JSON.stringify({
        userId: result.id,
        email: result.email,
        tenantId: result.tenant_id,
        role: result.role,
        permissions,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      }),
      { expirationTtl: 86400 }
    )

    return c.json(
      apiResponse(true, {
        token,
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
 * POST /auth/logout
 * Invalidate session token
 */
app.post('/auth/logout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      await c.env.SESSIONS_KV.delete(token)
    }
    return c.json(apiResponse(true, { message: 'Logged out successfully' }))
  } catch (err) {
    console.error('Logout error:', err)
    return c.json(apiResponse(true, { message: 'Logged out' }))
  }
})

/**
 * GET /auth/me
 * Get current user info from session token
 */
app.get('/auth/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) throw new HTTPException(401, { message: 'Unauthorized' })

    const token = authHeader.replace('Bearer ', '')
    const session = await c.env.SESSIONS_KV.get(token)
    if (!session) throw new HTTPException(401, { message: 'Session expired' })

    const data = JSON.parse(session)
    if (data.expiresAt < Date.now()) {
      await c.env.SESSIONS_KV.delete(token)
      throw new HTTPException(401, { message: 'Session expired' })
    }

    return c.json(
      apiResponse(true, {
        userId: data.userId,
        email: data.email,
        tenantId: data.tenantId,
        role: data.role,
        permissions: data.permissions,
      })
    )
  } catch (err) {
    if (err instanceof HTTPException) throw err
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
    const hasPermission = await requirePermission(c, 'read:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

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
 * Create new tenant
 */
app.post('/tenants', async (c) => {
  try {
    const hasPermission = await requirePermission(c, 'write:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

    const { name, email, industry, domain } = await c.req.json()
    if (!name || !email || !industry) {
      throw new HTTPException(400, { message: 'name, email, and industry are required' })
    }

    const tenantId = generateId('tenant')
    await c.env.TENANTS_DB.prepare(
      `INSERT INTO tenants (id, name, email, status, industry, domain, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, 'ACTIVE', ?, ?, 'super-admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(tenantId, name, email, industry, domain || null)
      .run()

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
    const hasPermission = await requirePermission(c, 'read:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

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
    const hasPermission = await requirePermission(c, 'write:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

    const id = c.req.param('id')
    const body = await c.req.json()
    const allowed = ['name', 'email', 'status', 'industry', 'domain']
    const updates: string[] = []
    const params: any[] = []

    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates.push(`${key} = ?`)
        params.push(body[key])
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
    const hasPermission = await requirePermission(c, 'write:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

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
    const hasPermission = await requirePermission(c, 'read:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

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
    const countResult = await c.env.TENANTS_DB.prepare(
      `SELECT COUNT(*) as total FROM partners`
    ).first()

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
    const hasPermission = await requirePermission(c, 'write:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

    const body = await c.req.json()
    const { name, email, phone, company, tier, commission_rate_percent, ndpr_consent, monthly_fee_kobo, notes } = body

    if (!name || !email) {
      throw new HTTPException(400, { message: 'name and email are required' })
    }
    if (!ndpr_consent) {
      throw new HTTPException(400, { message: 'NDPR consent is required (Nigeria First invariant)' })
    }

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
    const hasPermission = await requirePermission(c, 'read:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

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
    const hasPermission = await requirePermission(c, 'write:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

    const id = c.req.param('id')
    const body = await c.req.json()
    const allowed = ['name', 'email', 'phone', 'company', 'status', 'tier', 'commission_rate_percent', 'monthly_fee_kobo', 'notes']
    const updates: string[] = []
    const params: any[] = []

    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates.push(`${key} = ?`)
        params.push(body[key])
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
    const hasPermission = await requirePermission(c, 'write:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

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
    const hasPermission = await requirePermission(c, 'write:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

    const partnerId = c.req.param('id')
    const { suite, action } = await c.req.json()

    if (!suite || !action) throw new HTTPException(400, { message: 'suite and action are required' })
    if (!['assign', 'revoke', 'suspend'].includes(action)) {
      throw new HTTPException(400, { message: 'action must be assign, revoke, or suspend' })
    }

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
    const hasPermission = await requirePermission(c, 'read:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

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
    const hasPermission = await requirePermission(c, 'read:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

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
    const hasPermission = await requirePermission(c, 'write:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

    const id = c.req.param('id')
    const { worker_status, pages_status, last_pipeline_status, last_commit_sha } = await c.req.json()

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
    const hasPermission = await requirePermission(c, 'write:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

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
    const hasPermission = await requirePermission(c, 'read:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

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
    const hasPermission = await requirePermission(c, 'read:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

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
    const hasPermission = await requirePermission(c, 'write:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

    const body = await c.req.json()
    const {
      tenant_id, suite, metric_date,
      gross_revenue_kobo = 0, net_revenue_kobo = 0, commission_paid_kobo = 0,
      transaction_count = 0, active_users = 0,
      uptime_percent = 100, error_rate_percent = 0, avg_response_ms = 0,
      ai_tokens_used = 0, ai_cost_kobo = 0, ai_vendor = null,
    } = body

    if (!tenant_id || !suite || !metric_date) {
      throw new HTTPException(400, { message: 'tenant_id, suite, and metric_date are required' })
    }

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
    const hasPermission = await requirePermission(c, 'read:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

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
    const hasPermission = await requirePermission(c, 'read:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

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
    const hasPermission = await requirePermission(c, 'write:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

    const tenantId = c.req.param('tenantId')
    const { monthly_token_limit, daily_token_limit, active_vendor, byok_key_ref } = await c.req.json()

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
    const hasPermission = await requirePermission(c, 'write:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

    const tenantId = c.req.param('tenantId')
    const { resetType } = await c.req.json()

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
// BILLING ENDPOINTS
// ============================================================================

/**
 * GET /billing/ledger
 * Get ledger entries for tenant
 */
app.get('/billing/ledger', async (c) => {
  try {
    const hasPermission = await requirePermission(c, 'read:billing')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

    const tenantId = await getTenantId(c)
    const result = await c.env.BILLING_DB.prepare(
      `SELECT id, entry_type, account_from, account_to, amount_kobo, description, created_at
       FROM ledger_entries
       WHERE tenant_id = ?
       ORDER BY created_at DESC
       LIMIT 100`
    )
      .bind(tenantId)
      .all()

    return c.json(apiResponse(true, result.results))
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
    const tenantId = await getTenantId(c)
    const cacheKey = `cache:tenant:${tenantId}:ledger:summary`

    const cached = await c.env.CACHE_KV.get(cacheKey)
    if (cached) return c.json(apiResponse(true, JSON.parse(cached)))

    const result = await c.env.BILLING_DB.prepare(
      `SELECT
        SUM(CASE WHEN entry_type = 'REVENUE' THEN amount_kobo ELSE 0 END) as total_revenue,
        SUM(CASE WHEN entry_type = 'COMMISSION' THEN amount_kobo ELSE 0 END) as total_commissions,
        SUM(CASE WHEN entry_type = 'PAYOUT' THEN amount_kobo ELSE 0 END) as total_payouts
       FROM ledger_entries WHERE tenant_id = ?`
    )
      .bind(tenantId)
      .first()

    const summary = {
      mtd: Number(result?.total_revenue) || 0,
      ytd: Number(result?.total_revenue) || 0,
      balance: (Number(result?.total_revenue) || 0) - (Number(result?.total_payouts) || 0),
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
    const hasPermission = await requirePermission(c, 'write:billing')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

    const { tenant_id, entry_type, account_from, account_to, amount_kobo, description } = await c.req.json()

    if (!tenant_id || !entry_type || !amount_kobo) {
      throw new HTTPException(400, { message: 'tenant_id, entry_type, and amount_kobo are required' })
    }
    if (typeof amount_kobo !== 'number' || !Number.isInteger(amount_kobo)) {
      throw new HTTPException(400, { message: 'amount_kobo must be an integer (Nigeria First: kobo only)' })
    }

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
    const hasPermission = await requirePermission(c, 'read:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

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
    const hasPermission = await requirePermission(c, 'manage:modules')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

    const { tenantId, moduleId } = c.req.param()
    const { enabled } = await c.req.json()

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

app.get('/settings', async (c) => {
  try {
    const hasPermission = await requirePermission(c, 'read:settings')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

    return c.json(
      apiResponse(true, {
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
      })
    )
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

app.put('/settings', async (c) => {
  try {
    const hasPermission = await requirePermission(c, 'write:tenants')
    if (!hasPermission) throw new HTTPException(403, { message: 'Forbidden' })

    const body = await c.req.json()
    // Store settings in KV
    await c.env.FEATURE_FLAGS_KV.put('platform:settings', JSON.stringify({ ...body, updatedAt: Date.now() }))
    return c.json(apiResponse(true, { updated: true, settings: body }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  if (err instanceof HTTPException) {
    return c.json(apiResponse(false, null, [err.message]), { status: err.status })
  }
  return c.json(apiResponse(false, null, ['Internal server error']), { status: 500 })
})

app.notFound((c) => {
  return c.json(apiResponse(false, null, ['Not found']), { status: 404 })
})

// ============================================================================
// EXPORT
// ============================================================================

export default app
