/// <reference types="vite/client" />
/**
 * WebWaka Super Admin — API Client (primary)
 * Uses VITE_API_URL env var; falls back to deployed Workers URL.
 * Method signature: request(method, endpoint, body?)
 */

function getAPIBase(): string {
  if (typeof window === 'undefined') {
    return 'https://webwaka-super-admin-api.webwaka.workers.dev'
  }
  // Prefer explicit env var (set VITE_API_URL=http://localhost:8787 for local dev)
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl
  // Detect Cloudflare dev tunnel / Replit proxy — not localhost
  const { hostname } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8787'
  }
  return 'https://webwaka-super-admin-api.webwaka.workers.dev'
}

export interface ApiResponse<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

export class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl || getAPIBase()
    this.token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  }

  setToken(token: string | null) {
    this.token = token
    if (token) {
      localStorage.setItem('auth_token', token)
    } else {
      localStorage.removeItem('auth_token')
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  async request<T = unknown>(method: string, endpoint: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
    }
    if (body !== undefined) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || error.message || `HTTP ${response.status}`)
    }
    return response.json()
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  async login(email: string, password: string) {
    return this.request('POST', '/auth/login', { email, password })
  }

  async logout() {
    return this.request('POST', '/auth/logout')
  }

  async me() {
    return this.request('GET', '/auth/me')
  }

  // ── Tenants ───────────────────────────────────────────────────────────────
  async getTenants(page = 1, limit = 20) {
    return this.request('GET', `/tenants?page=${page}&limit=${limit}`)
  }

  async getTenantStats() {
    return this.request('GET', '/tenants/stats')
  }

  async getTenant(id: string) {
    return this.request('GET', `/tenants/${id}`)
  }

  async createTenant(data: unknown) {
    return this.request('POST', '/tenants', data)
  }

  async updateTenant(id: string, data: unknown) {
    return this.request('PUT', `/tenants/${id}`, data)
  }

  async deleteTenant(id: string) {
    return this.request('DELETE', `/tenants/${id}`)
  }

  // ── Billing ───────────────────────────────────────────────────────────────
  async getBillingMetrics() {
    return this.request('GET', '/billing/metrics')
  }

  async getBillingLedger(limit = 50, offset = 0) {
    return this.request('GET', `/billing/ledger?limit=${limit}&offset=${offset}`)
  }

  async getBillingSummary() {
    return this.request('GET', '/billing/summary')
  }

  async getCommissions(page = 1, limit = 20) {
    return this.request('GET', `/billing/commissions?page=${page}&limit=${limit}`)
  }

  async createLedgerEntry(data: unknown) {
    return this.request('POST', '/billing/entry', data)
  }

  // ── Modules ───────────────────────────────────────────────────────────────
  async getModules() {
    return this.request('GET', '/modules')
  }

  async getModulesForTenant(tenantId: string) {
    return this.request('GET', `/modules/${tenantId}`)
  }

  async updateTenantModule(tenantId: string, moduleId: string, enabled: boolean) {
    return this.request('PUT', `/modules/${tenantId}/${moduleId}`, { enabled })
  }

  // ── Health ────────────────────────────────────────────────────────────────
  async getHealthStatus() {
    return this.request('GET', '/health/status')
  }

  async getHealthServices() {
    return this.request('GET', '/health/services')
  }

  async getHealthMetrics(hours = 24) {
    return this.request('GET', `/health/metrics?hours=${hours}`)
  }

  async getHealthAlerts(resolved?: boolean) {
    const qs = resolved !== undefined ? `?resolved=${resolved}` : ''
    return this.request('GET', `/health/alerts${qs}`)
  }

  async runHealthCheck() {
    return this.request('POST', '/health/check')
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  async getSettings() {
    return this.request('GET', '/settings')
  }

  async updateSettings(data: unknown) {
    return this.request('PUT', '/settings', data)
  }

  async getApiKeys() {
    return this.request('GET', '/settings/api-keys')
  }

  async createApiKey(name: string) {
    return this.request('POST', '/settings/api-keys', { name })
  }

  async deleteApiKey(id: string) {
    return this.request('DELETE', `/settings/api-keys/${id}`)
  }

  async getAuditLog(page = 1, limit = 50) {
    return this.request('GET', `/settings/audit-log?page=${page}&limit=${limit}`)
  }

  // ── Partners ──────────────────────────────────────────────────────────────
  async getPartners(page = 1, limit = 20) {
    return this.request('GET', `/partners?page=${page}&limit=${limit}`)
  }

  async getPartner(id: string) {
    return this.request('GET', `/partners/${id}`)
  }

  async createPartner(data: unknown) {
    return this.request('POST', '/partners', data)
  }

  async updatePartner(id: string, data: unknown) {
    return this.request('PUT', `/partners/${id}`, data)
  }

  async deletePartner(id: string) {
    return this.request('DELETE', `/partners/${id}`)
  }

  async assignPartnerSuite(partnerId: string, data: unknown) {
    return this.request('POST', `/partners/${partnerId}/suites`, data)
  }

  // ── Deployments ───────────────────────────────────────────────────────────
  async getDeployments(page = 1) {
    return this.request('GET', `/deployments?page=${page}`)
  }

  async getDeployment(id: string) {
    return this.request('GET', `/deployments/${id}`)
  }

  async updateDeploymentStatus(id: string, status: string) {
    return this.request('PUT', `/deployments/${id}/status`, { status })
  }

  async refreshDeployments() {
    return this.request('POST', '/deployments/refresh')
  }

  // ── Operations ────────────────────────────────────────────────────────────
  async getOperationsMetrics(tenantId?: string) {
    return this.request('GET', `/operations/metrics${tenantId ? `?tenant_id=${tenantId}` : ''}`)
  }

  async getOperationsSummary() {
    return this.request('GET', '/operations/summary')
  }

  async getAIUsage() {
    return this.request('GET', '/operations/ai-usage')
  }

  // ── AI Quotas ─────────────────────────────────────────────────────────────
  async getAIQuotas(tenantId: string) {
    return this.request('GET', `/ai-quotas/${tenantId}`)
  }

  async updateAIQuotas(tenantId: string, data: unknown) {
    return this.request('PUT', `/ai-quotas/${tenantId}`, data)
  }

  async resetAIQuotas(tenantId: string, resetType: 'daily' | 'monthly') {
    return this.request('POST', `/ai-quotas/${tenantId}/reset`, { resetType })
  }
}

export const apiClient = new ApiClient()
