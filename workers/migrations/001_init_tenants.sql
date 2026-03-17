-- Migration: 001_init_tenants
-- Description: Initialize TENANTS_DB with tenant registry, environments, and domains
-- Date: 2026-03-17
-- Status: Idempotent (safe to run multiple times)

-- ============================================================================
-- TABLE: tenants
-- Purpose: Central tenant registry with status and configuration
-- Isolation: Multi-tenant via tenant_id (self-referential for super admin)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'PROVISIONING', 'ARCHIVED')),
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
  
  -- Metadata for multi-tenancy
  tenant_id TEXT NOT NULL DEFAULT 'super-admin',
  version INTEGER NOT NULL DEFAULT 1
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tenant_status ON tenants(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_domain ON tenants(domain);
CREATE INDEX IF NOT EXISTS idx_created_at ON tenants(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email ON tenants(email);

-- ============================================================================
-- TABLE: tenant_environments
-- Purpose: Staging/Production environment configuration per tenant
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_environments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('STAGING', 'PRODUCTION')),
  enabled_modules TEXT NOT NULL,  -- JSON array of module IDs
  feature_flags TEXT NOT NULL,    -- JSON object of feature flags
  api_keys TEXT NOT NULL,         -- JSON array of API keys
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, environment)
);

CREATE INDEX IF NOT EXISTS idx_tenant_env ON tenant_environments(tenant_id, environment);

-- ============================================================================
-- TABLE: tenant_domains
-- Purpose: Custom domain mapping for white-label support
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_domains (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  ssl_status TEXT NOT NULL CHECK (ssl_status IN ('PENDING', 'ACTIVE', 'EXPIRED')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tenant_domains ON tenant_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_primary_domain ON tenant_domains(tenant_id, is_primary);

-- ============================================================================
-- SEED DATA: Super Admin Tenant (Platform Owner)
-- ============================================================================
INSERT OR IGNORE INTO tenants (
  id, name, email, status, industry, domain, tenant_id, created_at, updated_at
) VALUES (
  'super-admin',
  'WebWaka Platform',
  'admin@webwaka.com',
  'ACTIVE',
  'FINANCE',
  'admin.webwaka.com',
  'super-admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ============================================================================
-- SEED DATA: Super Admin Environment
-- ============================================================================
INSERT OR IGNORE INTO tenant_environments (
  id, tenant_id, environment, enabled_modules, feature_flags, api_keys, created_at, updated_at
) VALUES (
  'env-super-admin-staging',
  'super-admin',
  'STAGING',
  '["commerce-core", "transport", "fintech", "real-estate", "education"]',
  '{"advanced-analytics": false, "ai-recommendations": false, "multi-currency": true}',
  '[]',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO tenant_environments (
  id, tenant_id, environment, enabled_modules, feature_flags, api_keys, created_at, updated_at
) VALUES (
  'env-super-admin-prod',
  'super-admin',
  'PRODUCTION',
  '["commerce-core", "transport", "fintech", "real-estate", "education"]',
  '{"advanced-analytics": true, "ai-recommendations": true, "multi-currency": true}',
  '[]',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ============================================================================
-- SEED DATA: Demo Tenants (for testing)
-- ============================================================================
INSERT OR IGNORE INTO tenants (
  id, name, email, status, industry, domain, tenant_id, created_at, updated_at
) VALUES 
(
  'tenant-retail-001',
  'TechCorp Nigeria',
  'admin@techcorp.ng',
  'ACTIVE',
  'RETAIL',
  'techcorp.webwaka.app',
  'super-admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'tenant-retail-002',
  'RetailHub Lagos',
  'admin@retailhub.ng',
  'ACTIVE',
  'RETAIL',
  'retailhub.webwaka.app',
  'super-admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'tenant-transport-001',
  'TransportGo',
  'admin@transportgo.ng',
  'ACTIVE',
  'TRANSPORT',
  'transportgo.webwaka.app',
  'super-admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ============================================================================
-- MIGRATION METADATA
-- ============================================================================
-- Version: 1.0.0
-- Compliance: Blueprint Part 10.1, 9.2 (Multi-Tenancy, Soft Deletes)
-- QA Status: Layer 1 (Static Analysis) - PASS
-- Notes: All tables include tenant_id for multi-tenancy isolation
