/**
 * API Client for Cloudflare Workers Integration
 * Handles all communication with backend services
 */

const API_BASE_URL = import.meta.env.VITE_FRONTEND_FORGE_API_URL || 'http://localhost:8787';
const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY || 'dev-key';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  responseTime: number;
  lastChecked: string;
}

interface SystemMetrics {
  timestamp: string;
  cpu: number;
  memory: number;
  diskUsage: number;
  requests: number;
}

interface TenantStats {
  totalTenants: number;
  activeTenants: number;
  totalRevenue: number;
  monthlyRecurring: number;
}

interface BillingData {
  totalRevenue: number;
  activeSubscriptions: number;
  pendingPayouts: number;
  commissionEarned: number;
}

class ApiClient {
  private baseUrl: string;
  private apiKey: string;
  private headers: HeadersInit;

  constructor(baseUrl: string = API_BASE_URL, apiKey: string = API_KEY) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * System Health Endpoints
   */

  async getServiceStatus(): Promise<ApiResponse<ServiceStatus[]>> {
    return this.request<ServiceStatus[]>('/api/health/services');
  }

  async getSystemMetrics(): Promise<ApiResponse<SystemMetrics[]>> {
    return this.request<SystemMetrics[]>('/api/health/metrics');
  }

  async getSystemHealth(): Promise<ApiResponse<{
    status: string;
    uptime: number;
    services: ServiceStatus[];
    metrics: SystemMetrics;
  }>> {
    return this.request('/api/health');
  }

  /**
   * Tenant Endpoints
   */

  async getTenantStats(): Promise<ApiResponse<TenantStats>> {
    return this.request<TenantStats>('/api/tenants/stats');
  }

  async getTenants(page: number = 1, limit: number = 10): Promise<ApiResponse<{
    tenants: any[];
    total: number;
    page: number;
    limit: number;
  }>> {
    return this.request(`/api/tenants?page=${page}&limit=${limit}`);
  }

  async getTenant(id: string): Promise<ApiResponse<any>> {
    return this.request(`/api/tenants/${id}`);
  }

  async createTenant(data: any): Promise<ApiResponse<any>> {
    return this.request('/api/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTenant(id: string, data: any): Promise<ApiResponse<any>> {
    return this.request(`/api/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTenant(id: string): Promise<ApiResponse<void>> {
    return this.request(`/api/tenants/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Billing Endpoints
   */

  async getBillingData(): Promise<ApiResponse<BillingData>> {
    return this.request<BillingData>('/api/billing');
  }

  async getTransactionLedger(page: number = 1, limit: number = 20): Promise<ApiResponse<{
    transactions: any[];
    total: number;
    page: number;
    limit: number;
  }>> {
    return this.request(`/api/billing/ledger?page=${page}&limit=${limit}`);
  }

  async getCommissionData(): Promise<ApiResponse<{
    totalCommission: number;
    pendingCommission: number;
    paidCommission: number;
    commissionRate: number;
  }>> {
    return this.request('/api/billing/commission');
  }

  /**
   * Module Endpoints
   */

  async getModules(): Promise<ApiResponse<any[]>> {
    return this.request('/api/modules');
  }

  async getModule(id: string): Promise<ApiResponse<any>> {
    return this.request(`/api/modules/${id}`);
  }

  async getFeatureFlags(): Promise<ApiResponse<any[]>> {
    return this.request('/api/modules/flags');
  }

  async updateFeatureFlag(id: string, data: any): Promise<ApiResponse<any>> {
    return this.request(`/api/modules/flags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Settings Endpoints
   */

  async getSettings(): Promise<ApiResponse<any[]>> {
    return this.request('/api/settings');
  }

  async updateSettings(data: any): Promise<ApiResponse<any>> {
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getApiKeys(): Promise<ApiResponse<any[]>> {
    return this.request('/api/settings/api-keys');
  }

  async createApiKey(name: string): Promise<ApiResponse<any>> {
    return this.request('/api/settings/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deleteApiKey(id: string): Promise<ApiResponse<void>> {
    return this.request(`/api/settings/api-keys/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * WebSocket for Real-time Updates
   */

  connectWebSocket(endpoint: string, onMessage: (data: any) => void, onError?: (error: Event) => void): WebSocket {
    const wsUrl = `${this.baseUrl.replace('http', 'ws')}${endpoint}?token=${this.apiKey}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`WebSocket connected to ${endpoint}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (onError) onError(error);
    };

    ws.onclose = () => {
      console.log(`WebSocket disconnected from ${endpoint}`);
    };

    return ws;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export types
export type { ApiResponse, ServiceStatus, SystemMetrics, TenantStats, BillingData };
