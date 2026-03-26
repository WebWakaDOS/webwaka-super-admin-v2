import { useState, useEffect, useRef } from 'react';
import { apiClient, BillingData } from '@/lib/api-client';

interface BillingState {
  data: BillingData | null;
  loading: boolean;
  error: string | null;
}

export function useBillingData(autoRefresh: boolean = true, refreshInterval: number = 60000) {
  const [state, setState] = useState<BillingState>({
    data: null,
    loading: true,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch billing data from API
  const fetchBillingData = async () => {
    try {
      const response = await apiClient.getBillingData();

      if (response.success && response.data) {
        setState({
          data: response.data,
          loading: false,
          error: null,
        });
      } else {
        setState((prev) => ({
          ...prev,
          error: response.error || 'Failed to fetch billing data',
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
        '/ws/billing',
        (message) => {
          if (message.type === 'billing_update') {
            setState((prev) => ({
              ...prev,
              data: message.data,
            }));
          }
        },
        () => {
          // Fallback to polling on WebSocket error
          console.warn('Billing WebSocket failed, falling back to polling');
          if (autoRefresh && !intervalRef.current) {
            intervalRef.current = setInterval(fetchBillingData, refreshInterval);
          }
        }
      );
    } catch (error) {
      console.error('Failed to connect billing WebSocket:', error);
      // Fallback to polling
      if (autoRefresh && !intervalRef.current) {
        intervalRef.current = setInterval(fetchBillingData, refreshInterval);
      }
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchBillingData();

    // Setup auto-refresh
    if (autoRefresh) {
      // Try WebSocket first
      connectWebSocket();

      // Fallback polling if WebSocket doesn't work
      const pollTimeout = setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          intervalRef.current = setInterval(fetchBillingData, refreshInterval);
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

  return state;
}
