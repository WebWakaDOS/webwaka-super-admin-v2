import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { apiClient } from '@/lib/api';

interface SuiteMetric {
  suite: string;
  total_revenue_kobo: number;
  total_transactions: number;
  avg_uptime: number;
  avg_error_rate: number;
  total_ai_tokens: number;
}

interface OperationsSummary {
  suiteMetrics: SuiteMetric[];
  activeTenants: number;
  activePartners: number;
  generatedAt: string;
}

interface DailyMetric {
  metric_date: string;
  suite: string;
  gross_revenue_kobo: number;
  transaction_count: number;
  active_users: number;
  avg_response_ms: number;
}

const SUITE_COLORS: Record<string, string> = {
  civic: '#3b82f6',
  commerce: '#10b981',
  transport: '#f59e0b',
  fintech: '#ef4444',
  realestate: '#8b5cf6',
  education: '#06b6d4',
};

function formatKoboAsNaira(kobo: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(kobo / 100);
}

function groupByMonth(metrics: DailyMetric[]) {
  const months: Record<string, { transactions: number; revenueKobo: number; users: number }> = {};
  for (const m of metrics) {
    const month = m.metric_date?.slice(0, 7) || '';
    if (!months[month]) months[month] = { transactions: 0, revenueKobo: 0, users: 0 };
    months[month].transactions += m.transaction_count || 0;
    months[month].revenueKobo += m.gross_revenue_kobo || 0;
    months[month].users += m.active_users || 0;
  }
  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month: new Date(month + '-01').toLocaleString('en-NG', { month: 'short' }),
      transactions: v.transactions,
      revenueNaira: Math.round(v.revenueKobo / 100),
      users: v.users,
    }));
}

const Analytics = () => {
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [summaryRes, metricsRes] = await Promise.all([
          apiClient.get<OperationsSummary>('/operations/summary'),
          apiClient.get<DailyMetric[]>('/operations/metrics'),
        ]);
        if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
        if (metricsRes.success && metricsRes.data) setDailyMetrics(Array.isArray(metricsRes.data) ? metricsRes.data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const monthlyData = groupByMonth(dailyMetrics);

  const moduleUsageData = (summary?.suiteMetrics || []).map((m) => ({
    name: m.suite.charAt(0).toUpperCase() + m.suite.slice(1),
    suite: m.suite,
    value: m.total_transactions || 0,
    revenue: m.total_revenue_kobo,
    uptime: m.avg_uptime,
  }));
  const totalTx = moduleUsageData.reduce((s, m) => s + m.value, 0);
  const moduleUsagePct = moduleUsageData.map((m) => ({
    ...m,
    pct: totalTx > 0 ? Math.round((m.value / totalTx) * 100) : 0,
  }));

  const totalRevenue = (summary?.suiteMetrics || []).reduce((s, m) => s + (m.total_revenue_kobo || 0), 0);
  const totalTransactions = (summary?.suiteMetrics || []).reduce((s, m) => s + (m.total_transactions || 0), 0);
  const avgUptime = (summary?.suiteMetrics || []).length > 0
    ? summary!.suiteMetrics.reduce((s, m) => s + (m.avg_uptime || 0), 0) / summary!.suiteMetrics.length
    : 0;
  const avgResponse = dailyMetrics.length > 0
    ? Math.round(dailyMetrics.reduce((s, m) => s + (m.avg_response_ms || 0), 0) / dailyMetrics.length)
    : 0;

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-2">Platform performance metrics and usage analytics</p>
        </div>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-2">Platform performance metrics and usage analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{(summary?.activeTenants || 0).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold">{totalTransactions.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-28" /> : (
              <div className="text-xl font-bold">{formatKoboAsNaira(totalRevenue)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{avgResponse > 0 ? `${avgResponse}ms` : '—'}</div>
            )}
            {avgUptime > 0 && (
              <p className="text-xs text-green-600 mt-1">{avgUptime.toFixed(2)}% uptime</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Transaction Volume</CardTitle>
            <CardDescription>Daily transaction count over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-72 w-full" /> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="transactions" fill="#3b82f6" name="Transactions" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Gross revenue (₦) over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-72 w-full" /> : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => `₦${v.toLocaleString()}`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenueNaira"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Revenue (₦)"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suite Usage Distribution</CardTitle>
          <CardDescription>Transaction share by suite (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-72 w-full" /> : moduleUsagePct.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No suite data available yet</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={moduleUsagePct}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, pct }) => pct > 0 ? `${name} ${pct}%` : ''}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {moduleUsagePct.map((m) => (
                      <Cell key={m.suite} fill={SUITE_COLORS[m.suite] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-3">
                {moduleUsagePct.map((m) => (
                  <div key={m.suite} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: SUITE_COLORS[m.suite] || '#6b7280' }}
                      />
                      <span className="font-medium capitalize">{m.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold">{m.pct}%</span>
                      <p className="text-xs text-muted-foreground">{m.value.toLocaleString()} txns</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
