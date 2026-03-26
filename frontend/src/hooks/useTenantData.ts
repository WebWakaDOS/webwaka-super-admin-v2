import { useState, useEffect, useRef } from 'react';
import { apiClient, TenantStats } from '@/lib/api-client';

interface TenantState {
  stats: TenantStats | null;
  tenants: any[];
  loading: boolean;
  error: string | null;
  page: number;
  total: number;
}

export function useTenantData(autoRefresh: boolean = true, refreshInterval: number = 45000) {
  const [state, setState] = useState<TenantState>({
    stats: null,
    tenants: [],
    loading: true,
    error: null,
    page: 1,
    total: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch tenant data from API
  const fetchTenantData = async (page: number = 1) => {
    try {
      const [statsRes, tenantsRes] = await Promise.all([
        apiClient.getTenantStats(),
        apiClient.getTenants(page, 10),
      ]);

      if (statsRes.success && tenantsRes.success) {
        setState((prev) => ({
          ...prev,
          stats: statsRes.data || null,
          tenants: tenantsRes.data?.tenants || [],
          total: tenantsRes.data?.total || 0,
          page: tenantsRes.data?.page || 1,
          loading: false,
          error: null,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          error: statsRes.error || tenantsRes.error || 'Failed to fetch tenant data',
          loading: false,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      }));
    }
  };

  // Connect to WebSocket for real-time updates
  const connectWebSocket = () => {
    try {
      wsRef.current = apiClient.connectWebSocket(
        '/ws/tenants',
        (message) => {
          if (message.type === 'tenant_stats') {
            setState((prev) => ({
              ...prev,
              stats: message.data,
            }));
          } else if (message.type === 'tenant_created' || message.type === 'tenant_updated') {
            // Refresh tenants list on changes
            fetchTenantData(state.page);
          }
        },
        () => {
          // Fallback to polling on WebSocket error
          console.warn('Tenant WebSocket failed, falling back to polling');
          if (autoRefresh && !intervalRef.current) {
            intervalRef.current = setInterval(() => fetchTenantData(state.page), refreshInterval);
          }
        }
      );
    } catch (error) {
      console.error('Failed to connect tenant WebSocket:', error);
      // Fallback to polling
      if (autoRefresh && !intervalRef.current) {
        intervalRef.current = setInterval(() => fetchTenantData(state.page), refreshInterval);
      }
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchTenantData(1);

    // Setup auto-refresh
    if (autoRefresh) {
      // Try WebSocket first
      connectWebSocket();

      // Fallback polling if WebSocket doesn't work
      const pollTimeout = setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          intervalRef.current = setInterval(() => fetchTenantData(state.page), refreshInterval);
        }
      }, 5000);

      return () => {
        clearTimeout(pollTimeout);
        if (wsRef.current) {
          wsRef.current.close();
        }
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [autoRefresh, refreshInterval]);

  const goToPage = (page: number) => {
    fetchTenantData(page);
  };

  return { ...state, goToPage };
}
