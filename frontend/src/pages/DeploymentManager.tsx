/**
 * DeploymentManager Page — Super Admin V2
 * Monitor and manage Cloudflare Workers + Pages deployments
 * Compliance: Build Once Use Infinitely, Mobile First
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw, CheckCircle2, XCircle, Clock, GitBranch, Globe } from 'lucide-react'
import { apiClient } from '@/lib/api-client'

// ============================================================================
// TYPES
// ============================================================================

type DeploymentStatus = 'PENDING' | 'LIVE' | 'FAILED' | 'UNKNOWN'
type PipelineStatus = 'SUCCESS' | 'FAILURE' | 'IN_PROGRESS' | 'UNKNOWN'
type EnvironmentType = 'STAGING' | 'PRODUCTION'

interface Deployment {
  id: string
  tenant_id: string
  suite: string
  environment: EnvironmentType
  worker_name?: string
  worker_url?: string
  worker_status: DeploymentStatus
  worker_last_deployed_at?: string
  pages_project?: string
  pages_url?: string
  pages_status: DeploymentStatus
  pages_last_deployed_at?: string
  d1_migrated: 0 | 1
  github_repo?: string
  github_branch?: string
  last_commit_sha?: string
  last_pipeline_status: PipelineStatus
  last_pipeline_at?: string
  updated_at: string
}

// ============================================================================
// HELPERS
// ============================================================================

function StatusIcon({ status }: { status: DeploymentStatus | PipelineStatus }) {
  switch (status) {
    case 'LIVE':
    case 'SUCCESS':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'FAILED':
    case 'FAILURE':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'IN_PROGRESS':
    case 'PENDING':
      return <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
    default:
      return <Clock className="h-4 w-4 text-gray-400" />
  }
}

function statusBadgeVariant(status: DeploymentStatus | PipelineStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'LIVE':
    case 'SUCCESS':
      return 'default'
    case 'PENDING':
    case 'IN_PROGRESS':
      return 'secondary'
    case 'FAILED':
    case 'FAILURE':
      return 'destructive'
    default:
      return 'outline'
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleString('en-NG', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const SUITE_COLORS: Record<string, string> = {
  civic: 'bg-blue-100 text-blue-800',
  commerce: 'bg-green-100 text-green-800',
  transport: 'bg-amber-100 text-amber-800',
  fintech: 'bg-purple-100 text-purple-800',
  'super-admin': 'bg-gray-100 text-gray-800',
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function DeploymentManager() {
  const { t } = useTranslation()
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [filterSuite, setFilterSuite] = useState<string>('ALL')
  const [filterEnv, setFilterEnv] = useState<string>('ALL')

  const fetchDeployments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterSuite !== 'ALL') params.set('suite', filterSuite)
      if (filterEnv !== 'ALL') params.set('environment', filterEnv)
      const res = await apiClient.get<Deployment[]>(`/deployments?${params}`)
      setDeployments(Array.isArray(res.data) ? res.data : [])
    } catch (err: any) {
      setError(err.message || 'Failed to load deployments')
    } finally {
      setLoading(false)
    }
  }, [filterSuite, filterEnv])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await apiClient.post('/deployments/refresh')
    } catch (_) {}
    await fetchDeployments()
    setRefreshing(false)
  }

  useEffect(() => { fetchDeployments() }, [fetchDeployments])

  const stats = {
    total: deployments.length,
    live: deployments.filter((d) => d.worker_status === 'LIVE' && d.pages_status === 'LIVE').length,
    failed: deployments.filter((d) => d.worker_status === 'FAILED' || d.pages_status === 'FAILED').length,
    pending: deployments.filter((d) => d.last_pipeline_status === 'IN_PROGRESS').length,
  }

  return (
    <div className="space-y-6" role="main">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('deployments.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('deployments.subtitle')}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Deployments</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{stats.live}</p>
              <p className="text-sm text-muted-foreground mt-1">Fully Live</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
              <p className="text-sm text-muted-foreground mt-1">Failed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
              <p className="text-sm text-muted-foreground mt-1">In Progress</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Deployments</CardTitle>
          <CardDescription>All Workers + Pages deployments — CI/CD via GitHub Actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
            <Select value={filterSuite} onValueChange={setFilterSuite}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Suite" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Suites</SelectItem>
                <SelectItem value="civic">Civic</SelectItem>
                <SelectItem value="commerce">Commerce</SelectItem>
                <SelectItem value="transport">Transport</SelectItem>
                <SelectItem value="super-admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEnv} onValueChange={setFilterEnv}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Environments</SelectItem>
                <SelectItem value="STAGING">Staging</SelectItem>
                <SelectItem value="PRODUCTION">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm mb-4">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : deployments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No deployments found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Suite</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Worker</TableHead>
                    <TableHead>Pages</TableHead>
                    <TableHead>D1</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>GitHub</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployments.map((dep) => (
                    <TableRow key={dep.id}>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ${SUITE_COLORS[dep.suite] || 'bg-gray-100 text-gray-800'}`}>
                          {dep.suite}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={dep.environment === 'PRODUCTION' ? 'default' : 'secondary'}>
                          {dep.environment}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon status={dep.worker_status} />
                          {dep.worker_url ? (
                            <a
                              href={dep.worker_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline truncate max-w-32"
                            >
                              {dep.worker_name || 'Worker'}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">{dep.worker_status}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon status={dep.pages_status} />
                          {dep.pages_url ? (
                            <a
                              href={dep.pages_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline truncate max-w-32"
                            >
                              Pages
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">{dep.pages_status}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={dep.d1_migrated ? 'default' : 'outline'} className="text-xs">
                          {dep.d1_migrated ? '✓ Migrated' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon status={dep.last_pipeline_status} />
                          <Badge variant={statusBadgeVariant(dep.last_pipeline_status)} className="text-xs">
                            {dep.last_pipeline_status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {dep.github_repo ? (
                          <div className="flex items-center gap-1 text-xs">
                            <GitBranch className="h-3 w-3" />
                            <span className="text-muted-foreground">{dep.github_branch}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(dep.updated_at)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CI/CD Note */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <GitBranch className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900">All Deployments via GitHub CI/CD</p>
              <p className="text-sm text-blue-800 mt-1">
                All Workers and Pages deployments are managed through GitHub Actions pipelines.
                Direct Wrangler deploys are not permitted. Push to <code>main</code> branch to
                trigger production deployment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
