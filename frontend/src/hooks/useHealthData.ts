import { useState, useEffect, useRef } from 'react';
import { apiClient, ServiceStatus, SystemMetrics } from '@/lib/api';

interface HealthData {
  services: ServiceStatus[];
  metrics: SystemMetrics[];
  loading: boolean;
  error: string | null;
}

export function useHealthData(autoRefresh: boolean = true, refreshInterval: number = 30000) {
  const [data, setData] = useState<HealthData>({
    services: [],
    metrics: [],
    loading: true,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch health data from API
  const fetchHealthData = async () => {
    try {
      const [servicesRes, metricsRes] = await Promise.all([
        apiClient.getServiceStatus(),
        apiClient.getSystemMetrics(),
      ]);

      if (servicesRes.success && metricsRes.success) {
        setData({
          services: servicesRes.data || [],
          metrics: metricsRes.data || [],
          loading: false,
          error: null,
        });
      } else {
        setData((prev) => ({
          ...prev,
          error: servicesRes.error || metricsRes.error || 'Failed to fetch health data',
          loading: false,
        }));
      }
    } catch (error) {
      setData((prev) => ({
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
        '/ws/health',
        (message) => {
          if (message.type === 'service_status') {
            setData((prev) => ({
              ...prev,
              services: message.data,
            }));
          } else if (message.type === 'metrics') {
            setData((prev) => ({
              ...prev,
              metrics: [...prev.metrics.slice(-59), message.data],
            }));
          }
        },
        () => {
          // Fallback to polling on WebSocket error
          console.warn('WebSocket failed, falling back to polling');
          if (autoRefresh && !intervalRef.current) {
            intervalRef.current = setInterval(fetchHealthData, refreshInterval);
          }
        }
      );
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      // Fallback to polling
      if (autoRefresh && !intervalRef.current) {
        intervalRef.current = setInterval(fetchHealthData, refreshInterval);
      }
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchHealthData();

    // Setup auto-refresh
    if (autoRefresh) {
      // Try WebSocket first
      connectWebSocket();

      // Fallback polling if WebSocket doesn't work
      const pollTimeout = setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          intervalRef.current = setInterval(fetchHealthData, refreshInterval);
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

  return data;
}
