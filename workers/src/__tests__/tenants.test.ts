/**
 * tenants.test.ts — Tenant CRUD, soft-delete, pagination
 *
 * Run: cd workers && pnpm test src/__tests__/tenants.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

// ── Schemas ────────────────────────────────────────────────────────────────

const TenantCreateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  email: z.string().email('Valid email address is required'),
  industry: z.string().min(1, 'industry is required'),
  domain: z.string().optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional().default('starter'),
})

const TenantUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  industry: z.string().optional(),
  domain: z.string().optional(),
  status: z.enum(['active', 'suspended', 'provisioning']).optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
})

// ── Tenant data types ──────────────────────────────────────────────────────

interface Tenant {
  id: string
  name: string
  email: string
  industry: string
  domain?: string
  status: 'active' | 'suspended' | 'provisioning'
  plan: 'starter' | 'professional' | 'enterprise'
  created_at: string
  deleted_at?: string | null
}

// ── In-memory D1-like store for testing ───────────────────────────────────

class MockTenantDB {
  private rows: Tenant[] = []
  private idCounter = 1

  insert(data: Omit<Tenant, 'id' | 'created_at' | 'deleted_at'>): Tenant {
    const tenant: Tenant = {
      id: `tenant_${String(this.idCounter++).padStart(4, '0')}`,
      created_at: new Date().toISOString(),
      deleted_at: null,
      ...data,
    }
    this.rows.push(tenant)
    return tenant
  }

  findById(id: string): Tenant | undefined {
    return this.rows.find((t) => t.id === id && !t.deleted_at)
  }

  findAll(opts: { page?: number; pageSize?: number; status?: string } = {}): {
    tenants: Tenant[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  } {
    const { page = 1, pageSize = 10, status } = opts
    let filtered = this.rows.filter((t) => !t.deleted_at)
    if (status) filtered = filtered.filter((t) => t.status === status)
    const total = filtered.length
    const totalPages = Math.ceil(total / pageSize)
    const tenants = filtered.slice((page - 1) * pageSize, page * pageSize)
    return { tenants, total, page, pageSize, totalPages }
  }

  update(id: string, patch: Partial<Tenant>): Tenant | null {
    const idx = this.rows.findIndex((t) => t.id === id && !t.deleted_at)
    if (idx === -1) return null
    this.rows[idx] = { ...this.rows[idx], ...patch }
    return this.rows[idx]
  }

  softDelete(id: string): boolean {
    const idx = this.rows.findIndex((t) => t.id === id && !t.deleted_at)
    if (idx === -1) return false
    this.rows[idx].deleted_at = new Date().toISOString()
    this.rows[idx].status = 'suspended'
    return true
  }

  hardCount(): number {
    return this.rows.length // includes soft-deleted
  }

  softCount(): number {
    return this.rows.filter((t) => !t.deleted_at).length
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('TenantCreateSchema — validation', () => {
  it('accepts a valid tenant payload', () => {
    const r = TenantCreateSchema.safeParse({
      name: 'Acme Corp',
      email: 'admin@acme.ng',
      industry: 'fintech',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.plan).toBe('starter') // default
  })

  it('rejects missing name', () => {
    const r = TenantCreateSchema.safeParse({ email: 'a@b.ng', industry: 'retail' })
    expect(r.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const r = TenantCreateSchema.safeParse({ name: 'Test', email: 'bad', industry: 'tech' })
    expect(r.success).toBe(false)
  })

  it('rejects missing industry', () => {
    const r = TenantCreateSchema.safeParse({ name: 'Test', email: 'a@b.ng' })
    expect(r.success).toBe(false)
  })

  it('accepts optional domain', () => {
    const r = TenantCreateSchema.safeParse({
      name: 'Lagos Co',
      email: 'admin@lagos.co',
      industry: 'logistics',
      domain: 'lagos.co',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.domain).toBe('lagos.co')
  })
})

describe('TenantUpdateSchema — partial validation', () => {
  it('accepts partial update (name only)', () => {
    const r = TenantUpdateSchema.safeParse({ name: 'New Name' })
    expect(r.success).toBe(true)
  })

  it('accepts status: suspended', () => {
    const r = TenantUpdateSchema.safeParse({ status: 'suspended' })
    expect(r.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const r = TenantUpdateSchema.safeParse({ status: 'DELETED' })
    expect(r.success).toBe(false)
  })

  it('accepts empty object (no-op update)', () => {
    const r = TenantUpdateSchema.safeParse({})
    expect(r.success).toBe(true)
  })
})

describe('MockTenantDB — CRUD operations', () => {
  let db: MockTenantDB

  beforeEach(() => {
    db = new MockTenantDB()
  })

  it('inserts a tenant and returns it with generated ID', () => {
    const t = db.insert({ name: 'Alpha', email: 'a@alpha.ng', industry: 'tech', status: 'provisioning', plan: 'starter' })
    expect(t.id).toMatch(/^tenant_/)
    expect(t.name).toBe('Alpha')
    expect(t.status).toBe('provisioning')
    expect(t.deleted_at).toBeNull()
  })

  it('finds tenant by ID', () => {
    const t = db.insert({ name: 'Beta', email: 'b@beta.ng', industry: 'retail', status: 'active', plan: 'professional' })
    const found = db.findById(t.id)
    expect(found?.name).toBe('Beta')
  })

  it('returns undefined for unknown ID', () => {
    expect(db.findById('tenant_9999')).toBeUndefined()
  })

  it('updates tenant fields', () => {
    const t = db.insert({ name: 'Gamma', email: 'g@g.ng', industry: 'health', status: 'provisioning', plan: 'starter' })
    const updated = db.update(t.id, { status: 'active', name: 'Gamma Corp' })
    expect(updated?.status).toBe('active')
    expect(updated?.name).toBe('Gamma Corp')
  })

  it('returns null when updating non-existent tenant', () => {
    const result = db.update('tenant_9999', { status: 'active' })
    expect(result).toBeNull()
  })
})

describe('Soft-delete invariant', () => {
  let db: MockTenantDB

  beforeEach(() => {
    db = new MockTenantDB()
  })

  it('soft-deletes a tenant (sets deleted_at, status=suspended)', () => {
    const t = db.insert({ name: 'ToDelete', email: 'd@d.ng', industry: 'tech', status: 'active', plan: 'starter' })
    const ok = db.softDelete(t.id)
    expect(ok).toBe(true)

    // Not visible in soft-count
    expect(db.softCount()).toBe(0)
    // Still in raw store
    expect(db.hardCount()).toBe(1)
    // Not findable by ID
    expect(db.findById(t.id)).toBeUndefined()
  })

  it('returns false when soft-deleting a non-existent tenant', () => {
    expect(db.softDelete('tenant_9999')).toBe(false)
  })

  it('excludes soft-deleted tenants from findAll', () => {
    db.insert({ name: 'A', email: 'a@a.ng', industry: 'tech', status: 'active', plan: 'starter' })
    const t = db.insert({ name: 'B', email: 'b@b.ng', industry: 'tech', status: 'active', plan: 'starter' })
    db.softDelete(t.id)

    const { tenants, total } = db.findAll()
    expect(tenants).toHaveLength(1)
    expect(total).toBe(1)
    expect(tenants[0].name).toBe('A')
  })
})

describe('Pagination logic', () => {
  let db: MockTenantDB

  beforeEach(() => {
    db = new MockTenantDB()
    // Insert 25 tenants
    for (let i = 1; i <= 25; i++) {
      db.insert({
        name: `Tenant ${i}`,
        email: `tenant${i}@webwaka.ng`,
        industry: 'fintech',
        status: i % 3 === 0 ? 'suspended' : 'active',
        plan: 'starter',
      })
    }
  })

  it('returns first page of 10', () => {
    const { tenants, total, page, totalPages } = db.findAll({ page: 1, pageSize: 10 })
    expect(tenants).toHaveLength(10)
    expect(total).toBe(25)
    expect(page).toBe(1)
    expect(totalPages).toBe(3)
  })

  it('returns last page with remaining items', () => {
    const { tenants, total } = db.findAll({ page: 3, pageSize: 10 })
    expect(tenants).toHaveLength(5) // 25 - 20 = 5 remaining
    expect(total).toBe(25)
  })

  it('returns second page correctly', () => {
    const page1 = db.findAll({ page: 1, pageSize: 10 })
    const page2 = db.findAll({ page: 2, pageSize: 10 })
    const page1Ids = new Set(page1.tenants.map((t) => t.id))
    page2.tenants.forEach((t) => {
      expect(page1Ids.has(t.id)).toBe(false)
    })
  })

  it('filters by status before paginating', () => {
    const { tenants, total } = db.findAll({ status: 'suspended' })
    // Every 3rd tenant (i=3,6,9,...,24) = 8 tenants
    expect(total).toBe(8)
    tenants.forEach((t) => expect(t.status).toBe('suspended'))
  })

  it('returns empty array for out-of-range page', () => {
    const { tenants } = db.findAll({ page: 100, pageSize: 10 })
    expect(tenants).toHaveLength(0)
  })
})
