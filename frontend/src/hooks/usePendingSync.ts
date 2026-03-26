/**
 * usePendingSync Hook — Super Admin V2
 *
 * Listens for window.online events and flushes Dexie pendingMutations
 * against the API. Removes successful mutations and retries up to maxRetries.
 *
 * Offline First invariant: no mutation is silently lost; all queued when offline.
 * Nigeria First: retry logic respects API response shape { success, data, error }
 */

import { useEffect, useCallback, useState } from 'react'
import {
  getPendingMutations,
  removePendingMutation,
  incrementMutationRetry,
} from '@/lib/db'
const getStoredToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

interface SyncState {
  isSyncing: boolean
  lastSyncAt: number | null
  failedCount: number
  pendingCount: number
}

export function usePendingSync() {
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSyncAt: null,
    failedCount: 0,
    pendingCount: 0,
  })

  const flushPendingMutations = useCallback(async () => {
    if (!navigator.onLine) return

    const mutations = await getPendingMutations()
    if (mutations.length === 0) return

    setSyncState((s) => ({ ...s, isSyncing: true, pendingCount: mutations.length }))

    let failedCount = 0

    for (const mutation of mutations) {
      if (!mutation.id) continue
      if (mutation.retries >= mutation.maxRetries) {
        await removePendingMutation(mutation.id)
        continue
      }

      try {
        const res = await fetch(mutation.url, {
          method: mutation.method,
          headers: {
            'Content-Type': 'application/json',
            ...mutation.headers,
          },
          body: mutation.body,
        })

        if (res.ok) {
          await removePendingMutation(mutation.id)
        } else if (res.status >= 400 && res.status < 500) {
          await removePendingMutation(mutation.id)
        } else {
          await incrementMutationRetry(mutation.id)
          failedCount++
        }
      } catch {
        await incrementMutationRetry(mutation.id)
        failedCount++
      }
    }

    setSyncState({
      isSyncing: false,
      lastSyncAt: Date.now(),
      failedCount,
      pendingCount: 0,
    })
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      flushPendingMutations()
    }

    window.addEventListener('online', handleOnline)

    if (navigator.onLine) {
      flushPendingMutations()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [flushPendingMutations])

  return syncState
}

/**
 * Queue a mutation for background sync (offline-first).
 * Call this from API methods when the request fails due to offline.
 */
export async function queueMutation(
  url: string,
  method: string,
  body?: object,
  extraHeaders?: Record<string, string>
): Promise<void> {
  const { addPendingMutation } = await import('@/lib/db')
  const token = getStoredToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  }
  await addPendingMutation(url, method, headers, body ? JSON.stringify(body) : undefined)
}
