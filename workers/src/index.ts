import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'

type Bindings = {
  SESSIONS: KVNamespace
  CACHE: KVNamespace
  JWT_SECRET: string
  ENVIRONMENT: string
}

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

// Mock data storage
const mockTenants = [
  { id: '1', name: 'Acme Corp', status: 'active', createdAt: '2024-01-15', modules: ['core', 'analytics'] },
  { id: '2', name: 'TechStart Inc', status: 'active', createdAt: '2024-02-20', modules: ['core'] },
]

const mockModules = [
  { id: 'core', name: 'Core Platform', description: 'Essential features', enabled: true },
  { id: 'analytics', name: 'Analytics', description: 'Advanced reporting', enabled: true },
  { id: 'api', name: 'API Access', description: 'REST API', enabled: false },
]

// ============ Health Check ============
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
  })
})

// ============ Auth Endpoints ============
app.post('/auth/login', async (c) => {
  const { email, password } = await c.req.json()

  // Mock authentication
  if (email === 'admin@webwaka.com' && password === 'password') {
    const token = 'mock-jwt-token-' + Date.now()
    await c.env.SESSIONS.put(token, JSON.stringify({ email, role: 'super-admin' }), {
      expirationTtl: 86400,
    })

    return c.json({
      success: true,
      token,
      user: { email, role: 'super-admin' },
    })
  }

  throw new HTTPException(401, { message: 'Invalid credentials' })
})

app.post('/auth/logout', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (token) {
    await c.env.SESSIONS.delete(token)
  }
  return c.json({ success: true })
})

// ============ Tenants Endpoints ============
app.get('/tenants', async (c) => {
  const cached = await c.env.CACHE.get('tenants')
  if (cached) {
    return c.json(JSON.parse(cached))
  }

  await c.env.CACHE.put('tenants', JSON.stringify(mockTenants), { expirationTtl: 3600 })
  return c.json(mockTenants)
})

app.post('/tenants', async (c) => {
  const tenant = await c.req.json()
  const newTenant = {
    id: Date.now().toString(),
    ...tenant,
    createdAt: new Date().toISOString(),
    modules: [],
  }

  mockTenants.push(newTenant)
  await c.env.CACHE.delete('tenants')

  return c.json(newTenant, 201)
})

app.get('/tenants/:id', async (c) => {
  const id = c.req.param('id')
  const tenant = mockTenants.find((t) => t.id === id)

  if (!tenant) {
    throw new HTTPException(404, { message: 'Tenant not found' })
  }

  return c.json(tenant)
})

app.put('/tenants/:id', async (c) => {
  const id = c.req.param('id')
  const updates = await c.req.json()
  const index = mockTenants.findIndex((t) => t.id === id)

  if (index === -1) {
    throw new HTTPException(404, { message: 'Tenant not found' })
  }

  mockTenants[index] = { ...mockTenants[index], ...updates }
  await c.env.CACHE.delete('tenants')

  return c.json(mockTenants[index])
})

app.delete('/tenants/:id', async (c) => {
  const id = c.req.param('id')
  const index = mockTenants.findIndex((t) => t.id === id)

  if (index === -1) {
    throw new HTTPException(404, { message: 'Tenant not found' })
  }

  mockTenants.splice(index, 1)
  await c.env.CACHE.delete('tenants')

  return c.json({ success: true })
})

// ============ Billing Endpoints ============
app.get('/billing/metrics', async (c) => {
  return c.json({
    mtd: 45000,
    ytd: 320000,
    yearEnd: 500000,
    activeSubscriptions: 12,
    churnRate: 2.5,
  })
})

app.get('/billing/ledger', async (c) => {
  const limit = c.req.query('limit') || '50'
  const offset = c.req.query('offset') || '0'

  const ledger = [
    { id: '1', date: '2024-03-15', description: 'Subscription', amount: 5000, type: 'credit' },
    { id: '2', date: '2024-03-14', description: 'Refund', amount: 500, type: 'debit' },
    { id: '3', date: '2024-03-13', description: 'Subscription', amount: 5000, type: 'credit' },
  ]

  return c.json({
    data: ledger.slice(parseInt(offset), parseInt(offset) + parseInt(limit)),
    total: ledger.length,
    limit: parseInt(limit),
    offset: parseInt(offset),
  })
})

app.get('/billing/commissions', async (c) => {
  return c.json({
    total: 125000,
    pending: 25000,
    paid: 100000,
    splits: [
      { partner: 'Partner A', percentage: 30, amount: 37500 },
      { partner: 'Partner B', percentage: 20, amount: 25000 },
      { partner: 'Platform', percentage: 50, amount: 62500 },
    ],
  })
})

// ============ Modules Endpoints ============
app.get('/modules', async (c) => {
  const cached = await c.env.CACHE.get('modules')
  if (cached) {
    return c.json(JSON.parse(cached))
  }

  await c.env.CACHE.put('modules', JSON.stringify(mockModules), { expirationTtl: 3600 })
  return c.json(mockModules)
})

app.post('/modules/:id/enable', async (c) => {
  const id = c.req.param('id')
  const module = mockModules.find((m) => m.id === id)

  if (!module) {
    throw new HTTPException(404, { message: 'Module not found' })
  }

  module.enabled = true
  await c.env.CACHE.delete('modules')

  return c.json(module)
})

app.post('/modules/:id/disable', async (c) => {
  const id = c.req.param('id')
  const module = mockModules.find((m) => m.id === id)

  if (!module) {
    throw new HTTPException(404, { message: 'Module not found' })
  }

  module.enabled = false
  await c.env.CACHE.delete('modules')

  return c.json(module)
})

// ============ Health Monitoring Endpoints ============
app.get('/health/status', async (c) => {
  return c.json({
    services: {
      api: { status: 'healthy', uptime: 99.9, responseTime: 45 },
      database: { status: 'healthy', uptime: 99.95, responseTime: 120 },
      cache: { status: 'healthy', uptime: 99.8, responseTime: 15 },
      queue: { status: 'healthy', uptime: 99.7, responseTime: 30 },
    },
    overall: 'healthy',
  })
})

app.get('/health/metrics', async (c) => {
  const hours = c.req.query('hours') || '24'

  return c.json({
    cpu: Array.from({ length: parseInt(hours) }, (_, i) => ({
      time: new Date(Date.now() - (parseInt(hours) - i) * 3600000).toISOString(),
      usage: Math.random() * 60 + 20,
    })),
    memory: Array.from({ length: parseInt(hours) }, (_, i) => ({
      time: new Date(Date.now() - (parseInt(hours) - i) * 3600000).toISOString(),
      usage: Math.random() * 50 + 30,
    })),
  })
})

app.get('/health/alerts', async (c) => {
  return c.json([
    { id: '1', severity: 'info', message: 'Scheduled maintenance completed', timestamp: new Date().toISOString() },
    { id: '2', severity: 'warning', message: 'High memory usage detected', timestamp: new Date(Date.now() - 3600000).toISOString() },
  ])
})

// ============ Settings Endpoints ============
app.get('/settings', async (c) => {
  return c.json({
    apiRateLimit: 1000,
    sessionTimeout: 3600,
    maintenanceMode: false,
    maxTenants: 100,
  })
})

app.put('/settings', async (c) => {
  const settings = await c.req.json()
  // In production, save to database
  return c.json({ success: true, settings })
})

app.get('/settings/api-keys', async (c) => {
  return c.json([
    { id: '1', name: 'Production Key', created: '2024-01-15', lastUsed: '2024-03-15', active: true },
    { id: '2', name: 'Staging Key', created: '2024-02-01', lastUsed: '2024-03-14', active: true },
  ])
})

app.post('/settings/api-keys', async (c) => {
  const { name } = await c.req.json()
  const newKey = {
    id: Date.now().toString(),
    name,
    created: new Date().toISOString(),
    lastUsed: null,
    active: true,
    key: 'sk_' + Math.random().toString(36).substr(2, 32),
  }

  return c.json(newKey, 201)
})

app.delete('/settings/api-keys/:id', async (c) => {
  const id = c.req.param('id')
  // In production, delete from database
  return c.json({ success: true, id })
})

app.get('/settings/audit-log', async (c) => {
  const limit = c.req.query('limit') || '50'
  const offset = c.req.query('offset') || '0'

  const logs = [
    { id: '1', user: 'admin@webwaka.com', action: 'Login', resource: 'Auth', timestamp: new Date().toISOString() },
    { id: '2', user: 'admin@webwaka.com', action: 'Create', resource: 'Tenant', timestamp: new Date(Date.now() - 3600000).toISOString() },
  ]

  return c.json({
    data: logs.slice(parseInt(offset), parseInt(offset) + parseInt(limit)),
    total: logs.length,
  })
})

// ============ Error Handlers ============
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

app.onError((err, c) => {
  console.error(err)
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  return c.json({ error: 'Internal Server Error' }, 500)
})

export default app
