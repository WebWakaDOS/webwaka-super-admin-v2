import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Brain, TrendingUp, Zap, DollarSign } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { apiClient } from '@/lib/api';

interface AIUsageRecord {
  tenant_id: string;
  tenant_name: string;
  model: string;
  tokens_input: number;
  tokens_output: number;
  total_tokens: number;
  cost_usd_cents: number;
  request_count: number;
  period: string;
}

interface AIUsageSummary {
  total_tokens: number;
  total_cost_usd_cents: number;
  total_requests: number;
  active_tenants: number;
  records: AIUsageRecord[];
  daily_trend: { date: string; tokens: number; cost_cents: number; requests: number }[];
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function AIUsage() {
  const [period, setPeriod] = useState('30d');
  const [summary, setSummary] = useState<AIUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<AIUsageSummary>(`/ai/usage?period=${period}`);
        if (res.success && res.data) {
          setSummary(res.data);
        } else {
          setSummary(getMockData(period));
        }
      } catch {
        setSummary(getMockData(period));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period]);

  const topTenants = (summary?.records || [])
    .sort((a, b) => b.total_tokens - a.total_tokens)
    .slice(0, 10);

  const modelBreakdown = (summary?.records || []).reduce<Record<string, { tokens: number; cost: number; requests: number }>>(
    (acc, r) => {
      const key = r.model || 'unknown';
      if (!acc[key]) acc[key] = { tokens: 0, cost: 0, requests: 0 };
      acc[key].tokens += r.total_tokens;
      acc[key].cost += r.cost_usd_cents;
      acc[key].requests += r.request_count;
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Usage Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor AI token consumption and costs across all tenants</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tokens</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold">{formatTokens(summary?.total_tokens || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold">{formatCents(summary?.total_cost_usd_cents || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">API Requests</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold">{(summary?.total_requests || 0).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Tenants</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{summary?.active_tenants || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Token Consumption Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Token Consumption Over Time</CardTitle>
          <CardDescription>Daily AI token usage across all tenants</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-72 w-full" /> : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={summary?.daily_trend || []}>
                <defs>
                  <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={formatTokens} />
                <Tooltip formatter={(v: number) => [formatTokens(v), 'Tokens']} />
                <Area
                  type="monotone"
                  dataKey="tokens"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#tokenGradient)"
                  name="Tokens"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Cost (USD)</CardTitle>
            <CardDescription>AI inference cost per day</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-72 w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={summary?.daily_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} />
                  <Tooltip formatter={(v: number) => [formatCents(v), 'Cost']} />
                  <Bar dataKey="cost_cents" fill="#10b981" name="Cost" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Model Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Model Breakdown</CardTitle>
            <CardDescription>Token usage by AI model</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-72 w-full" /> : (
              <div className="space-y-4 pt-2">
                {Object.entries(modelBreakdown).map(([model, stats]) => {
                  const totalTokens = summary?.total_tokens || 1;
                  const pct = Math.round((stats.tokens / totalTokens) * 100);
                  return (
                    <div key={model} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{model}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{formatTokens(stats.tokens)}</span>
                          <span className="font-semibold">{formatCents(stats.cost)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(modelBreakdown).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No model data available</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Tenants by AI Usage</CardTitle>
          <CardDescription>Tenants consuming the most AI tokens this period</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Tenant</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Model</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Tokens</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Requests</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {topTenants.map((r, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-2 font-medium">{r.tenant_name || r.tenant_id}</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline">{r.model || '—'}</Badge>
                      </td>
                      <td className="py-3 px-2 text-right">{formatTokens(r.total_tokens)}</td>
                      <td className="py-3 px-2 text-right">{r.request_count.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-semibold">{formatCents(r.cost_usd_cents)}</td>
                    </tr>
                  ))}
                  {topTenants.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">No usage data for this period</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getMockData(period: string): AIUsageSummary {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const daily_trend = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const tokens = Math.floor(Math.random() * 500000) + 100000;
    return {
      date: d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }),
      tokens,
      cost_cents: Math.floor(tokens * 0.002),
      requests: Math.floor(tokens / 1000),
    };
  });

  const records: AIUsageRecord[] = [
    { tenant_id: 't1', tenant_name: 'Acme Corp', model: 'gpt-4o', tokens_input: 800000, tokens_output: 200000, total_tokens: 1000000, cost_usd_cents: 2000, request_count: 1200, period },
    { tenant_id: 't2', tenant_name: 'TechHub Nigeria', model: 'gpt-4o-mini', tokens_input: 600000, tokens_output: 150000, total_tokens: 750000, cost_usd_cents: 750, request_count: 980, period },
    { tenant_id: 't3', tenant_name: 'PayEasy Ltd', model: 'claude-3-haiku', tokens_input: 400000, tokens_output: 100000, total_tokens: 500000, cost_usd_cents: 500, request_count: 620, period },
    { tenant_id: 't4', tenant_name: 'LogiTrack', model: 'gpt-4o', tokens_input: 300000, tokens_output: 80000, total_tokens: 380000, cost_usd_cents: 760, request_count: 440, period },
    { tenant_id: 't5', tenant_name: 'EduZone', model: 'gpt-4o-mini', tokens_input: 200000, tokens_output: 50000, total_tokens: 250000, cost_usd_cents: 250, request_count: 310, period },
  ];

  return {
    total_tokens: records.reduce((s, r) => s + r.total_tokens, 0),
    total_cost_usd_cents: records.reduce((s, r) => s + r.cost_usd_cents, 0),
    total_requests: records.reduce((s, r) => s + r.request_count, 0),
    active_tenants: records.length,
    records,
    daily_trend,
  };
}
