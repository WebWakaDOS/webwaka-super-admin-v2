/// <reference types="vite/client" />
/**
 * WebWaka Super Admin — Unified API Client (backwards-compatible facade)
 * Re-exports from the primary api.ts client with additional types and generic methods.
 * All pages/hooks should import from this file.
 *
 * Base URL resolution order:
 *   1. VITE_API_URL env var (set in .env.local for local dev → http://localhost:8787)
 *   2. VITE_FRONTEND_FORGE_API_URL (legacy env var support)
 *   3. Auto-detection: localhost → local Workers, else deployed Workers
 */

function resolveApiBase(): string {
  if (typeof window === 'undefined') {
    return 'https://webwaka-super-admin-api.webwaka.workers.dev'
  }
  const primary = import.meta.env.VITE_API_URL
  if (primary) return primary
  const legacy = import.meta.env.VITE_FRONTEND_FORGE_API_URL
  if (legacy) return legacy
  const { hostname } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8787'
  }
  return 'https://webwaka-super-admin-api.webwaka.workers.dev'
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface TenantStats {
  totalTenants: number
  activeTenants: number
  suspendedTenants: number
  provisioningTenants: number
  archivedTenants: number
  totalRevenueKobo: number
  totalCommissionKobo: number
}

export interface ServiceStatus {
  name: string
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN'
  uptime: number
  responseTime: number
  lastChecked: string
}

export interface SystemMetrics {
  timestamp: string
  metricName: string
  metricValue: number
  unit?: string
}

export interface BillingData {
  totalRevenueKobo: number
  totalCommissionsKobo: number
  totalPayoutsKobo: number
  netRevenueKobo: number
  activeBillingPlans: number
  periodDays: number
}

// ── Client ────────────────────────────────────────────────────────────────────

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = resolveApiBase()) {
    this.baseUrl = baseUrl
  }

  private getToken(): string | null {
    try {
      return localStorage.getItem('auth_token')
    } catch {
      return null
    }
  }

  private getHeaders(): Record<string, string> {
    const token = this.getToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }

  private async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`
      const response = await fetch(url, {
        ...options,
        headers: { ...this.getHeaders(), ...(options.headers as Record<string, string> || {}) },
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        return {
          success: false,
          error: err.errors?.[0] || err.error || err.message || `HTTP ${response.status}`,
        }
      }

      const json = await response.json()
      // Workers returns { success, data } — unwrap or pass through
      if (typeof json === 'object' && 'success' in json) {
        return json as ApiResponse<T>
      }
      return { success: true, data: json }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' }
    }
  }

  // ── Generic HTTP methods (used by hooks with direct path like /billing/summary) ──
  async get<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T = unknown>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  async put<T = unknown>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  async delete<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  async patch<T = unknown>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  async me(): Promise<ApiResponse<{ userId: string; email: string; role: string; permissions: string[] }>> {
    return this.request('/auth/me', { method: 'GET' })
  }

  // ── Tenants ───────────────────────────────────────────────────────────────
  async getTenantStats(): Promise<ApiResponse<TenantStats>> {
    return this.request<TenantStats>('/tenants/stats', { method: 'GET' })
  }

  async getTenants(page: number = 1, limit: number = 10): Promise<ApiResponse<{
    tenants: unknown[]
    pagination: { page: number; limit: number; total: number }
  }>> {
    return this.request(`/tenants?page=${page}&limit=${limit}`, { method: 'GET' })
  }

  async getTenant(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/tenants/${id}`, { method: 'GET' })
  }

  async createTenant(data: unknown): Promise<ApiResponse<unknown>> {
    return this.request('/tenants', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateTenant(id: string, data: unknown): Promise<ApiResponse<unknown>> {
    return this.request(`/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async deleteTenant(id: string): Promise<ApiResponse<void>> {
    return this.request(`/tenants/${id}`, { method: 'DELETE' })
  }

  // ── Billing ───────────────────────────────────────────────────────────────
  async getBillingMetrics(): Promise<ApiResponse<BillingData>> {
    return this.request<BillingData>('/billing/metrics', { method: 'GET' })
  }

  async getBillingLedger(limit = 50, offset = 0): Promise<ApiResponse<unknown>> {
    return this.request(`/billing/ledger?limit=${limit}&offset=${offset}`, { method: 'GET' })
  }

  async getBillingSummary(): Promise<ApiResponse<unknown>> {
    return this.request('/billing/summary', { method: 'GET' })
  }

  async getCommissions(page = 1, limit = 20): Promise<ApiResponse<unknown>> {
    return this.request(`/billing/commissions?page=${page}&limit=${limit}`, { method: 'GET' })
  }

  // ── Modules ───────────────────────────────────────────────────────────────
  async getModules(): Promise<ApiResponse<unknown[]>> {
    return this.request('/modules', { method: 'GET' })
  }

  async getModulesForTenant(tenantId: string): Promise<ApiResponse<unknown[]>> {
    return this.request(`/modules/${tenantId}`, { method: 'GET' })
  }

  async updateTenantModule(tenantId: string, moduleId: string, enabled: boolean): Promise<ApiResponse<unknown>> {
    return this.request(`/modules/${tenantId}/${moduleId}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    })
  }

  // ── Health ────────────────────────────────────────────────────────────────
  async getHealthStatus(): Promise<ApiResponse<unknown>> {
    return this.request('/health/status', { method: 'GET' })
  }

  async getHealthServices(): Promise<ApiResponse<ServiceStatus[]>> {
    return this.request('/health/services', { method: 'GET' })
  }

  async getHealthMetrics(hours = 24): Promise<ApiResponse<SystemMetrics[]>> {
    return this.request(`/health/metrics?hours=${hours}`, { method: 'GET' })
  }

  async getHealthAlerts(resolved?: boolean): Promise<ApiResponse<unknown[]>> {
    const qs = resolved !== undefined ? `?resolved=${resolved}` : ''
    return this.request(`/health/alerts${qs}`, { method: 'GET' })
  }

  async runHealthCheck(): Promise<ApiResponse<unknown>> {
    return this.request('/health/check', { method: 'POST' })
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  async getSettings(): Promise<ApiResponse<unknown>> {
    return this.request('/settings', { method: 'GET' })
  }

  async updateSettings(data: unknown): Promise<ApiResponse<unknown>> {
    return this.request('/settings', { method: 'PUT', body: JSON.stringify(data) })
  }

  async getApiKeys(): Promise<ApiResponse<unknown[]>> {
    return this.request('/settings/api-keys', { method: 'GET' })
  }

  async createApiKey(name: string): Promise<ApiResponse<unknown>> {
    return this.request('/settings/api-keys', { method: 'POST', body: JSON.stringify({ name }) })
  }

  async deleteApiKey(id: string): Promise<ApiResponse<void>> {
    return this.request(`/settings/api-keys/${id}`, { method: 'DELETE' })
  }

  async getAuditLog(page = 1, limit = 50): Promise<ApiResponse<unknown>> {
    return this.request(`/settings/audit-log?page=${page}&limit=${limit}`, { method: 'GET' })
  }

  // ── Partners ──────────────────────────────────────────────────────────────
  async getPartners(page = 1, limit = 20): Promise<ApiResponse<unknown>> {
    return this.request(`/partners?page=${page}&limit=${limit}`, { method: 'GET' })
  }

  async createPartner(data: unknown): Promise<ApiResponse<unknown>> {
    return this.request('/partners', { method: 'POST', body: JSON.stringify(data) })
  }

  async updatePartner(id: string, data: unknown): Promise<ApiResponse<unknown>> {
    return this.request(`/partners/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async deletePartner(id: string): Promise<ApiResponse<void>> {
    return this.request(`/partners/${id}`, { method: 'DELETE' })
  }

  async assignPartnerSuite(partnerId: string, data: unknown): Promise<ApiResponse<unknown>> {
    return this.request(`/partners/${partnerId}/suites`, { method: 'POST', body: JSON.stringify(data) })
  }

  // ── Deployments ───────────────────────────────────────────────────────────
  async getDeployments(page = 1): Promise<ApiResponse<unknown>> {
    return this.request(`/deployments?page=${page}`, { method: 'GET' })
  }

  async updateDeploymentStatus(id: string, status: string): Promise<ApiResponse<unknown>> {
    return this.request(`/deployments/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) })
  }

  async refreshDeployments(): Promise<ApiResponse<unknown>> {
    return this.request('/deployments/refresh', { method: 'POST' })
  }

  // ── Operations ────────────────────────────────────────────────────────────
  async getOperationsMetrics(tenantId?: string): Promise<ApiResponse<unknown>> {
    return this.request(`/operations/metrics${tenantId ? `?tenant_id=${tenantId}` : ''}`, { method: 'GET' })
  }

  async getOperationsSummary(): Promise<ApiResponse<unknown>> {
    return this.request('/operations/summary', { method: 'GET' })
  }

  async getAIUsage(): Promise<ApiResponse<unknown>> {
    return this.request('/operations/ai-usage', { method: 'GET' })
  }

  // ── AI Quotas ─────────────────────────────────────────────────────────────
  async getAIQuotas(tenantId: string): Promise<ApiResponse<unknown>> {
    return this.request(`/ai-quotas/${tenantId}`, { method: 'GET' })
  }

  async updateAIQuotas(tenantId: string, data: unknown): Promise<ApiResponse<unknown>> {
    return this.request(`/ai-quotas/${tenantId}`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async resetAIQuotas(tenantId: string, resetType: 'daily' | 'monthly'): Promise<ApiResponse<unknown>> {
    return this.request(`/ai-quotas/${tenantId}/reset`, { method: 'POST', body: JSON.stringify({ resetType }) })
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────
  connectWebSocket(endpoint: string, onMessage: (data: unknown) => void, onError?: (error: Event) => void): WebSocket {
    // Convert http(s) to ws(s) correctly
    const wsUrl = this.baseUrl
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://')
    const ws = new WebSocket(`${wsUrl}${endpoint}`)

    ws.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data))
      } catch {
        console.error('Failed to parse WebSocket message:', event.data)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error on', endpoint, error)
      if (onError) onError(error)
    }

    return ws
  }
}

export const apiClient = new ApiClient()
export type { ApiClient }
