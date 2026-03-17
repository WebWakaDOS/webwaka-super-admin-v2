import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'

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

type Context = HonoRequest<{ Bindings: Bindings }>

// ============================================================================
// INITIALIZATION
// ============================================================================

const app = new Hono<{ Bindings: Bindings }>()

// Middleware
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

/**
 * Standard API response format
 */
function apiResponse(success: boolean, data?: any, errors?: string[]) {
  return { success, data, errors }
}

/**
 * Extract tenant ID from request (from header or JWT)
 */
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
  } catch (e) {
    // Fall back to super-admin
  }
  return 'super-admin'
}

/**
 * Verify user has required permission
 */
async function requirePermission(c: any, permission: string): Promise<boolean> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return false
  
  const token = authHeader.replace('Bearer ', '')
  try {
    const session = await c.env.SESSIONS_KV.get(token)
    if (session) {
      const data = JSON.parse(session)
      return data.permissions?.includes(permission) || data.permissions?.includes('read:all')
    }
  } catch (e) {
    // Fall back to no permission
  }
  return false
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (c) => {
  return c.json(
    apiResponse(true, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT,
    })
  )
})

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * POST /auth/login
 * Authenticate user and return JWT token with permissions from RBAC_DB
 */
app.post('/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json()

    // Query RBAC_DB for user
    const result = await c.env.RBAC_DB.prepare(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.tenant_id, r.name as role
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.email = ? AND u.status = 'ACTIVE'`
    ).bind(email).first()

    if (!result) {
      throw new HTTPException(401, { message: 'Invalid credentials' })
    }

    // Get permissions for role
    const permissionsResult = await c.env.RBAC_DB.prepare(
      `SELECT p.name FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = (SELECT id FROM roles WHERE name = ?)`
    ).bind(result.role || 'CUSTOMER').all()

    const permissions = permissionsResult.results?.map((r: any) => r.name) || []

    // Create JWT token (simplified - in production use proper JWT library)
    const token = 'jwt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

    // Store session in KV
    await c.env.SESSIONS_KV.put(
      token,
      JSON.stringify({
        userId: result.id,
        email: result.email,
        tenantId: result.tenant_id,
        role: result.role,
        permissions,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 86400000, // 24 hours
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

// ============================================================================
// TENANT MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /tenants
 * List all tenants (super admin only)
 */
app.get('/tenants', async (c) => {
  try {
    const hasPermission = await requirePermission(c, 'read:tenants')
    if (!hasPermission) {
      throw new HTTPException(403, { message: 'Forbidden' })
    }

    const result = await c.env.TENANTS_DB.prepare(
      `SELECT id, name, email, status, industry, domain, created_at
       FROM tenants
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`
    ).all()

    return c.json(apiResponse(true, result.results))
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
    if (!hasPermission) {
      throw new HTTPException(403, { message: 'Forbidden' })
    }

    const { name, email, industry, domain } = await c.req.json()
    const tenantId = 'tenant_' + Date.now()

    await c.env.TENANTS_DB.prepare(
      `INSERT INTO tenants (id, name, email, status, industry, domain, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, 'ACTIVE', ?, ?, 'super-admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(tenantId, name, email, industry, domain).run()

    return c.json(
      apiResponse(true, { id: tenantId, name, email, status: 'ACTIVE', industry, domain })
    )
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error creating tenant:', err)
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
    if (!hasPermission) {
      throw new HTTPException(403, { message: 'Forbidden' })
    }

    const tenantId = await getTenantId(c)
    const result = await c.env.BILLING_DB.prepare(
      `SELECT id, entry_type, account_from, account_to, amount_kobo, description, created_at
       FROM ledger_entries
       WHERE tenant_id = ?
       ORDER BY created_at DESC
       LIMIT 100`
    ).bind(tenantId).all()

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

    // Try to get from cache
    const cached = await c.env.CACHE_KV.get(cacheKey)
    if (cached) {
      return c.json(apiResponse(true, JSON.parse(cached)))
    }

    // Calculate summary from ledger
    const result = await c.env.BILLING_DB.prepare(
      `SELECT 
        SUM(CASE WHEN entry_type = 'REVENUE' THEN amount_kobo ELSE 0 END) as total_revenue,
        SUM(CASE WHEN entry_type = 'COMMISSION' THEN amount_kobo ELSE 0 END) as total_commissions,
        SUM(CASE WHEN entry_type = 'PAYOUT' THEN amount_kobo ELSE 0 END) as total_payouts
       FROM ledger_entries
       WHERE tenant_id = ?`
    ).bind(tenantId).first()

    const summary = {
      mtd: result?.total_revenue || 0,
      ytd: result?.total_revenue || 0,
      balance: (result?.total_revenue || 0) - (result?.total_payouts || 0),
      lastUpdated: Date.now(),
    }

    // Cache for 15 minutes
    await c.env.CACHE_KV.put(cacheKey, JSON.stringify(summary), { expirationTtl: 900 })

    return c.json(apiResponse(true, summary))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching billing summary:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// MODULE MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /modules
 * List all modules
 */
app.get('/modules', async (c) => {
  try {
    const hasPermission = await requirePermission(c, 'read:modules')
    if (!hasPermission) {
      throw new HTTPException(403, { message: 'Forbidden' })
    }

    const result = await c.env.MODULES_DB.prepare(
      `SELECT id, name, description, version, status, category
       FROM modules
       ORDER BY name ASC`
    ).all()

    return c.json(apiResponse(true, result.results))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching modules:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * GET /modules/:tenantId
 * Get enabled modules for tenant
 */
app.get('/modules/:tenantId', async (c) => {
  try {
    const tenantId = c.req.param('tenantId')
    const result = await c.env.MODULES_DB.prepare(
      `SELECT m.id, m.name, m.description, m.version, m.status, tm.enabled
       FROM modules m
       LEFT JOIN tenant_modules tm ON m.id = tm.module_id AND tm.tenant_id = ?
       ORDER BY m.name ASC`
    ).bind(tenantId).all()

    return c.json(apiResponse(true, result.results))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching tenant modules:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

/**
 * PUT /modules/:tenantId/:moduleId
 * Enable/disable module for tenant
 */
app.put('/modules/:tenantId/:moduleId', async (c) => {
  try {
    const hasPermission = await requirePermission(c, 'manage:modules')
    if (!hasPermission) {
      throw new HTTPException(403, { message: 'Forbidden' })
    }

    const { tenantId, moduleId } = c.req.param()
    const { enabled } = await c.req.json()

    const id = `tm_${tenantId}_${moduleId}`
    await c.env.MODULES_DB.prepare(
      `INSERT OR REPLACE INTO tenant_modules (id, tenant_id, module_id, enabled, enabled_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(id, tenantId, moduleId, enabled ? 1 : 0).run()

    // Update feature flags KV
    const flagKey = `tenant:${tenantId}:module:${moduleId}`
    await c.env.FEATURE_FLAGS_KV.put(flagKey, JSON.stringify({ enabled, updatedAt: Date.now() }))

    return c.json(apiResponse(true, { id, tenantId, moduleId, enabled }))
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error updating module:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// SYSTEM HEALTH ENDPOINTS
// ============================================================================

/**
 * GET /health/services
 * Get health status of all services
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
 * Get system metrics
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

// ============================================================================
// SETTINGS ENDPOINTS
// ============================================================================

/**
 * GET /settings
 * Get system settings
 */
app.get('/settings', async (c) => {
  try {
    const hasPermission = await requirePermission(c, 'read:settings')
    if (!hasPermission) {
      throw new HTTPException(403, { message: 'Forbidden' })
    }

    // Return default settings
    return c.json(
      apiResponse(true, {
        apiRateLimit: 1000,
        sessionTimeout: 3600,
        maintenanceMode: false,
        maxTenantCount: 10000,
      })
    )
  } catch (err) {
    if (err instanceof HTTPException) throw err
    console.error('Error fetching settings:', err)
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  if (err instanceof HTTPException) {
    return c.json(
      apiResponse(false, null, [err.message]),
      { status: err.status }
    )
  }
  return c.json(
    apiResponse(false, null, ['Internal server error']),
    { status: 500 }
  )
})

// ============================================================================
// 404 HANDLER
// ============================================================================

app.notFound((c) => {
  return c.json(
    apiResponse(false, null, ['Not found']),
    { status: 404 }
  )
})

// ============================================================================
// EXPORT
// ============================================================================

export default app
