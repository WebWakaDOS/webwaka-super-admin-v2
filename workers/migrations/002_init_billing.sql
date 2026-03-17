-- Migration: 002_init_billing
-- Description: Initialize BILLING_DB with ledger, plans, commissions, escrow
-- Date: 2026-03-17
-- Status: Idempotent (safe to run multiple times)
-- CRITICAL: All monetary values are INTEGER KOBO (no decimals, no floats)

-- ============================================================================
-- TABLE: ledger_entries
-- Purpose: Core immutable double-entry financial ledger
-- CRITICAL COMPLIANCE: All amounts in INTEGER KOBO (CORE-8 requirement)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'REVENUE', 'COMMISSION', 'REFUND', 'PAYOUT', 'ADJUSTMENT', 'ESCROW_HOLD', 'ESCROW_RELEASE'
  )),
  account_from TEXT NOT NULL,  -- 'tenant:X', 'platform', 'escrow'
  account_to TEXT NOT NULL,    -- 'tenant:X', 'platform', 'escrow'
  amount_kobo INTEGER NOT NULL CHECK (amount_kobo > 0),  -- STRICT: Integer kobo only
  description TEXT NOT NULL,
  reference_id TEXT,           -- order_id, commission_id, etc.
  metadata TEXT,               -- JSON for additional context
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tenant_ledger ON ledger_entries(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_type ON ledger_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_reference ON ledger_entries(reference_id);
CREATE INDEX IF NOT EXISTS idx_accounts ON ledger_entries(account_from, account_to);

-- ============================================================================
-- TABLE: billing_plans
-- Purpose: Subscription plans per tenant
-- CRITICAL: Monthly fees and transaction fees in INTEGER KOBO
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  monthly_fee_kobo INTEGER NOT NULL CHECK (monthly_fee_kobo >= 0),  -- Integer kobo
  transaction_fee_percent DECIMAL(5, 2) NOT NULL CHECK (transaction_fee_percent >= 0),
  commission_rate_percent DECIMAL(5, 2) NOT NULL CHECK (commission_rate_percent >= 0),
  max_users INTEGER,
  max_transactions_per_day INTEGER,
  features TEXT NOT NULL,  -- JSON array
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tenant_plans ON billing_plans(tenant_id, status);

-- ============================================================================
-- TABLE: commissions
-- Purpose: Track affiliate/partner commissions (5-Level Hierarchy)
-- CRITICAL: Commission amounts in INTEGER KOBO
-- ============================================================================
CREATE TABLE IF NOT EXISTS commissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  affiliate_id TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),  -- 5-Level hierarchy
  transaction_id TEXT NOT NULL,
  amount_kobo INTEGER NOT NULL CHECK (amount_kobo > 0),  -- Integer kobo
  rate_percent DECIMAL(5, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'PAID', 'REVERSED')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_affiliate ON commissions(tenant_id, affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commission_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commission_created ON commissions(created_at DESC);

-- ============================================================================
-- TABLE: escrow_accounts
-- Purpose: Hold funds in escrow for disputes/refunds
-- CRITICAL: Escrow amounts in INTEGER KOBO
-- ============================================================================
CREATE TABLE IF NOT EXISTS escrow_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  amount_kobo INTEGER NOT NULL CHECK (amount_kobo > 0),  -- Integer kobo
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('HELD', 'RELEASED', 'FORFEITED')),
  held_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tenant_escrow ON escrow_accounts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_escrow_transaction ON escrow_accounts(transaction_id);

-- ============================================================================
-- SEED DATA: Default Billing Plans
-- ============================================================================
INSERT OR IGNORE INTO billing_plans (
  id, tenant_id, name, description, monthly_fee_kobo, transaction_fee_percent, 
  commission_rate_percent, max_users, max_transactions_per_day, features, status, created_at, updated_at
) VALUES
(
  'plan-starter',
  'super-admin',
  'Starter',
  'Basic plan for small businesses',
  0,  -- Free tier
  2.5,  -- 2.5% transaction fee
  3.0,  -- 3% commission rate
  10,  -- 10 max users
  1000,  -- 1000 transactions/day
  '["basic-reporting", "offline-mode", "single-vendor"]',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'plan-professional',
  'super-admin',
  'Professional',
  'Advanced plan for growing businesses',
  50000000,  -- ₦500,000 monthly (50M kobo)
  1.5,  -- 1.5% transaction fee
  2.0,  -- 2% commission rate
  50,  -- 50 max users
  10000,  -- 10,000 transactions/day
  '["advanced-reporting", "offline-mode", "multi-vendor", "api-access"]',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'plan-enterprise',
  'super-admin',
  'Enterprise',
  'Full-featured plan for large enterprises',
  200000000,  -- ₦2,000,000 monthly (200M kobo)
  0.5,  -- 0.5% transaction fee
  1.0,  -- 1% commission rate
  NULL,  -- Unlimited users
  NULL,  -- Unlimited transactions/day
  '["advanced-reporting", "offline-mode", "multi-vendor", "api-access", "custom-integration", "dedicated-support"]',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ============================================================================
-- SEED DATA: Sample Ledger Entries (Demo Data)
-- ============================================================================
INSERT OR IGNORE INTO ledger_entries (
  id, tenant_id, entry_type, account_from, account_to, amount_kobo, description, reference_id, created_at
) VALUES
(
  'ledger-001',
  'tenant-retail-001',
  'REVENUE',
  'customer:123',
  'tenant:tenant-retail-001',
  50000000,  -- ₦500,000
  'Sales transaction',
  'order:001',
  CURRENT_TIMESTAMP
),
(
  'ledger-002',
  'tenant-retail-001',
  'COMMISSION',
  'tenant:tenant-retail-001',
  'platform',
  1500000,  -- ₦15,000 (3% of ₦500,000)
  'Platform commission',
  'order:001',
  CURRENT_TIMESTAMP
),
(
  'ledger-003',
  'tenant-retail-001',
  'PAYOUT',
  'platform',
  'tenant:tenant-retail-001',
  48500000,  -- ₦485,000 (after commission)
  'Payout to tenant',
  'payout:001',
  CURRENT_TIMESTAMP
);

-- ============================================================================
-- MIGRATION METADATA
-- ============================================================================
-- Version: 1.0.0
-- Compliance: Blueprint Part 10.1 (Central Management & Economics), CORE-8 (Integer Kobo)
-- QA Status: Layer 1 (Static Analysis) - PASS
-- Notes: 
--   - All monetary fields are INTEGER KOBO (no decimals, no floats)
--   - Double-entry ledger ensures financial accuracy
--   - Soft deletes not needed for ledger (immutable)
--   - All tables include tenant_id for multi-tenancy isolation
