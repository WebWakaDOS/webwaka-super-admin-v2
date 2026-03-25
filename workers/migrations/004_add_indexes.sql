-- Migration: 004_add_indexes
-- Adds performance indexes missing from earlier schema migrations.
-- These indexes cover the most common query patterns in the Workers API.

-- ── RBAC DB indexes ───────────────────────────────────────────────────────────
-- audit_log: most queries filter/sort by created_at and user_id
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);

-- users: login queries by email
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- user_roles: FK joins
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);

-- ── TENANTS DB indexes ────────────────────────────────────────────────────────
-- tenants: list queries filter by status and soft-delete
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants (status);
CREATE INDEX IF NOT EXISTS idx_tenants_deleted_at ON tenants (deleted_at);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants (created_at DESC);

-- ── BILLING DB indexes ────────────────────────────────────────────────────────
-- ledger_entries: aggregate queries by entry_type and date
CREATE INDEX IF NOT EXISTS idx_ledger_entries_entry_type ON ledger_entries (entry_type);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at ON ledger_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_id ON ledger_entries (tenant_id);

-- commissions: list queries by status and created_at
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions (status);
CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON commissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commissions_tenant_id ON commissions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_id ON commissions (affiliate_id);

-- ── HEALTH DB indexes ─────────────────────────────────────────────────────────
-- alerts: most reads filter by resolved and sort by created_at
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts (resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts (severity);

-- service_health: joins by service_name
CREATE INDEX IF NOT EXISTS idx_service_health_service_name ON service_health (service_name);
CREATE INDEX IF NOT EXISTS idx_service_health_status ON service_health (status);
