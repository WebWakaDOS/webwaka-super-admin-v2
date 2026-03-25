#!/usr/bin/env node
/**
 * seed-local.mjs — Seed all local Wrangler D1 databases for development
 *
 * Usage:
 *   node workers/scripts/seed-local.mjs
 *
 * Or via wrangler (execute individual SQL files):
 *   wrangler d1 execute RBAC_DB --local --file=workers/migrations/seed/rbac.sql
 *   wrangler d1 execute TENANTS_DB --local --file=workers/migrations/seed/tenants.sql
 *   wrangler d1 execute BILLING_DB --local --file=workers/migrations/seed/billing.sql
 *   wrangler d1 execute HEALTH_DB --local --file=workers/migrations/seed/health.sql
 *
 * Pre-requisite: wrangler dev must have been run at least once to create the local DBs.
 *
 * Nigeria First invariants:
 *   - All monetary values are in kobo (integer, 1 NGN = 100 kobo)
 *   - Partner NDPR consent required (ndpr_consent = 1)
 *   - Locale: en-NG
 */

import { execSync } from 'child_process'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')
const SEED_DIR = join(__dirname, '../migrations/seed')

// Ensure seed directory exists
mkdirSync(SEED_DIR, { recursive: true })

// ── Helper ────────────────────────────────────────────────────────────────

function wranglerExec(db, sqlFile) {
  const cmd = `wrangler d1 execute ${db} --local --file=${sqlFile} --cwd=${ROOT}/workers`
  console.log(`  ▶ ${cmd}`)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT })
    console.log(`  ✓ ${db} seeded from ${sqlFile}`)
  } catch (err) {
    console.warn(`  ⚠ ${db} seed failed (may be normal if tables don't exist yet): ${err.message}`)
  }
}

// ── RBAC DB seed ──────────────────────────────────────────────────────────

const rbacSQL = `
-- Clear existing seed data
DELETE FROM users WHERE email LIKE '%@webwaka.dev';
DELETE FROM roles WHERE name IN ('super_admin','admin','finance','support','readonly');
DELETE FROM audit_log WHERE user_id = 'seed';

-- Roles
INSERT OR IGNORE INTO roles (id, name, permissions, created_at) VALUES
  ('role_super', 'super_admin', '["read:tenants","write:tenants","delete:tenants","read:billing","write:billing","read:settings","manage:settings","read:rbac","manage:rbac","read:analytics","read:audit","manage:modules"]', datetime('now')),
  ('role_admin', 'admin', '["read:tenants","write:tenants","read:billing","read:settings","read:rbac","read:analytics","read:audit","manage:modules"]', datetime('now')),
  ('role_finance', 'finance', '["read:tenants","read:billing","write:billing","read:analytics"]', datetime('now')),
  ('role_support', 'support', '["read:tenants","read:billing","read:settings","read:analytics"]', datetime('now')),
  ('role_readonly', 'readonly', '["read:tenants","read:analytics"]', datetime('now'));

-- Seed admin users (passwords hashed with bcryptjs rounds=10)
-- Password for all seed users: WebWaka@2025!
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, tenant_id, created_at) VALUES
  ('user_super_01', 'superadmin@webwaka.dev', '$2b$10$LqD.2pGC4b1sMqh8zHmOUuUbkFi1qHxYy5MHmsmMPkiJ4YRQK8aDa', 'Super Admin', 'super_admin', NULL, datetime('now')),
  ('user_admin_01', 'admin@webwaka.dev', '$2b$10$LqD.2pGC4b1sMqh8zHmOUuUbkFi1qHxYy5MHmsmMPkiJ4YRQK8aDa', 'Platform Admin', 'admin', NULL, datetime('now')),
  ('user_fin_01', 'finance@webwaka.dev', '$2b$10$LqD.2pGC4b1sMqh8zHmOUuUbkFi1qHxYy5MHmsmMPkiJ4YRQK8aDa', 'Finance Manager', 'finance', NULL, datetime('now')),
  ('user_sup_01', 'support@webwaka.dev', '$2b$10$LqD.2pGC4b1sMqh8zHmOUuUbkFi1qHxYy5MHmsmMPkiJ4YRQK8aDa', 'Support Agent', 'support', NULL, datetime('now')),
  ('user_ro_01', 'readonly@webwaka.dev', '$2b$10$LqD.2pGC4b1sMqh8zHmOUuUbkFi1qHxYy5MHmsmMPkiJ4YRQK8aDa', 'Read Only User', 'readonly', NULL, datetime('now'));

-- Sample audit log entries
INSERT OR IGNORE INTO audit_log (id, user_id, action, resource_type, resource_id, ip_address, created_at) VALUES
  ('audit_seed_001', 'user_super_01', 'LOGIN', 'session', 'sess_001', '127.0.0.1', datetime('now', '-2 hours')),
  ('audit_seed_002', 'user_super_01', 'CREATE_TENANT', 'tenant', 'tenant_0001', '127.0.0.1', datetime('now', '-1 hours')),
  ('audit_seed_003', 'user_admin_01', 'LOGIN', 'session', 'sess_002', '127.0.0.1', datetime('now', '-30 minutes'));
`

// ── TENANTS DB seed ───────────────────────────────────────────────────────

const tenantsSQL = `
-- Clear existing seed data
DELETE FROM tenants WHERE id LIKE 'tenant_%';
DELETE FROM partners WHERE id LIKE 'partner_%';

-- 5 sample tenants across different plans / industries / statuses
INSERT OR IGNORE INTO tenants (id, name, email, industry, domain, status, plan, created_at) VALUES
  ('tenant_0001', 'Lagos Tech Hub', 'admin@lagostechhub.ng', 'technology', 'lagostechhub.ng', 'active', 'enterprise', datetime('now', '-90 days')),
  ('tenant_0002', 'Kano Commerce Ltd', 'admin@kanocommerce.ng', 'retail', 'kanocommerce.ng', 'active', 'professional', datetime('now', '-60 days')),
  ('tenant_0003', 'Abuja FinServ', 'admin@abujafinserv.ng', 'fintech', NULL, 'active', 'starter', datetime('now', '-30 days')),
  ('tenant_0004', 'Port Harcourt Logistics', 'admin@phlogistics.ng', 'logistics', 'phlogistics.ng', 'suspended', 'professional', datetime('now', '-45 days')),
  ('tenant_0005', 'Enugu EduTech', 'admin@enuguedtech.ng', 'education', NULL, 'provisioning', 'starter', datetime('now', '-1 days'));

-- 3 sample partners
INSERT OR IGNORE INTO partners (id, name, email, phone, company, status, tier, commission_rate_percent, assigned_suites, ndpr_consent, monthly_fee_kobo, created_at) VALUES
  ('partner_0001', 'Ahmed Resellers Ltd', 'ahmed@resellers.ng', '+234-803-000-0001', 'Ahmed Resellers Ltd', 'ACTIVE', 'ENTERPRISE', 15, '["civic","commerce","transport"]', 1, 50000000, datetime('now', '-80 days')),
  ('partner_0002', 'Chioma Digital Agency', 'chioma@digitalagency.ng', '+234-806-000-0002', 'Chioma Digital Agency', 'ACTIVE', 'PROFESSIONAL', 10, '["civic","fintech"]', 1, 20000000, datetime('now', '-45 days')),
  ('partner_0003', 'Emeka Tech Solutions', 'emeka@techsolutions.ng', '+234-809-000-0003', 'Emeka Tech Solutions', 'PENDING', 'STARTER', 5, '[]', 1, 5000000, datetime('now', '-5 days'));
`

// ── BILLING DB seed ───────────────────────────────────────────────────────

const billingSQL = `
-- Clear existing seed data
DELETE FROM billing_ledger WHERE id LIKE 'ledger_%';
DELETE FROM commissions WHERE id LIKE 'comm_%';

-- Billing ledger entries (all amounts in kobo — Nigeria First)
INSERT OR IGNORE INTO billing_ledger (id, tenant_id, entry_type, amount_kobo, description, status, created_at) VALUES
  ('ledger_000001', 'tenant_0001', 'REVENUE', 250000000, 'Monthly subscription - Enterprise plan Q1', 'completed', datetime('now', '-90 days')),
  ('ledger_000002', 'tenant_0001', 'REVENUE', 250000000, 'Monthly subscription - Enterprise plan Q2', 'completed', datetime('now', '-60 days')),
  ('ledger_000003', 'tenant_0002', 'REVENUE', 100000000, 'Monthly subscription - Professional plan Q1', 'completed', datetime('now', '-60 days')),
  ('ledger_000004', 'tenant_0002', 'REVENUE', 100000000, 'Monthly subscription - Professional plan Q2', 'completed', datetime('now', '-30 days')),
  ('ledger_000005', 'tenant_0003', 'REVENUE', 25000000, 'Monthly subscription - Starter plan', 'completed', datetime('now', '-30 days')),
  ('ledger_000006', 'tenant_0001', 'REFUND', -5000000, 'Prorated refund - service downtime', 'completed', datetime('now', '-20 days')),
  ('ledger_000007', 'tenant_0004', 'REVENUE', 100000000, 'Monthly subscription - Professional plan', 'pending', datetime('now', '-45 days'));

-- Commission records for partner_0001 (5-level MLM system)
INSERT OR IGNORE INTO commissions (id, partner_id, source_tenant_id, amount_kobo, level, rate_percent, status, created_at) VALUES
  ('comm_000001', 'partner_0001', 'tenant_0001', 37500000, 1, 15, 'paid', datetime('now', '-60 days')),
  ('comm_000002', 'partner_0001', 'tenant_0001', 37500000, 1, 15, 'paid', datetime('now', '-30 days')),
  ('comm_000003', 'partner_0002', 'tenant_0002', 10000000, 1, 10, 'pending', datetime('now', '-30 days')),
  -- Level 2 override from partner_0001 sponsoring partner_0002
  ('comm_000004', 'partner_0001', 'tenant_0002', 5000000, 2, 5, 'pending', datetime('now', '-30 days'));
`

// ── HEALTH DB seed ────────────────────────────────────────────────────────

const healthSQL = `
-- Clear existing seed data
DELETE FROM alerts WHERE id LIKE 'alert_%';
DELETE FROM service_health WHERE service_name IS NOT NULL;

-- Recent health alerts (mix of resolved and active)
INSERT OR IGNORE INTO alerts (id, alert_type, severity, message, resolved, created_at) VALUES
  ('alert_000001', 'HIGH_LATENCY', 'WARNING', 'API P99 latency > 2s on /tenants endpoint', 1, datetime('now', '-2 days')),
  ('alert_000002', 'D1_QUERY_SLOW', 'WARNING', 'Slow query on billing_ledger (no index on entry_type)', 1, datetime('now', '-1 days')),
  ('alert_000003', 'DISK_USAGE', 'INFO', 'D1 RBAC_DB approaching 80% of free tier limit', 0, datetime('now', '-4 hours')),
  ('alert_000004', 'AUTH_SPIKE', 'WARNING', 'Unusual login attempt spike from 41.58.x.x range', 0, datetime('now', '-1 hours'));

-- Service health records
INSERT OR IGNORE INTO service_health (service_name, status, uptime_percent, last_checked_at, created_at) VALUES
  ('Hono API Workers', 'healthy', 99.95, datetime('now', '-5 minutes'), datetime('now')),
  ('D1 RBAC Database', 'healthy', 100.00, datetime('now', '-5 minutes'), datetime('now')),
  ('D1 Tenants Database', 'healthy', 100.00, datetime('now', '-5 minutes'), datetime('now')),
  ('D1 Billing Database', 'healthy', 99.99, datetime('now', '-5 minutes'), datetime('now')),
  ('KV Sessions Store', 'healthy', 100.00, datetime('now', '-5 minutes'), datetime('now')),
  ('Cloudflare Pages CDN', 'healthy', 100.00, datetime('now', '-5 minutes'), datetime('now'));
`

// ── Write SQL files and execute ───────────────────────────────────────────

const seeds = [
  { db: 'RBAC_DB', file: 'rbac.sql', sql: rbacSQL },
  { db: 'TENANTS_DB', file: 'tenants.sql', sql: tenantsSQL },
  { db: 'BILLING_DB', file: 'billing.sql', sql: billingSQL },
  { db: 'HEALTH_DB', file: 'health.sql', sql: healthSQL },
]

console.log('\n🌱 WebWaka Super Admin V2 — Local D1 Seed\n')
console.log('Nigeria First: all amounts in kobo (1 NGN = 100 kobo)\n')

for (const { db, file, sql } of seeds) {
  const sqlPath = join(SEED_DIR, file)
  writeFileSync(sqlPath, sql.trim(), 'utf8')
  console.log(`\n📦 Seeding ${db}...`)
  wranglerExec(db, sqlPath)
}

console.log('\n✅ Seed complete!\n')
console.log('Default credentials (for local dev only):')
console.log('  superadmin@webwaka.dev / WebWaka@2025!')
console.log('  admin@webwaka.dev / WebWaka@2025!')
console.log('  finance@webwaka.dev / WebWaka@2025!')
console.log('\nTenants: 5 (3 active, 1 suspended, 1 provisioning)')
console.log('Partners: 3 (2 active, 1 pending)')
console.log('Billing entries: 7 ledger rows (all in kobo)')
console.log('Health alerts: 4 (2 resolved, 2 active)\n')
