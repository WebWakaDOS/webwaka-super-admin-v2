-- Migration 011: Performance indexes for high-traffic queries
-- Covers: partner_suite_assignments, operations_metrics, ledger_entries, alerts, and more
-- Run: wrangler d1 execute webwaka-tenant-db --file=migrations/011_indexes.sql

-- ============================================================
-- TENANT DB
-- ============================================================

-- tenants: status + plan lookups (list/filter)
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC);

-- partner_suite_assignments: suite + status (join queries)
CREATE INDEX IF NOT EXISTS idx_psa_suite ON partner_suite_assignments(suite);
CREATE INDEX IF NOT EXISTS idx_psa_status ON partner_suite_assignments(status);
CREATE INDEX IF NOT EXISTS idx_psa_partner_id ON partner_suite_assignments(partner_id);
CREATE INDEX IF NOT EXISTS idx_psa_suite_status ON partner_suite_assignments(suite, status);

-- partners: status + tier filtering
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_tier ON partners(tier);
CREATE INDEX IF NOT EXISTS idx_partners_email ON partners(email);

-- tenant_modules: tenant lookups
CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant ON tenant_modules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_modules_module ON tenant_modules(module_id);

-- ============================================================
-- BILLING DB
-- ============================================================

-- ledger_entries: tenant + date range queries
CREATE INDEX IF NOT EXISTS idx_ledger_tenant_id ON ledger_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger_entries(type);
CREATE INDEX IF NOT EXISTS idx_ledger_tenant_date ON ledger_entries(tenant_id, created_at DESC);

-- commissions: partner + status
CREATE INDEX IF NOT EXISTS idx_commissions_partner_id ON commissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_period ON commissions(billing_period);

-- subscriptions: tenant + status
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================================
-- HEALTH DB
-- ============================================================

-- operations_metrics: metric_date + tenant_id (time-series queries)
CREATE INDEX IF NOT EXISTS idx_ops_metrics_date ON operations_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_ops_metrics_tenant ON operations_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ops_metrics_suite ON operations_metrics(suite);
CREATE INDEX IF NOT EXISTS idx_ops_metrics_date_tenant ON operations_metrics(metric_date DESC, tenant_id);

-- alerts: severity + created_at (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_service ON alerts(service);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_id ON alerts(tenant_id);

-- service_health: service + recorded_at (health dashboard)
CREATE INDEX IF NOT EXISTS idx_service_health_service ON service_health(service_name);
CREATE INDEX IF NOT EXISTS idx_service_health_recorded ON service_health(recorded_at DESC);

-- ============================================================
-- RBAC DB
-- ============================================================

-- audit_log: action + user + created_at (audit log queries)
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type ON audit_log(resource_type);

-- super_admin_users: email lookup (auth)
CREATE INDEX IF NOT EXISTS idx_super_admin_email ON super_admin_users(email);
CREATE INDEX IF NOT EXISTS idx_super_admin_role ON super_admin_users(role);
