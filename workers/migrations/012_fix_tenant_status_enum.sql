-- Migration: 012_fix_tenant_status_enum
-- Description: Synchronize tenant.status CHECK constraint with canonical TypeScript enum
-- Canonical enum: ACTIVE | SUSPENDED | TRIAL | CHURNED
-- Replaces: ACTIVE | SUSPENDED | PROVISIONING | ARCHIVED (from 001_init_tenants.sql)
-- Status mapping applied during copy:
--   PROVISIONING -> TRIAL   (in-flight onboarding maps to trial lifecycle stage)
--   ARCHIVED     -> CHURNED (decommissioned/archived maps to churned lifecycle stage)
-- Date: 2026-04-02
-- Reference: T-FND-02 — Tenant status enum synchronization
-- Compliance: Data Consistency Invariant — SQL CHECK and TypeScript types must be identical

-- SQLite / Cloudflare D1 does not support ALTER TABLE … MODIFY COLUMN or DROP CONSTRAINT.
-- The canonical SQLite approach is: create replacement table → copy data → drop original → rename.

PRAGMA foreign_keys = OFF;

-- ============================================================================
-- Step 1: Create replacement table with the correct CHECK constraint
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants_v2 (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TRIAL', 'CHURNED')),
  industry TEXT NOT NULL CHECK (industry IN (
    'RETAIL', 'TRANSPORT', 'EDUCATION', 'RESTAURANT', 'REAL_ESTATE',
    'LOGISTICS', 'HEALTHCARE', 'FINANCE', 'HOSPITALITY', 'MANUFACTURING'
  )),
  domain TEXT UNIQUE,
  branding_logo_url TEXT,
  branding_primary_color TEXT,
  branding_secondary_color TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  tenant_id TEXT NOT NULL DEFAULT 'super-admin',
  version INTEGER NOT NULL DEFAULT 1
);

-- ============================================================================
-- Step 2: Copy all rows, mapping legacy statuses to canonical values
--   PROVISIONING -> TRIAL
--   ARCHIVED     -> CHURNED
--   ACTIVE       -> ACTIVE   (unchanged)
--   SUSPENDED    -> SUSPENDED (unchanged)
-- ============================================================================
INSERT INTO tenants_v2
  (id, name, email, status, industry, domain,
   branding_logo_url, branding_primary_color, branding_secondary_color,
   created_at, updated_at, deleted_at, tenant_id, version)
SELECT
  id, name, email,
  CASE status
    WHEN 'PROVISIONING' THEN 'TRIAL'
    WHEN 'ARCHIVED'     THEN 'CHURNED'
    ELSE status
  END,
  industry, domain,
  branding_logo_url, branding_primary_color, branding_secondary_color,
  created_at, updated_at, deleted_at, tenant_id, version
FROM tenants;

-- ============================================================================
-- Step 3: Drop original table (child tables tenant_environments / tenant_domains
--         use ON DELETE CASCADE; foreign_keys is OFF during this block so the
--         rename completes before re-enabling referential integrity)
-- ============================================================================
DROP TABLE tenants;

-- ============================================================================
-- Step 4: Rename replacement table to the canonical name
-- ============================================================================
ALTER TABLE tenants_v2 RENAME TO tenants;

-- ============================================================================
-- Step 5: Recreate indexes (mirrors 001_init_tenants.sql + 011_indexes.sql,
--         excluding idx_tenants_plan which references a non-existent column)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tenant_status   ON tenants(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_domain          ON tenants(domain);
CREATE INDEX IF NOT EXISTS idx_created_at      ON tenants(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email           ON tenants(email);
CREATE INDEX IF NOT EXISTS idx_tenants_status  ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC);

PRAGMA foreign_keys = ON;

-- ============================================================================
-- MIGRATION METADATA
-- ============================================================================
-- Version: 1.0.0
-- Task: T-FND-02
-- Compliance: Data Consistency Invariant — TypeScript enum == SQL CHECK constraint
-- QA Status: Pending Vitest run
-- Notes:
--   - schema.ts TenantStatus was already correct; only SQL needed updating
--   - Status mapping is semantically correct: PROVISIONING is an early lifecycle
--     state analogous to TRIAL; ARCHIVED is a terminal state analogous to CHURNED
