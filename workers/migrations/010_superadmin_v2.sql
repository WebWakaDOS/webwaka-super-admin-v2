-- Migration: 010_superadmin_v2
-- Description: Super Admin V2 — Partners, Deployments, Operations, AI Usage tables
-- Date: 2026-03-21
-- Status: Idempotent (safe to run multiple times)
-- CRITICAL: All monetary values are INTEGER KOBO (no decimals, no floats)
-- Compliance: 7 Core Invariants (Build Once Use Infinitely, Nigeria First, etc.)

-- ============================================================================
-- TABLE: partners
-- Purpose: Partner onboarding, billing, commissions (resellers, ISVs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  company TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'CHURNED'))
    DEFAULT 'PENDING',
  tier TEXT NOT NULL CHECK (tier IN ('STARTER', 'GROWTH', 'ENTERPRISE')) DEFAULT 'STARTER',
  commission_rate_percent DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  -- Assigned suites (JSON array: ["civic", "commerce", "transport"])
  assigned_suites TEXT NOT NULL DEFAULT '[]',
  -- NDPR consent
  ndpr_consent INTEGER NOT NULL DEFAULT 0,
  ndpr_consent_at TIMESTAMP,
  -- Billing
  monthly_fee_kobo INTEGER NOT NULL DEFAULT 0,
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_partner_status ON partners(status);
CREATE INDEX IF NOT EXISTS idx_partner_email ON partners(email);
CREATE INDEX IF NOT EXISTS idx_partner_tier ON partners(tier);

-- ============================================================================
-- TABLE: partner_suite_assignments
-- Purpose: Many-to-many: partners ↔ suites (civic/commerce/transport)
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_suite_assignments (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  suite TEXT NOT NULL CHECK (suite IN ('civic', 'commerce', 'transport', 'fintech', 'realestate', 'education')),
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by TEXT NOT NULL DEFAULT 'super-admin',
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')) DEFAULT 'ACTIVE',
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
  UNIQUE (partner_id, suite)
);
CREATE INDEX IF NOT EXISTS idx_partner_suite ON partner_suite_assignments(partner_id, suite);

-- ============================================================================
-- TABLE: deployments
-- Purpose: Track Cloudflare Workers/Pages/D1 deployment status per tenant
-- ============================================================================
CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  suite TEXT NOT NULL CHECK (suite IN ('civic', 'commerce', 'transport', 'fintech', 'realestate', 'education', 'super-admin')),
  environment TEXT NOT NULL CHECK (environment IN ('STAGING', 'PRODUCTION')),
  -- Worker deployment
  worker_name TEXT,
  worker_url TEXT,
  worker_status TEXT NOT NULL CHECK (worker_status IN ('PENDING', 'LIVE', 'FAILED', 'UNKNOWN'))
    DEFAULT 'UNKNOWN',
  worker_last_deployed_at TIMESTAMP,
  -- Pages deployment
  pages_project TEXT,
  pages_url TEXT,
  pages_status TEXT NOT NULL CHECK (pages_status IN ('PENDING', 'LIVE', 'FAILED', 'UNKNOWN'))
    DEFAULT 'UNKNOWN',
  pages_last_deployed_at TIMESTAMP,
  -- D1 database
  d1_database_id TEXT,
  d1_migrated INTEGER NOT NULL DEFAULT 0,
  d1_last_migrated_at TIMESTAMP,
  -- CI/CD
  github_repo TEXT,
  github_branch TEXT,
  last_commit_sha TEXT,
  last_pipeline_status TEXT CHECK (last_pipeline_status IN ('SUCCESS', 'FAILURE', 'IN_PROGRESS', 'UNKNOWN'))
    DEFAULT 'UNKNOWN',
  last_pipeline_at TIMESTAMP,
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_deployment_tenant ON deployments(tenant_id, suite, environment);
CREATE INDEX IF NOT EXISTS idx_deployment_status ON deployments(worker_status, pages_status);

-- ============================================================================
-- TABLE: operations_metrics
-- Purpose: Cross-suite analytics — revenue, health, AI usage per tenant
-- ============================================================================
CREATE TABLE IF NOT EXISTS operations_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  suite TEXT NOT NULL,
  metric_date TEXT NOT NULL,  -- YYYY-MM-DD
  -- Revenue (all in kobo)
  gross_revenue_kobo INTEGER NOT NULL DEFAULT 0,
  net_revenue_kobo INTEGER NOT NULL DEFAULT 0,
  commission_paid_kobo INTEGER NOT NULL DEFAULT 0,
  refunds_kobo INTEGER NOT NULL DEFAULT 0,
  -- Transactions
  transaction_count INTEGER NOT NULL DEFAULT 0,
  active_users INTEGER NOT NULL DEFAULT 0,
  -- Health
  uptime_percent DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
  error_rate_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  avg_response_ms INTEGER NOT NULL DEFAULT 0,
  -- AI usage
  ai_tokens_used INTEGER NOT NULL DEFAULT 0,
  ai_cost_kobo INTEGER NOT NULL DEFAULT 0,
  ai_vendor TEXT,  -- 'openai', 'gemini', 'anthropic', 'byok'
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, suite, metric_date)
);
CREATE INDEX IF NOT EXISTS idx_ops_tenant_date ON operations_metrics(tenant_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_ops_suite ON operations_metrics(suite, metric_date DESC);

-- ============================================================================
-- TABLE: ai_usage_quotas
-- Purpose: BYOK (Bring Your Own Key) AI quota management per tenant
-- Invariant: Vendor Neutral AI — no lock-in to any single AI vendor
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_usage_quotas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  -- Quota limits
  monthly_token_limit INTEGER NOT NULL DEFAULT 1000000,
  daily_token_limit INTEGER NOT NULL DEFAULT 50000,
  -- Current usage (reset monthly/daily)
  tokens_used_this_month INTEGER NOT NULL DEFAULT 0,
  tokens_used_today INTEGER NOT NULL DEFAULT 0,
  -- Cost tracking (kobo)
  cost_this_month_kobo INTEGER NOT NULL DEFAULT 0,
  -- BYOK configuration (encrypted key stored in KV, not here)
  active_vendor TEXT NOT NULL DEFAULT 'platform'
    CHECK (active_vendor IN ('platform', 'openai', 'gemini', 'anthropic', 'byok')),
  byok_key_ref TEXT,  -- Reference to KV key where encrypted BYOK key is stored
  -- Metadata
  last_reset_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_quota_tenant ON ai_usage_quotas(tenant_id);

-- ============================================================================
-- TABLE: platform_health_checks
-- Purpose: Periodic health check results for all suite endpoints
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_health_checks (
  id TEXT PRIMARY KEY,
  suite TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('STAGING', 'PRODUCTION')),
  endpoint_url TEXT NOT NULL,
  http_status INTEGER,
  response_ms INTEGER,
  is_healthy INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_health_suite ON platform_health_checks(suite, environment, checked_at DESC);

-- ============================================================================
-- SEED DATA: Platform-level deployments (all 3 suites)
-- ============================================================================
INSERT OR IGNORE INTO deployments (
  id, tenant_id, suite, environment,
  worker_name, worker_url, worker_status,
  pages_project, pages_url, pages_status,
  github_repo, github_branch
) VALUES
-- Civic Suite
('dep-civic-prod', 'super-admin', 'civic', 'PRODUCTION',
  'webwaka-civic-api-prod', 'https://webwaka-civic-api-prod.webwaka.workers.dev', 'LIVE',
  'webwaka-civic-ui', 'https://webwaka-civic-ui-prod.pages.dev', 'LIVE',
  'WebWakaDOS/webwaka-civic', 'main'),
('dep-civic-staging', 'super-admin', 'civic', 'STAGING',
  'webwaka-civic-api-staging', 'https://webwaka-civic-api-staging.webwaka.workers.dev', 'LIVE',
  'webwaka-civic-ui', 'https://webwaka-civic-ui-staging.pages.dev', 'LIVE',
  'WebWakaDOS/webwaka-civic', 'develop'),
-- Commerce Suite
('dep-commerce-prod', 'super-admin', 'commerce', 'PRODUCTION',
  'webwaka-commerce-api-prod', 'https://webwaka-commerce-api-prod.webwaka.workers.dev', 'LIVE',
  'webwaka-commerce-ui', 'https://webwaka-commerce-ui.pages.dev', 'LIVE',
  'WebWakaDOS/webwaka-commerce', 'main'),
('dep-commerce-staging', 'super-admin', 'commerce', 'STAGING',
  'webwaka-commerce-api-staging', 'https://webwaka-commerce-api-staging.webwaka.workers.dev', 'LIVE',
  'webwaka-commerce-ui', 'https://webwaka-commerce-ui.pages.dev', 'LIVE',
  'WebWakaDOS/webwaka-commerce', 'develop'),
-- Transport Suite
('dep-transport-prod', 'super-admin', 'transport', 'PRODUCTION',
  'webwaka-transport-api-prod', 'https://webwaka-transport-api-prod.webwaka.workers.dev', 'LIVE',
  'webwaka-transport-ui', 'https://webwaka-transport-ui.pages.dev', 'LIVE',
  'WebWakaDOS/webwaka-transport', 'main'),
('dep-transport-staging', 'super-admin', 'transport', 'STAGING',
  'webwaka-transport-api-staging', 'https://webwaka-transport-api-staging.webwaka.workers.dev', 'LIVE',
  'webwaka-transport-ui', 'https://webwaka-transport-ui.pages.dev', 'LIVE',
  'WebWakaDOS/webwaka-transport', 'develop');

-- ============================================================================
-- MIGRATION METADATA
-- ============================================================================
-- Version: 2.0.0
-- Compliance: 7 Core Invariants (Build Once Use Infinitely, Nigeria First, etc.)
-- QA Status: Layer 1 (Static Analysis) - PASS
-- Notes: All monetary values in INTEGER KOBO. NDPR consent tracked on partners.
