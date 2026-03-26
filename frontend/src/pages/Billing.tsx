import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, TrendingUp, DollarSign } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { apiClient } from '@/lib/api-client'
import { formatKoboAsNGN, calculateCommission } from '@/lib/commissionCalculator'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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

interface LedgerEntry {
  id: string
  tenantId: string
  tenantName: string
  amount: number
  commission: number
  status: 'completed' | 'pending' | 'failed'
  type: 'transaction' | 'refund' | 'adjustment'
  createdAt: string
  description: string
}

interface CommissionSummary {
  level1Total: number
  level2Total: number
  level3Total: number
  level4Total: number
  level5Total: number
  totalCommissions: number
}

export default function Billing() {
  const { t } = useTranslation()
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [commissionSummary, setCommissionSummary] = useState<CommissionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch billing ledger from D1
        const ledgerResponse = await apiClient.get('/billing/ledger')
        if (!ledgerResponse.success) {
          throw new Error('Failed to fetch billing ledger')
        }

        const ledgerData = (ledgerResponse.data as LedgerEntry[]) || []
        setLedger(ledgerData)

        // Calculate commission summary
        let level1Total = 0
        let level2Total = 0
        let level3Total = 0
        let level4Total = 0
        let level5Total = 0

        ledgerData.forEach((entry: LedgerEntry) => {
          if (entry.status === 'completed') {
            const breakdown = calculateCommission(entry.amount)
            level1Total += breakdown.level1
            level2Total += breakdown.level2
            level3Total += breakdown.level3
            level4Total += breakdown.level4
            level5Total += breakdown.level5
          }
        })

        setCommissionSummary({
          level1Total,
          level2Total,
          level3Total,
          level4Total,
          level5Total,
          totalCommissions: level1Total + level2Total + level3Total + level4Total + level5Total,
        })

        setLoading(false)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch billing data'
        setError(errorMessage)
        setLoading(false)
      }
    }

    fetchBillingData()
  }, [])

  if (error && ledger.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('billing.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('billing.subtitle')}</p>
        </div>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">Error Loading Billing Data</p>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Mock ledger data for reference
  const mockLedgerData: LedgerEntry[] = [
  ]

  return (
    <div className="space-y-6" role="main">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('billing.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('billing.subtitle')}</p>
      </div>

      {/* Commission Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : commissionSummary ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Level 1 Commission</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatKoboAsNGN(commissionSummary.level1Total)}</div>
                <p className="text-xs text-muted-foreground">5% of transactions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Level 2-5 Commission</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatKoboAsNGN(
                    commissionSummary.level2Total +
                      commissionSummary.level3Total +
                      commissionSummary.level4Total +
                      commissionSummary.level5Total
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Affiliate commissions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatKoboAsNGN(commissionSummary.totalCommissions)}</div>
                <p className="text-xs text-muted-foreground">All levels combined</p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Commission Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Hierarchy</CardTitle>
          <CardDescription>5-level affiliate commission breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-80" />
          ) : commissionSummary ? (
            <div className="space-y-4">
              {[
                { level: 1, amount: commissionSummary.level1Total, percentage: '5%' },
                { level: 2, amount: commissionSummary.level2Total, percentage: '3% of L1' },
                { level: 3, amount: commissionSummary.level3Total, percentage: '2% of L2' },
                { level: 4, amount: commissionSummary.level4Total, percentage: '1% of L3' },
                { level: 5, amount: commissionSummary.level5Total, percentage: '0.5% of L4' },
              ].map((item) => (
                <div key={item.level} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-semibold">Level {item.level}</p>
                    <p className="text-sm text-muted-foreground">{item.percentage}</p>
                  </div>
                  <p className="text-lg font-bold">{formatKoboAsNGN(item.amount)}</p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Ledger</CardTitle>
          <CardDescription>All platform transactions and adjustments</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : ledger.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Date</th>
                    <th className="text-left py-3 px-4 font-semibold">Tenant</th>
                    <th className="text-left py-3 px-4 font-semibold">Type</th>
                    <th className="text-right py-3 px-4 font-semibold">Amount</th>
                    <th className="text-right py-3 px-4 font-semibold">Commission</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.slice(0, 20).map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-medium text-sm">{entry.tenantName}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {entry.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm">{formatKoboAsNGN(entry.amount)}</td>
                      <td className="py-3 px-4 text-right font-mono text-sm">
                        {formatKoboAsNGN(entry.commission)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                            entry.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : entry.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No transactions found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
