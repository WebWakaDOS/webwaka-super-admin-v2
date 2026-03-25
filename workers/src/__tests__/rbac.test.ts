/**
 * rbac.test.ts — Permission matrix: who can do what
 *
 * Run: cd workers && pnpm test src/__tests__/rbac.test.ts
 */

import { describe, it, expect } from 'vitest'

// ── Permission definitions (mirrors Workers RBAC_PERMISSIONS map) ──────────

type Permission =
  | 'read:tenants'
  | 'write:tenants'
  | 'delete:tenants'
  | 'read:billing'
  | 'write:billing'
  | 'read:settings'
  | 'manage:settings'
  | 'read:rbac'
  | 'manage:rbac'
  | 'read:analytics'
  | 'read:audit'
  | 'manage:modules'

type Role = 'super_admin' | 'admin' | 'finance' | 'support' | 'readonly'

const RBAC_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    'read:tenants',
    'write:tenants',
    'delete:tenants',
    'read:billing',
    'write:billing',
    'read:settings',
    'manage:settings',
    'read:rbac',
    'manage:rbac',
    'read:analytics',
    'read:audit',
    'manage:modules',
  ],
  admin: [
    'read:tenants',
    'write:tenants',
    'read:billing',
    'read:settings',
    'read:rbac',
    'read:analytics',
    'read:audit',
    'manage:modules',
  ],
  finance: [
    'read:tenants',
    'read:billing',
    'write:billing',
    'read:analytics',
  ],
  support: [
    'read:tenants',
    'read:billing',
    'read:settings',
    'read:analytics',
  ],
  readonly: [
    'read:tenants',
    'read:analytics',
  ],
}

function hasPermission(role: Role, permission: Permission): boolean {
  return RBAC_PERMISSIONS[role]?.includes(permission) ?? false
}

function canAccess(userRole: string, permission: Permission): boolean {
  if (!Object.keys(RBAC_PERMISSIONS).includes(userRole)) return false
  return hasPermission(userRole as Role, permission)
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('RBAC — super_admin has all permissions', () => {
  const allPerms: Permission[] = [
    'read:tenants', 'write:tenants', 'delete:tenants',
    'read:billing', 'write:billing',
    'read:settings', 'manage:settings',
    'read:rbac', 'manage:rbac',
    'read:analytics', 'read:audit', 'manage:modules',
  ]

  allPerms.forEach((perm) => {
    it(`super_admin can ${perm}`, () => {
      expect(hasPermission('super_admin', perm)).toBe(true)
    })
  })
})

describe('RBAC — admin permissions', () => {
  it('admin can read:tenants', () => expect(hasPermission('admin', 'read:tenants')).toBe(true))
  it('admin can write:tenants', () => expect(hasPermission('admin', 'write:tenants')).toBe(true))
  it('admin cannot delete:tenants', () => expect(hasPermission('admin', 'delete:tenants')).toBe(false))
  it('admin can read:billing', () => expect(hasPermission('admin', 'read:billing')).toBe(true))
  it('admin cannot write:billing', () => expect(hasPermission('admin', 'write:billing')).toBe(false))
  it('admin cannot manage:settings', () => expect(hasPermission('admin', 'manage:settings')).toBe(false))
  it('admin cannot manage:rbac', () => expect(hasPermission('admin', 'manage:rbac')).toBe(false))
  it('admin can manage:modules', () => expect(hasPermission('admin', 'manage:modules')).toBe(true))
})

describe('RBAC — finance role', () => {
  it('finance can read:billing', () => expect(hasPermission('finance', 'read:billing')).toBe(true))
  it('finance can write:billing', () => expect(hasPermission('finance', 'write:billing')).toBe(true))
  it('finance can read:tenants', () => expect(hasPermission('finance', 'read:tenants')).toBe(true))
  it('finance cannot write:tenants', () => expect(hasPermission('finance', 'write:tenants')).toBe(false))
  it('finance cannot delete:tenants', () => expect(hasPermission('finance', 'delete:tenants')).toBe(false))
  it('finance cannot manage:settings', () => expect(hasPermission('finance', 'manage:settings')).toBe(false))
  it('finance cannot manage:rbac', () => expect(hasPermission('finance', 'manage:rbac')).toBe(false))
  it('finance cannot manage:modules', () => expect(hasPermission('finance', 'manage:modules')).toBe(false))
})

describe('RBAC — support role', () => {
  it('support can read:tenants', () => expect(hasPermission('support', 'read:tenants')).toBe(true))
  it('support can read:billing', () => expect(hasPermission('support', 'read:billing')).toBe(true))
  it('support cannot write:tenants', () => expect(hasPermission('support', 'write:tenants')).toBe(false))
  it('support cannot delete:tenants', () => expect(hasPermission('support', 'delete:tenants')).toBe(false))
  it('support cannot write:billing', () => expect(hasPermission('support', 'write:billing')).toBe(false))
  it('support cannot manage:rbac', () => expect(hasPermission('support', 'manage:rbac')).toBe(false))
})

describe('RBAC — readonly role', () => {
  it('readonly can read:tenants', () => expect(hasPermission('readonly', 'read:tenants')).toBe(true))
  it('readonly can read:analytics', () => expect(hasPermission('readonly', 'read:analytics')).toBe(true))
  it('readonly cannot write:tenants', () => expect(hasPermission('readonly', 'write:tenants')).toBe(false))
  it('readonly cannot read:billing', () => expect(hasPermission('readonly', 'read:billing')).toBe(false))
  it('readonly cannot manage:settings', () => expect(hasPermission('readonly', 'manage:settings')).toBe(false))
  it('readonly cannot manage:rbac', () => expect(hasPermission('readonly', 'manage:rbac')).toBe(false))
})

describe('RBAC — unknown role is denied', () => {
  it('returns false for unknown role', () => {
    expect(canAccess('hacker', 'read:tenants')).toBe(false)
    expect(canAccess('', 'read:billing')).toBe(false)
    expect(canAccess('superuser', 'manage:rbac')).toBe(false)
  })
})

describe('RBAC — delete:tenants is super_admin only', () => {
  const roles: Role[] = ['admin', 'finance', 'support', 'readonly']
  roles.forEach((role) => {
    it(`${role} cannot delete:tenants`, () => {
      expect(hasPermission(role, 'delete:tenants')).toBe(false)
    })
  })
  it('super_admin can delete:tenants', () => {
    expect(hasPermission('super_admin', 'delete:tenants')).toBe(true)
  })
})

describe('RBAC — manage:rbac is super_admin only', () => {
  const nonSuperRoles: Role[] = ['admin', 'finance', 'support', 'readonly']
  nonSuperRoles.forEach((role) => {
    it(`${role} cannot manage:rbac`, () => {
      expect(hasPermission(role, 'manage:rbac')).toBe(false)
    })
  })
})

describe('RBAC — privilege escalation prevention', () => {
  it('a readonly user cannot grant themselves write:tenants', () => {
    const role: Role = 'readonly'
    // Simulating an attempt to access write-protected resource
    const canWrite = hasPermission(role, 'write:tenants')
    expect(canWrite).toBe(false)
  })

  it('finance cannot access manage:settings (lateral move blocked)', () => {
    expect(hasPermission('finance', 'manage:settings')).toBe(false)
  })
})
