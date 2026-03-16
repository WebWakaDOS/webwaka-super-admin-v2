import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'

export interface UseApiOptions {
  skip?: boolean
  refetchInterval?: number
  onError?: (error: Error) => void
}

export function useApi<T>(
  fetchFn: () => Promise<T>,
  options: UseApiOptions = {}
): {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
} {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!options.skip)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    if (options.skip) return

    setLoading(true)
    try {
      const result = await fetchFn()
      setData(result)
      setError(null)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      options.onError?.(error)
    } finally {
      setLoading(false)
    }
  }, [fetchFn, options])

  useEffect(() => {
    fetch()

    if (options.refetchInterval) {
      const interval = setInterval(fetch, options.refetchInterval)
      return () => clearInterval(interval)
    }
  }, [fetch, options.refetchInterval])

  return { data, loading, error, refetch: fetch }
}

// Specific hooks for each API resource

export function useTenants() {
  return useApi(() => apiClient.getTenants())
}

export function useTenant(id: string) {
  return useApi(() => apiClient.getTenant(id), { skip: !id })
}

export function useBillingMetrics() {
  return useApi(() => apiClient.getBillingMetrics(), {
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}

export function useBillingLedger(limit = 50, offset = 0) {
  return useApi(() => apiClient.getBillingLedger(limit, offset))
}

export function useCommissions() {
  return useApi(() => apiClient.getCommissions(), {
    refetchInterval: 60000, // Refetch every 60 seconds
  })
}

export function useModules() {
  return useApi(() => apiClient.getModules())
}

export function useHealthStatus() {
  return useApi(() => apiClient.getHealthStatus(), {
    refetchInterval: 10000, // Refetch every 10 seconds
  })
}

export function useHealthMetrics(hours = 24) {
  return useApi(() => apiClient.getHealthMetrics(hours), {
    refetchInterval: 60000, // Refetch every 60 seconds
  })
}

export function useHealthAlerts() {
  return useApi(() => apiClient.getHealthAlerts(), {
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}

export function useSettings() {
  return useApi(() => apiClient.getSettings())
}

export function useApiKeys() {
  return useApi(() => apiClient.getApiKeys())
}

export function useAuditLog(limit = 50, offset = 0) {
  return useApi(() => apiClient.getAuditLog(limit, offset))
}
