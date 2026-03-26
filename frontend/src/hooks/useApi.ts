import { useState, useEffect, useCallback, useRef } from 'react'
import { apiClient } from '@/lib/api'
import { getCacheData, setCacheData } from '@/lib/db'

export interface UseApiOptions {
  skip?: boolean
  refetchInterval?: number
  onError?: (error: Error) => void
  cacheKey?: string
  cacheTtl?: number
}

export function useApi<T>(
  fetchFn: () => Promise<T>,
  options: UseApiOptions = {}
): {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  isStale: boolean
} {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!options.skip)
  const [error, setError] = useState<Error | null>(null)
  const [isStale, setIsStale] = useState(false)
  const fetchFnRef = useRef(fetchFn)
  fetchFnRef.current = fetchFn

  const fetch = useCallback(async () => {
    if (options.skip) return

    const cacheKey = options.cacheKey
    const cacheTtl = options.cacheTtl ?? 60

    // SWR: serve stale data from Dexie cache while fetching fresh data
    if (cacheKey) {
      try {
        const cached = await getCacheData(cacheKey)
        if (cached !== undefined) {
          setData(cached as T)
          setIsStale(true)
          setLoading(false)
        }
      } catch {
        // Cache read failure is non-fatal
      }
    }

    if (!isStale) setLoading(true)

    try {
      const result = await fetchFnRef.current()
      setData(result)
      setIsStale(false)
      setError(null)
      // Write fresh data back to Dexie cache
      if (cacheKey) {
        setCacheData(cacheKey, result, cacheTtl).catch(() => {})
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      setError(e)
      options.onError?.(e)
    } finally {
      setLoading(false)
    }
  }, [options.skip, options.cacheKey, options.cacheTtl])

  useEffect(() => {
    fetch()

    if (options.refetchInterval) {
      const interval = setInterval(fetch, options.refetchInterval)
      return () => clearInterval(interval)
    }
  }, [fetch, options.refetchInterval])

  return { data, loading, error, refetch: fetch, isStale }
}

export function useTenants() {
  return useApi(() => apiClient.getTenants(), {
    cacheKey: 'tenants:list',
    cacheTtl: 30,
  })
}

export function useTenant(id: string) {
  return useApi(() => apiClient.getTenant(id), {
    skip: !id,
    cacheKey: `tenants:${id}`,
    cacheTtl: 60,
  })
}

export function useBillingMetrics() {
  return useApi(() => apiClient.getBillingMetrics(), {
    refetchInterval: 30000,
    cacheKey: 'billing:metrics',
    cacheTtl: 30,
  })
}

export function useBillingLedger(limit = 50, offset = 0) {
  return useApi(() => apiClient.getBillingLedger(limit, offset), {
    cacheKey: `billing:ledger:${limit}:${offset}`,
    cacheTtl: 20,
  })
}

export function useCommissions() {
  return useApi(() => apiClient.getCommissions(), {
    refetchInterval: 60000,
    cacheKey: 'billing:commissions',
    cacheTtl: 60,
  })
}

export function useModules() {
  return useApi(() => apiClient.getModules(), {
    cacheKey: 'modules:list',
    cacheTtl: 120,
  })
}

export function useHealthStatus() {
  return useApi(() => apiClient.getHealthStatus(), {
    refetchInterval: 10000,
    cacheKey: 'health:status',
    cacheTtl: 10,
  })
}

export function useHealthMetrics(hours = 24) {
  return useApi(() => apiClient.getHealthMetrics(hours), {
    refetchInterval: 60000,
    cacheKey: `health:metrics:${hours}h`,
    cacheTtl: 60,
  })
}

export function useHealthAlerts() {
  return useApi(() => apiClient.getHealthAlerts(), {
    refetchInterval: 30000,
    cacheKey: 'health:alerts',
    cacheTtl: 30,
  })
}

export function useSettings() {
  return useApi(() => apiClient.getSettings(), {
    cacheKey: 'settings',
    cacheTtl: 300,
  })
}

export function useApiKeys() {
  return useApi(() => apiClient.getApiKeys(), {
    cacheKey: 'settings:apikeys',
    cacheTtl: 120,
  })
}

export function useAuditLog(limit = 50, offset = 0) {
  return useApi(() => apiClient.getAuditLog(limit, offset), {
    cacheKey: `auditlog:${limit}:${offset}`,
    cacheTtl: 15,
  })
}
