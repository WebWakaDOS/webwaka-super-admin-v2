// API client for Hono Workers backend
// Evaluate API base at runtime to ensure correct endpoint is used
function getAPIBase() {
  if (typeof window === 'undefined') {
    return 'https://webwaka-super-admin-api.webwaka.workers.dev'
  }
  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  return isLocalhost ? 'http://localhost:8787' : 'https://webwaka-super-admin-api.webwaka.workers.dev'
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
  private token: string | null = null

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl || getAPIBase()
    this.token = localStorage.getItem('auth_token')
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

  // Core request — throws ApiError on non-OK responses.
  // 401/403 dispatches auth:session-expired before throwing.
  private async request<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
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
      const message = error.error || error.message || `HTTP ${response.status}`
      if (response.status === 401 || response.status === 403) {
        this.token = null
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
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

  // Exchange the current valid JWT for a fresh one before it expires.
  // Returns { success, data: { token } } using the compat wrapper.
  async refreshToken(): Promise<CompatResponse<{ token: string }>> {
    return this.post<{ token: string }>('/auth/refresh')
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
    return this.request('GET', '/health/alerts')
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

  async getAuditLog(page = 1, limit = 50) {
    return this.get(`/audit-log?page=${page}&limit=${limit}`)
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────
  // Uses the JWT token (not a hardcoded API key) for authentication.

  connectWebSocket(
    endpoint: string,
    onMessage: (data: any) => void,
    onError?: (error: Event) => void
  ): WebSocket {
    const wsUrl = `${this.baseUrl.replace('http', 'ws')}${endpoint}?token=${this.token || ''}`
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
}

export const apiClient = new ApiClient()
