// API client for Hono Workers backend
// Use /api relative path so Vite's dev proxy forwards to the backend worker.
// This works on any host (localhost, Replit, staging, etc.).
function getAPIBase() {
  return '/api'
}

// ── Shared response types ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

// CompatResponse mirrors the {success, data, error} shape used by all pages.
// The compatibility wrapper methods below return this so migrated pages require
// no logic changes.
interface CompatResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// ── Legacy type exports (previously in api-client.ts) ────────────────────────

export interface ServiceStatus {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  uptime: number
  responseTime: number
  lastChecked: string
}

export interface SystemMetrics {
  timestamp: string
  cpu: number
  memory: number
  diskUsage: number
  requests: number
}

export interface TenantStats {
  totalTenants: number
  activeTenants: number
  totalRevenue: number
  monthlyRecurring: number
}

export interface BillingData {
  totalRevenue: number
  activeSubscriptions: number
  pendingPayouts: number
  commissionEarned: number
}

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// ── Client class ─────────────────────────────────────────────────────────────

export class ApiClient {
  private baseUrl: string
  private userId: string | null = null

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl || getAPIBase()
    this.userId = localStorage.getItem('auth_user_id')
  }

  // No-op kept for call-site compatibility. JWT is now an HttpOnly cookie
  // managed entirely by the browser — JavaScript must never read or write it.
  setToken(_token: string | null) {}

  setUserId(userId: string | null) {
    this.userId = userId
    if (userId) {
      localStorage.setItem('auth_user_id', userId)
    } else {
      localStorage.removeItem('auth_user_id')
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    }
  }

  // Core request — throws ApiError on non-OK responses.
  // 401/403 dispatches auth:session-expired before throwing.
  // credentials: 'include' ensures the HttpOnly auth cookie is sent on every request.
  private async request<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
      credentials: 'include',
    }
    if (body !== undefined) {
      options.body = JSON.stringify(body)
    }
    const response = await fetch(url, options)
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      const message = error.error || error.message || `HTTP ${response.status}`
      if (response.status === 401 || response.status === 403) {
        window.dispatchEvent(
          new CustomEvent('auth:session-expired', { detail: { status: response.status } })
        )
      }
      throw new ApiError(message, response.status)
    }
    return response.json()
  }

  // ── Compatibility wrappers ────────────────────────────────────────────────
  // Return {success, data, error} so pages migrated from api-client.ts compile
  // without logic changes. 401/403 session-expiry events still fire.
  //
  // The Workers backend always wraps successful responses in the envelope:
  //   { success: true, data: <payload>, errors?: string[] }
  // These wrappers unwrap that envelope so callers receive the inner payload
  // directly in res.data, matching all TypeScript type annotations.

  async get<T = any>(endpoint: string): Promise<CompatResponse<T>> {
    try {
      const envelope = await this.request<{ success: boolean; data: T; errors?: string[] }>('GET', endpoint)
      if (!envelope.success) return { success: false, error: envelope.errors?.[0] || 'Request failed' }
      return { success: true, data: envelope.data }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async post<T = any>(endpoint: string, body?: unknown): Promise<CompatResponse<T>> {
    try {
      const envelope = await this.request<{ success: boolean; data: T; errors?: string[] }>('POST', endpoint, body)
      if (!envelope.success) return { success: false, error: envelope.errors?.[0] || 'Request failed' }
      return { success: true, data: envelope.data }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async put<T = any>(endpoint: string, body?: unknown): Promise<CompatResponse<T>> {
    try {
      const envelope = await this.request<{ success: boolean; data: T; errors?: string[] }>('PUT', endpoint, body)
      if (!envelope.success) return { success: false, error: envelope.errors?.[0] || 'Request failed' }
      return { success: true, data: envelope.data }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async delete<T = any>(endpoint: string): Promise<CompatResponse<T>> {
    try {
      const envelope = await this.request<{ success: boolean; data: T; errors?: string[] }>('DELETE', endpoint)
      if (!envelope.success) return { success: false, error: envelope.errors?.[0] || 'Request failed' }
      return { success: true, data: envelope.data }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async patch<T = any>(endpoint: string, body?: unknown): Promise<CompatResponse<T>> {
    try {
      const envelope = await this.request<{ success: boolean; data: T; errors?: string[] }>('PATCH', endpoint, body)
      if (!envelope.success) return { success: false, error: envelope.errors?.[0] || 'Request failed' }
      return { success: true, data: envelope.data }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    return this.request('POST', '/auth/login', { email, password })
  }

  async logout() {
    return this.request('POST', '/auth/logout')
  }

  // Exchange the current valid JWT (sent as HttpOnly cookie) for a new one.
  // Returns { success, data: { tokenExpiresAt } } using the compat wrapper.
  async refreshToken(): Promise<CompatResponse<{ tokenExpiresAt: number }>> {
    return this.post<{ tokenExpiresAt: number }>('/auth/refresh')
  }

  // ── Tenants ───────────────────────────────────────────────────────────────

  async getTenants(page = 1, limit = 10) {
    return this.request<any>('GET', `/tenants?page=${page}&limit=${limit}`)
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

  async getTenantStats(): Promise<CompatResponse<TenantStats>> {
    return this.get<TenantStats>('/tenants/stats')
  }

  // ── Billing ───────────────────────────────────────────────────────────────

  async getBillingMetrics() {
    return this.request('GET', '/billing/metrics')
  }

  async getBillingLedger(limit = 50, offset = 0) {
    return this.request('GET', `/billing/ledger?limit=${limit}&offset=${offset}`)
  }

  async getCommissions() {
    return this.request('GET', '/billing/commissions')
  }

  async getBillingData(): Promise<CompatResponse<BillingData>> {
    return this.get<BillingData>('/billing')
  }

  // ── Health ────────────────────────────────────────────────────────────────

  async getHealthStatus() {
    return this.request('GET', '/health/status')
  }

  async getHealthMetrics(hours = 24) {
    return this.request('GET', `/health/metrics?hours=${hours}`)
  }

  async getHealthAlerts() {
    return this.get<Array<{ id: string | number; severity: string; message: string; time: string }>>('/health/alerts')
  }

  async getServiceStatus(): Promise<CompatResponse<ServiceStatus[]>> {
    return this.get<ServiceStatus[]>('/health/services')
  }

  async getSystemMetrics(): Promise<CompatResponse<SystemMetrics[]>> {
    return this.get<SystemMetrics[]>('/health/metrics')
  }

  // ── Modules ───────────────────────────────────────────────────────────────

  async getModules() {
    return this.request('GET', '/modules')
  }

  async enableModule(id: string) {
    return this.request('POST', `/modules/${id}/enable`)
  }

  async disableModule(id: string) {
    return this.request('POST', `/modules/${id}/disable`)
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

  async getAuditLog(page = 1, limit = 50, search?: string, action?: string) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.set('search', search)
    if (action && action !== 'ALL') params.set('action', action)
    return this.get(`/audit-log?${params.toString()}`)
  }

  async getMe() {
    return this.get<{ id: string; email: string; name: string; role: string; permissions: string[]; avatar?: string; createdAt: string; twoFactorEnabled?: boolean; tokenExpiresAt?: number }>('/auth/me')
  }

  async get2faStatus() {
    return this.get<{ enabled: boolean }>('/auth/2fa/status')
  }

  // ── Feature Flags ─────────────────────────────────────────────────────────

  async getFeatureFlags(tenantId: string) {
    return this.get<{
      tenant_id: string
      tier: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'
      flags: {
        advanced_analytics: boolean
        ai_recommendations: boolean
        multi_currency: boolean
        offline_mode: boolean
      }
      quotas: {
        api_requests_per_day: number
        max_users: number
        max_storage_mb: number
        ai_tokens_per_month: number
      }
      updated_at?: string
      updated_by?: string
      is_default: boolean
    }>(`/feature-flags/${tenantId}`)
  }

  async setFeatureFlags(
    tenantId: string,
    data: {
      tier: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'
      flags: {
        advanced_analytics: boolean
        ai_recommendations: boolean
        multi_currency: boolean
        offline_mode: boolean
      }
      quotas: {
        api_requests_per_day: number
        max_users: number
        max_storage_mb: number
        ai_tokens_per_month: number
      }
    }
  ) {
    return this.put(`/feature-flags/${tenantId}`, data)
  }

  async resetFeatureFlags(tenantId: string) {
    return this.delete(`/feature-flags/${tenantId}`)
  }

  // ── AI Usage ──────────────────────────────────────────────────────────────

  async getAIUsage(period = '30d') {
    return this.get(`/ai/usage?period=${period}`)
  }

  // ── Fraud Alerts ──────────────────────────────────────────────────────────

  async getFraudAlerts(status?: string, severity?: string) {
    const params = new URLSearchParams()
    if (status && status !== 'all') params.set('status', status)
    if (severity && severity !== 'all') params.set('severity', severity)
    return this.get(`/fraud/alerts?${params.toString()}`)
  }

  async dismissFraudAlert(id: string) {
    return this.post(`/fraud/alerts/${id}/dismiss`, {})
  }

  async resolveFraudAlert(id: string) {
    return this.post(`/fraud/alerts/${id}/resolve`, {})
  }

  // ── KYC ───────────────────────────────────────────────────────────────────

  async getKYCQueue(status?: string) {
    const params = new URLSearchParams()
    if (status && status !== 'all') params.set('status', status)
    return this.get(`/kyc/queue?${params.toString()}`)
  }

  async approveKYC(id: string) {
    return this.post(`/kyc/${id}/approve`, {})
  }

  async rejectKYC(id: string, reason: string) {
    return this.post(`/kyc/${id}/reject`, { reason })
  }

  // ── Billing Plans ─────────────────────────────────────────────────────────

  async getBillingPlans() {
    return this.get('/billing/plans')
  }

  async createBillingPlan(data: unknown) {
    return this.post('/billing/plans', data)
  }

  async updateBillingPlan(id: string, data: unknown) {
    return this.put(`/billing/plans/${id}`, data)
  }

  async deleteBillingPlan(id: string) {
    return this.delete(`/billing/plans/${id}`)
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  async getNotificationHistory() {
    return this.get('/notifications/history')
  }

  async sendBulkNotification(data: unknown) {
    return this.post('/notifications/bulk', data)
  }

  // ── Custom Domains ────────────────────────────────────────────────────────

  async getCustomDomains(status?: string) {
    const params = new URLSearchParams()
    if (status && status !== 'all') params.set('status', status)
    return this.get(`/domains?${params.toString()}`)
  }

  async approveDomain(id: string) {
    return this.post(`/domains/${id}/approve`, {})
  }

  async rejectDomain(id: string, reason?: string) {
    return this.post(`/domains/${id}/reject`, { reason })
  }

  async verifyDomain(id: string) {
    return this.post(`/domains/${id}/verify`, {})
  }

  // ── Data Exports ──────────────────────────────────────────────────────────

  async getExports() {
    return this.get('/exports')
  }

  async createExport(data: unknown) {
    return this.post('/exports', data)
  }

  // ── RBAC ──────────────────────────────────────────────────────────────────

  async getRoles() {
    return this.get('/rbac/roles')
  }

  async createRole(data: unknown) {
    return this.post('/rbac/roles', data)
  }

  async updateRole(id: string, data: unknown) {
    return this.put(`/rbac/roles/${id}`, data)
  }

  async deleteRole(id: string) {
    return this.delete(`/rbac/roles/${id}`)
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  async getWebhooks(status?: string) {
    const params = new URLSearchParams()
    if (status && status !== 'all') params.set('status', status)
    return this.get(`/webhooks?${params.toString()}`)
  }

  async getWebhookDeliveries(webhookId: string) {
    return this.get(`/webhooks/${webhookId}/deliveries`)
  }

  async retryWebhookDelivery(deliveryId: string) {
    return this.post(`/webhooks/deliveries/${deliveryId}/retry`, {})
  }

  async deleteWebhook(id: string) {
    return this.delete(`/webhooks/${id}`)
  }

  // ── Platform Config ───────────────────────────────────────────────────────

  async getPlatformConfig() {
    return this.get('/platform/config')
  }

  async updatePlatformConfig(data: unknown) {
    return this.put('/platform/config', data)
  }

  // ── Inactive Tenants ──────────────────────────────────────────────────────

  async getInactiveTenants(days = 90) {
    return this.get(`/tenants/inactive?days=${days}`)
  }

  async bulkArchiveTenants(ids: string[]) {
    return this.post('/tenants/bulk-archive', { ids })
  }

  async bulkNotifyInactiveTenants(ids: string[]) {
    return this.post('/tenants/bulk-notify-inactive', { ids })
  }

  // ── Tenant Impersonation ──────────────────────────────────────────────────

  async impersonateTenant(tenantId: string, reason: string) {
    return this.post(`/tenants/${tenantId}/impersonate`, { reason })
  }

  async getImpersonationLogs() {
    return this.get('/tenants/impersonation/logs')
  }

  // ── Tenant Provisioning ───────────────────────────────────────────────────

  async provisionTenant(data: unknown) {
    return this.post('/tenants/provision', data)
  }

  // ── Tenant Suspension ─────────────────────────────────────────────────────

  async suspendTenant(tenantId: string) {
    return this.post(`/tenants/${tenantId}/suspend`, {})
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────
  // The browser automatically includes the HttpOnly auth cookie on WebSocket
  // connections to the same domain — no token parameter needed.

  connectWebSocket(
    endpoint: string,
    onMessage: (data: any) => void,
    onError?: (error: Event) => void
  ): WebSocket {
    const wsUrl = `${this.baseUrl.replace('http', 'ws')}${endpoint}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log(`WebSocket connected to ${endpoint}`)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      if (onError) onError(error)
    }

    ws.onclose = () => {
      console.log(`WebSocket disconnected from ${endpoint}`)
    }

    return ws
  }

  // ── Audit Trail ───────────────────────────────────────────────────────────
  // Fire-and-forget: a failure to write the audit entry must never block the
  // primary operation. Callers do not await this method.

  logAuditEvent(action: string, resourceType: string, resourceId?: string): void {
    const userId = this.userId || 'unknown'
    this.post('/settings/audit-log', {
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId ?? null,
    }).catch(() => {
      // Swallow silently — audit log failure must not surface to users
    })
  }
}

export const apiClient = new ApiClient()
