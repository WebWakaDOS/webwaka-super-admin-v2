/**
 * Local development seed script
 * Seeds the local Wrangler D1 databases with test data.
 *
 * Usage:
 *   cd workers
 *   wrangler d1 execute rbac_staging --local --file=scripts/seed-local.ts
 *   OR run each SQL block directly:
 *   node -e "require('./scripts/seed-local.ts')"
 *
 * Requires: wrangler dev running with --local flag
 */

// ── RBAC DB seed ──────────────────────────────────────────────────────────────
const RBAC_SEED = `
-- Default roles
INSERT OR IGNORE INTO roles (id, name, description, created_at) VALUES
  ('role_superadmin', 'SUPERADMIN', 'Full platform access', CURRENT_TIMESTAMP),
  ('role_partner',    'PARTNER',    'Partner-level access', CURRENT_TIMESTAMP),
  ('role_support',    'SUPPORT',    'Read-only support access', CURRENT_TIMESTAMP);

-- Default permissions
INSERT OR IGNORE INTO permissions (id, name, description, created_at) VALUES
  ('perm_read_all',       'read:all',        'Read all resources',         CURRENT_TIMESTAMP),
  ('perm_write_tenants',  'write:tenants',   'Create/update tenants',      CURRENT_TIMESTAMP),
  ('perm_read_billing',   'read:billing',    'Read billing data',          CURRENT_TIMESTAMP),
  ('perm_manage_settings','manage:settings', 'Manage platform settings',   CURRENT_TIMESTAMP),
  ('perm_read_settings',  'read:settings',   'Read platform settings',     CURRENT_TIMESTAMP),
  ('perm_manage_modules', 'manage:modules',  'Enable/disable modules',     CURRENT_TIMESTAMP),
  ('perm_manage_partners','manage:partners', 'Manage partners',            CURRENT_TIMESTAMP),
  ('perm_view_operations','view:operations', 'View operations metrics',    CURRENT_TIMESTAMP),
  ('perm_view_health',    'view:health',     'View system health',         CURRENT_TIMESTAMP),
  ('perm_manage_tenants', 'manage:tenants',  'Full tenant management',     CURRENT_TIMESTAMP),
  ('perm_manage_deploys', 'manage:deployments', 'Manage deployments',      CURRENT_TIMESTAMP),
  ('perm_view_billing',   'view:billing',    'View billing summaries',     CURRENT_TIMESTAMP);

-- Super admin user (password: SuperAdmin123!)
-- Hash generated with bcrypt cost 12: $2a$12$dummyHashForDevSeedOnly
INSERT OR IGNORE INTO users (id, email, first_name, last_name, password_hash, tenant_id, created_at) VALUES
  ('user_superadmin_001',
   'admin@webwaka.dev',
   'Super',
   'Admin',
   '\$2a\$12\$K8GpDtEzZ4Vmf5XHbJmv5eD4P9nEzWqY6I2gY8K5X1vKj3rZ4uGDS',
   'super-admin',
   CURRENT_TIMESTAMP);

-- Assign superadmin role
INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES
  ('user_superadmin_001', 'role_superadmin');

-- Assign all permissions to superadmin role
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 'role_superadmin', id FROM permissions;

-- Audit log entry
INSERT OR IGNORE INTO audit_log (id, user_id, action, resource_type, resource_id, ip_address, created_at) VALUES
  ('audit_seed_001', 'user_superadmin_001', 'SEED', 'DATABASE', 'rbac_staging', '127.0.0.1', CURRENT_TIMESTAMP);
`;

// ── TENANTS DB seed ───────────────────────────────────────────────────────────
const TENANTS_SEED = `
INSERT OR IGNORE INTO tenants (id, name, email, status, tier, created_at) VALUES
  ('tenant_001', 'Acme Corp',       'admin@acme.example',   'ACTIVE',       'PROFESSIONAL', CURRENT_TIMESTAMP),
  ('tenant_002', 'Beta Tech Ltd',   'admin@betatech.example','ACTIVE',      'STARTER',      CURRENT_TIMESTAMP),
  ('tenant_003', 'Gamma Solutions', 'info@gamma.example',   'SUSPENDED',    'ENTERPRISE',   CURRENT_TIMESTAMP),
  ('tenant_004', 'Delta Services',  'ops@delta.example',    'PROVISIONING', 'STARTER',      CURRENT_TIMESTAMP);
`;

// ── BILLING DB seed ───────────────────────────────────────────────────────────
const BILLING_SEED = `
INSERT OR IGNORE INTO billing_plans (id, name, monthly_fee_kobo, status, created_at) VALUES
  ('plan_starter',      'Starter',      500000,   'ACTIVE', CURRENT_TIMESTAMP),
  ('plan_professional', 'Professional', 2000000,  'ACTIVE', CURRENT_TIMESTAMP),
  ('plan_enterprise',   'Enterprise',   10000000, 'ACTIVE', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO ledger_entries (id, tenant_id, entry_type, amount_kobo, description, created_at) VALUES
  ('ledger_001', 'tenant_001', 'REVENUE',    2000000, 'Monthly subscription - Professional', CURRENT_TIMESTAMP),
  ('ledger_002', 'tenant_002', 'REVENUE',     500000, 'Monthly subscription - Starter',      CURRENT_TIMESTAMP),
  ('ledger_003', 'tenant_001', 'COMMISSION',  200000, 'Commission - L1 partner',             CURRENT_TIMESTAMP);
`;

// ── HEALTH DB seed ────────────────────────────────────────────────────────────
const HEALTH_SEED = `
INSERT OR IGNORE INTO service_health (id, service_name, status, uptime_percent, response_time_ms, last_check_at) VALUES
  ('svc_api',      'API Gateway',   'HEALTHY',  99.98, 45,  CURRENT_TIMESTAMP),
  ('svc_db',       'Database',      'HEALTHY',  99.95, 12,  CURRENT_TIMESTAMP),
  ('svc_kv',       'KV Store',      'HEALTHY',  99.99, 5,   CURRENT_TIMESTAMP),
  ('svc_auth',     'Auth Service',  'HEALTHY',  99.97, 30,  CURRENT_TIMESTAMP),
  ('svc_billing',  'Billing',       'DEGRADED', 98.50, 450, CURRENT_TIMESTAMP);
`;

// Export for direct use
console.log('=== RBAC DB ===');
console.log(RBAC_SEED);
console.log('\n=== TENANTS DB ===');
console.log(TENANTS_SEED);
console.log('\n=== BILLING DB ===');
console.log(BILLING_SEED);
console.log('\n=== HEALTH DB ===');
console.log(HEALTH_SEED);
console.log('\n--- Apply with wrangler: ---');
console.log('wrangler d1 execute rbac_staging    --local --command "..."');
console.log('wrangler d1 execute tenants_staging --local --command "..."');
console.log('wrangler d1 execute billing_staging --local --command "..."');
console.log('wrangler d1 execute health_staging  --local --command "..."');
