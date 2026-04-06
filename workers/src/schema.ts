/**
 * WebWaka Super Admin V2 — Database Schema Types
 * All monetary values are INTEGER KOBO (Nigeria First invariant)
 * Date: 2026-03-21
 */

// ============================================================================
// PARTNERS
// ============================================================================
export type PartnerStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CHURNED'
export type PartnerTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'
export type SuiteName = 'civic' | 'commerce' | 'transport' | 'fintech' | 'realestate' | 'education' | 'super-admin'

export interface Partner {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  status: PartnerStatus
  tier: PartnerTier
  commission_rate_percent: number
  assigned_suites: string  // JSON array of SuiteName[]
  ndpr_consent: 0 | 1
  ndpr_consent_at?: string
  monthly_fee_kobo: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface PartnerSuiteAssignment {
  id: string
  partner_id: string
  suite: SuiteName
  assigned_at: string
  assigned_by: string
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED'
}

// ============================================================================
// DEPLOYMENTS
// ============================================================================
export type DeploymentStatus = 'PENDING' | 'LIVE' | 'FAILED' | 'UNKNOWN'
export type EnvironmentType = 'STAGING' | 'PRODUCTION'
export type PipelineStatus = 'SUCCESS' | 'FAILURE' | 'IN_PROGRESS' | 'UNKNOWN'

export interface Deployment {
  id: string
  tenant_id: string
  suite: SuiteName
  environment: EnvironmentType
  worker_name?: string
  worker_url?: string
  worker_status: DeploymentStatus
  worker_last_deployed_at?: string
  pages_project?: string
  pages_url?: string
  pages_status: DeploymentStatus
  pages_last_deployed_at?: string
  d1_database_id?: string
  d1_migrated: 0 | 1
  d1_last_migrated_at?: string
  github_repo?: string
  github_branch?: string
  last_commit_sha?: string
  last_pipeline_status: PipelineStatus
  last_pipeline_at?: string
  created_at: string
  updated_at: string
}

// ============================================================================
// OPERATIONS METRICS
// ============================================================================
export interface OperationsMetric {
  id: string
  tenant_id: string
  suite: string
  metric_date: string  // YYYY-MM-DD
  gross_revenue_kobo: number
  net_revenue_kobo: number
  commission_paid_kobo: number
  refunds_kobo: number
  transaction_count: number
  active_users: number
  uptime_percent: number
  error_rate_percent: number
  avg_response_ms: number
  ai_tokens_used: number
  ai_cost_kobo: number
  ai_vendor?: string
  created_at: string
}

// ============================================================================
// AI USAGE QUOTAS
// ============================================================================
export type AIVendor = 'platform' | 'openai' | 'gemini' | 'anthropic' | 'byok'

export interface AIUsageQuota {
  id: string
  tenant_id: string
  monthly_token_limit: number
  daily_token_limit: number
  tokens_used_this_month: number
  tokens_used_today: number
  cost_this_month_kobo: number
  active_vendor: AIVendor
  byok_key_ref?: string
  last_reset_at: string
  created_at: string
  updated_at: string
}

// ============================================================================
// PLATFORM HEALTH CHECKS
// ============================================================================
export interface PlatformHealthCheck {
  id: string
  suite: string
  environment: EnvironmentType
  endpoint_url: string
  http_status?: number
  response_ms?: number
  is_healthy: 0 | 1
  error_message?: string
  checked_at: string
}

// ============================================================================
// TENANTS (from migration 001)
// ============================================================================
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CHURNED'
export type TenantIndustry = 'RETAIL' | 'TRANSPORT' | 'FINANCE' | 'EDUCATION' | 'REAL_ESTATE' | 'CIVIC' | 'OTHER'

export interface Tenant {
  id: string
  name: string
  email: string
  status: TenantStatus
  industry: TenantIndustry
  domain?: string
  tenant_id: string
  created_at: string
  updated_at: string
}

// ============================================================================
// UTILITY TYPES
// ============================================================================
export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  errors?: string[]
  pagination?: {
    page: number
    limit: number
    total: number
  }
}

/**
 * Format kobo to naira string (Nigeria First invariant)
 * @param kobo - Integer kobo amount
 * @returns Formatted naira string e.g. "₦1,234.56"
 */
export function formatKoboToNaira(kobo: number): string {
  const naira = kobo / 100
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(naira)
}

/**
 * Generate a nanoid-style ID for new records
 */
export function generateId(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  let id = prefix + '-'
  for (let i = 0; i < 12; i++) {
    id += chars[bytes[i] % chars.length]
  }
  return id
}
