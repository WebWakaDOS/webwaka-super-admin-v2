/**
 * OperationsOverview Page — Super Admin V2
 * Cross-suite analytics: revenue, health, AI usage
 * Compliance: Nigeria First (kobo), Vendor Neutral AI, Mobile First
 */

import { useState, useEffect } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw, TrendingUp, Activity, Cpu, Users } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { apiClient } from '@/lib/api-client'

// ============================================================================
// TYPES
// ============================================================================

interface SuiteMetric {
  suite: string
  total_revenue_kobo: number
  total_transactions: number
  avg_uptime: number
  avg_error_rate: number
  total_ai_tokens: number
}

interface OperationsSummary {
  suiteMetrics: SuiteMetric[]
  activeTenants: number
  activePartners: number
  generatedAt: string
}

interface AIVendorBreakdown {
  ai_vendor: string
  total_tokens: number
  total_cost_kobo: number
  tenant_count: number
}

// ============================================================================
// HELPERS
// ============================================================================

function formatKobo(kobo: number): string {
  if (kobo >= 100000000) {
    return `₦${(kobo / 100000000).toFixed(1)}M`
  }
  if (kobo >= 100000) {
    return `₦${(kobo / 100000).toFixed(1)}K`
  }
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(kobo / 100)
}

const SUITE_COLORS: Record<string, string> = {
  civic: '#3b82f6',
  commerce: '#10b981',
  transport: '#f59e0b',
  fintech: '#8b5cf6',
  realestate: '#ec4899',
  education: '#06b6d4',
}

const AI_VENDOR_COLORS: Record<string, string> = {
  platform: '#3b82f6',
  openai: '#10b981',
  gemini: '#f59e0b',
  anthropic: '#8b5cf6',
  byok: '#ec4899',
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function OperationsOverview() {
  const { t } = useTranslation()
  const [summary, setSummary] = useState<OperationsSummary | null>(null)
  const [aiUsage, setAIUsage] = useState<AIVendorBreakdown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSuite, setSelectedSuite] = useState<string>('ALL')
  const [refreshing, setRefreshing] = useState(false)

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const [summaryRes, aiRes] = await Promise.allSettled([
        apiClient.get<OperationsSummary>('/operations/summary'),
        apiClient.get<{ vendorBreakdown: AIVendorBreakdown[] }>('/operations/ai-usage'),
      ])

      if (summaryRes.status === 'fulfilled' && summaryRes.value.success) {
        setSummary(summaryRes.value.data || null)
      }
      if (aiRes.status === 'fulfilled' && aiRes.value.success) {
        setAIUsage(aiRes.value.data?.vendorBreakdown || [])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load operations data')
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  useEffect(() => { fetchData() }, [])

  const filteredMetrics = (summary?.suiteMetrics || []).filter(
    (m) => selectedSuite === 'ALL' || m.suite === selectedSuite
  )

  const totalRevenue = filteredMetrics.reduce((sum, m) => sum + (m.total_revenue_kobo || 0), 0)
  const totalTransactions = filteredMetrics.reduce((sum, m) => sum + (m.total_transactions || 0), 0)
  const totalAITokens = filteredMetrics.reduce((sum, m) => sum + (m.total_ai_tokens || 0), 0)

  const revenueChartData = (summary?.suiteMetrics || []).map((m) => ({
    name: m.suite.charAt(0).toUpperCase() + m.suite.slice(1),
    revenue: Math.round((m.total_revenue_kobo || 0) / 100),
    transactions: m.total_transactions || 0,
  }))

  const uptimeChartData = (summary?.suiteMetrics || []).map((m) => ({
    name: m.suite.charAt(0).toUpperCase() + m.suite.slice(1),
    uptime: Number((m.avg_uptime || 100).toFixed(2)),
    errorRate: Number((m.avg_error_rate || 0).toFixed(2)),
  }))

  const aiPieData = aiUsage.map((v) => ({
    name: v.ai_vendor,
    value: v.total_tokens,
    cost: v.total_cost_kobo,
  }))

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operations Overview</h1>
          <p className="text-muted-foreground mt-1">Cross-suite analytics and platform health</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    )
  }

  return (
    <div className="space-y-6" role="main">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('operations.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('operations.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSuite} onValueChange={setSelectedSuite}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Suites</SelectItem>
              <SelectItem value="civic">Civic</SelectItem>
              <SelectItem value="commerce">Commerce</SelectItem>
              <SelectItem value="transport">Transport</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error} — showing cached data
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-xl font-bold">{formatKobo(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-xl font-bold">{totalTransactions.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-xl font-bold">{summary?.activeTenants || 0}</p>
                <p className="text-xs text-muted-foreground">Active Tenants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Cpu className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-xl font-bold">{(totalAITokens / 1000).toFixed(0)}K</p>
                <p className="text-xs text-muted-foreground">AI Tokens Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Suite (₦)</CardTitle>
          <CardDescription>Gross revenue per suite — last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueChartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              No revenue data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, 'Revenue']} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue (₦)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Uptime & AI Usage */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Platform Uptime (%)</CardTitle>
            <CardDescription>Average uptime per suite — last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {uptimeChartData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                No uptime data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={uptimeChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[95, 100]} />
                  <Tooltip />
                  <Bar dataKey="uptime" name="Uptime %" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* AI Usage — Vendor Neutral AI invariant */}
        <Card>
          <CardHeader>
            <CardTitle>AI Usage by Vendor</CardTitle>
            <CardDescription>
              Vendor Neutral AI — no lock-in to any single provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            {aiPieData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <div className="text-center">
                  <Cpu className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No AI usage data yet</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={aiPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }: { name: string; percent: number }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {aiPieData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={AI_VENDOR_COLORS[entry.name] || `hsl(${index * 60}, 70%, 50%)`}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v.toLocaleString()} tokens`]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {aiUsage.map((v) => (
                    <div key={v.ai_vendor} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: AI_VENDOR_COLORS[v.ai_vendor] || '#9ca3af' }}
                        />
                        <span className="capitalize font-medium">{v.ai_vendor}</span>
                        <Badge variant="outline" className="text-xs">
                          {v.tenant_count} tenants
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p>{v.total_tokens.toLocaleString()} tokens</p>
                        <p className="text-xs text-muted-foreground">{formatKobo(v.total_cost_kobo)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Suite Health Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Suite Health Summary</CardTitle>
          <CardDescription>Current status across all deployed suites</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(summary?.suiteMetrics || []).map((m) => (
              <div
                key={m.suite}
                className="rounded-lg border p-4"
                style={{ borderLeftColor: SUITE_COLORS[m.suite] || '#9ca3af', borderLeftWidth: 4 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold capitalize">{m.suite}</h3>
                  <Badge
                    variant={m.avg_uptime >= 99 ? 'default' : m.avg_uptime >= 95 ? 'secondary' : 'destructive'}
                  >
                    {(m.avg_uptime || 100).toFixed(1)}% uptime
                  </Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revenue</span>
                    <span className="font-medium">{formatKobo(m.total_revenue_kobo || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transactions</span>
                    <span className="font-medium">{(m.total_transactions || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Error Rate</span>
                    <span className={`font-medium ${(m.avg_error_rate || 0) > 1 ? 'text-red-600' : 'text-green-600'}`}>
                      {(m.avg_error_rate || 0).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">AI Tokens</span>
                    <span className="font-medium">{((m.total_ai_tokens || 0) / 1000).toFixed(0)}K</span>
                  </div>
                </div>
              </div>
            ))}
            {(summary?.suiteMetrics || []).length === 0 && (
              <div className="col-span-3 text-center py-8 text-muted-foreground">
                No suite metrics available. Ingest metrics via POST /operations/metrics.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        Last updated: {summary?.generatedAt ? new Date(summary.generatedAt).toLocaleString('en-NG') : 'N/A'}
        {' · '}All monetary values in Nigerian Naira (₦) · Vendor Neutral AI
      </p>
    </div>
  )
}
