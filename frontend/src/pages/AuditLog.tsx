import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { apiClient } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ClipboardList, Search, ChevronLeft, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react'

interface AuditEntry {
  id: string
  user_id: string
  action: string
  resource_type: string
  resource_id?: string
  ip_address?: string
  created_at: string
}

interface PaginationMeta {
  page: number
  limit: number
  total: number
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-purple-100 text-purple-800',
  LOGOUT: 'bg-gray-100 text-gray-800',
  SUSPEND: 'bg-amber-100 text-amber-800',
  ACTIVATE: 'bg-emerald-100 text-emerald-800',
}

function getActionColor(action: string): string {
  for (const [key, value] of Object.entries(ACTION_COLORS)) {
    if (action.toUpperCase().includes(key)) return value
  }
  return 'bg-gray-100 text-gray-700'
}

export default function AuditLog() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 50, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchAuditLog = useCallback(async (page: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.getAuditLog(page, 50)
      if (res.success && res.data) {
        const data = res.data as { entries: AuditEntry[]; pagination: PaginationMeta }
        setEntries(data.entries || [])
        setPagination(data.pagination || { page, limit: 50, total: 0 })
      } else {
        setError(res.error || 'Failed to load audit log')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAuditLog(1)
  }, [fetchAuditLog])

  const filtered = debouncedSearch
    ? entries.filter(
        (e) =>
          e.action.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          e.resource_type.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          e.user_id.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          (e.ip_address || '').includes(debouncedSearch)
      )
    : entries

  const totalPages = Math.ceil(pagination.total / pagination.limit)

  return (
    <div className="space-y-6 p-6" role="main">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold">{t('nav.auditLog')}</h1>
            <p className="text-sm text-muted-foreground">
              All sensitive operations across the platform
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchAuditLog(pagination.page)}
          disabled={loading}
          aria-label="Refresh audit log"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          placeholder="Filter by action, resource, user…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Search audit log"
        />
      </div>

      {/* Error state */}
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {loading ? 'Loading…' : `${filtered.length} of ${pagination.total} entries`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Audit log entries">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th scope="col" className="px-4 py-3 font-semibold">Time</th>
                  <th scope="col" className="px-4 py-3 font-semibold">User</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Action</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Resource</th>
                  <th scope="col" className="px-4 py-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      No audit entries found{debouncedSearch ? ` matching "${debouncedSearch}"` : ''}
                    </td>
                  </tr>
                ) : (
                  filtered.map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs truncate max-w-[140px]" title={entry.user_id}>
                        {entry.user_id}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${getActionColor(entry.action)}`}>
                          {entry.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-medium">{entry.resource_type}</span>
                        {entry.resource_id && (
                          <span className="ml-1 font-mono text-muted-foreground text-[10px]">
                            #{entry.resource_id.slice(0, 8)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {entry.ip_address || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && !debouncedSearch && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchAuditLog(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchAuditLog(pagination.page + 1)}
                  disabled={pagination.page >= totalPages || loading}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
