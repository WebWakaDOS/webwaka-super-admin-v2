// API client for Hono Workers backend
const API_BASE = import.meta.env.DEV ? 'http://localhost:8787' : 'https://webwaka-super-admin-api.webwaka.workers.dev'

export interface ApiResponse<T> {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

export class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl
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

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Auth
  async login(email: string, password: string) {
    return this.request('/auth/login', 'POST', { email, password })
  }

  async logout() {
    return this.request('/auth/logout', 'POST')
  }

  // Tenants
  async getTenants() {
    return this.request('/tenants', 'GET')
  }

  async getTenant(id: string) {
    return this.request(`/tenants/${id}`, 'GET')
  }

  async createTenant(data: unknown) {
    return this.request('/tenants', 'POST', data)
  }

  async updateTenant(id: string, data: unknown) {
    return this.request(`/tenants/${id}`, 'PUT', data)
  }

  async deleteTenant(id: string) {
    return this.request(`/tenants/${id}`, 'DELETE')
  }

  // Billing
  async getBillingMetrics() {
    return this.request('/billing/metrics', 'GET')
  }

  async getBillingLedger(limit = 50, offset = 0) {
    return this.request(`/billing/ledger?limit=${limit}&offset=${offset}`, 'GET')
  }

  async getCommissions() {
    return this.request('/billing/commissions', 'GET')
  }

  // Modules
  async getModules() {
    return this.request('/modules', 'GET')
  }

  async enableModule(id: string) {
    return this.request(`/modules/${id}/enable`, 'POST')
  }

  async disableModule(id: string) {
    return this.request(`/modules/${id}/disable`, 'POST')
  }

  // Health
  async getHealthStatus() {
    return this.request('/health/status', 'GET')
  }

  async getHealthMetrics(hours = 24) {
    return this.request(`/health/metrics?hours=${hours}`, 'GET')
  }

  async getHealthAlerts() {
    return this.request('/health/alerts', 'GET')
  }

  // Settings
  async getSettings() {
    return this.request('/settings', 'GET')
  }

  async updateSettings(data: unknown) {
    return this.request('/settings', 'PUT', data)
  }

  async getApiKeys() {
    return this.request('/settings/api-keys', 'GET')
  }

  async createApiKey(name: string) {
    return this.request('/settings/api-keys', 'POST', { name })
  }

  async deleteApiKey(id: string) {
    return this.request(`/settings/api-keys/${id}`, 'DELETE')
  }

  async getAuditLog(limit = 50, offset = 0) {
    return this.request(`/settings/audit-log?limit=${limit}&offset=${offset}`, 'GET')
  }
}

export const apiClient = new ApiClient()
