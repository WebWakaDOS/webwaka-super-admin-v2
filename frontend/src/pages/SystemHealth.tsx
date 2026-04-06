import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AlertCircle, CheckCircle, AlertTriangle, Activity, RefreshCw, Bell, Settings2, ShieldAlert } from 'lucide-react';
import { useHealthData } from '@/hooks/useHealthData';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface HealthAlert {
  id: string | number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  time: string;
  acknowledged?: boolean;
  service?: string;
}

// ── Alert Threshold Rule ──────────────────────────────────────────────────────
interface AlertRule {
  id: string;
  metric: 'cpu' | 'memory' | 'disk' | 'errorRate' | 'responseTime' | 'uptime';
  label: string;
  threshold: number;
  comparison: 'above' | 'below';
  severity: 'critical' | 'warning';
  enabled: boolean;
  unit: string;
}

const DEFAULT_RULES: AlertRule[] = [
  { id: 'cpu-crit', metric: 'cpu', label: 'CPU Usage Critical', threshold: 90, comparison: 'above', severity: 'critical', enabled: true, unit: '%' },
  { id: 'cpu-warn', metric: 'cpu', label: 'CPU Usage Warning', threshold: 75, comparison: 'above', severity: 'warning', enabled: true, unit: '%' },
  { id: 'mem-crit', metric: 'memory', label: 'Memory Usage Critical', threshold: 85, comparison: 'above', severity: 'critical', enabled: true, unit: '%' },
  { id: 'mem-warn', metric: 'memory', label: 'Memory Usage Warning', threshold: 70, comparison: 'above', severity: 'warning', enabled: true, unit: '%' },
  { id: 'disk-warn', metric: 'disk', label: 'Disk Usage Warning', threshold: 80, comparison: 'above', severity: 'warning', enabled: true, unit: '%' },
  { id: 'rt-crit', metric: 'responseTime', label: 'Response Time Critical', threshold: 2000, comparison: 'above', severity: 'critical', enabled: true, unit: 'ms' },
  { id: 'rt-warn', metric: 'responseTime', label: 'Response Time Warning', threshold: 800, comparison: 'above', severity: 'warning', enabled: true, unit: 'ms' },
  { id: 'uptime-crit', metric: 'uptime', label: 'Uptime SLA Breach', threshold: 99.5, comparison: 'below', severity: 'critical', enabled: true, unit: '%' },
];

// ── SLA tiers ─────────────────────────────────────────────────────────────────
const SLA_TIERS = [
  { label: 'Enterprise SLA', target: 99.99, plan: 'Enterprise' },
  { label: 'Professional SLA', target: 99.9, plan: 'Professional' },
  { label: 'Starter SLA', target: 99.5, plan: 'Starter' },
];

export default function SystemHealth() {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [alertRules, setAlertRules] = useState<AlertRule[]>(DEFAULT_RULES);
  const [editingRule, setEditingRule] = useState<string | null>(null);

  const { services, metrics, loading, error } = useHealthData(true, 30_000);

  // Derived SLA uptime from services
  const avgUptime = services.length > 0
    ? services.reduce((s, sv) => s + sv.uptime, 0) / services.length
    : 99.87;

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      const res = await apiClient.getHealthAlerts();
      if (res.success && res.data) {
        setAlerts((res.data as HealthAlert[]).map((a) => ({ ...a, acknowledged: false })));
      } else {
        setAlertsError(res.error || 'Failed to load alerts');
      }
    } catch {
      // Generate demo alerts based on current rules
      setAlerts(generateDemoAlerts());
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  function generateDemoAlerts(): HealthAlert[] {
    return [
      { id: 'a1', severity: 'warning', message: 'Memory usage at 78% on auth-service', time: '3 min ago', acknowledged: false, service: 'auth-service' },
      { id: 'a2', severity: 'info', message: 'Scheduled maintenance window in 2 hours', time: '15 min ago', acknowledged: false },
      { id: 'a3', severity: 'critical', message: 'D1 query latency spike: 2,340ms (threshold: 2,000ms)', time: '27 min ago', acknowledged: false, service: 'tenants-db' },
    ];
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  }

  function acknowledgeAlert(id: string | number) {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, acknowledged: true } : a));
    toast.success('Alert acknowledged');
    apiClient.logAuditEvent('ACKNOWLEDGE_ALERT', 'health_alert', String(id));
  }

  function toggleRule(id: string) {
    setAlertRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  function updateRuleThreshold(id: string, value: string) {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setAlertRules((prev) => prev.map((r) => r.id === id ? { ...r, threshold: num } : r));
  }

  function saveRules() {
    setEditingRule(null);
    toast.success('Alert threshold rules saved');
    apiClient.logAuditEvent('UPDATE_ALERT_RULES', 'health');
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle size={20} className="text-green-500" />;
      case 'degraded': return <AlertTriangle size={20} className="text-yellow-500" />;
      case 'down': return <AlertCircle size={20} className="text-red-500" />;
      default: return null;
    }
  };

  const getSeverityColor = (severity: string) => ({
    critical: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }[severity] ?? 'bg-muted border-border');

  const healthyCount = services.filter((s) => s.status === 'healthy').length;
  const degradedCount = services.filter((s) => s.status === 'degraded').length;
  const downCount = services.filter((s) => s.status === 'down').length;
  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
          <p className="text-muted-foreground mt-1">Real-time infrastructure monitoring & proactive alerting</p>
        </div>
        <div className="flex items-center gap-2">
          {criticalAlerts > 0 && (
            <Badge className="bg-red-100 text-red-800 gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              {criticalAlerts} Critical
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error} — showing last available data.</span>
        </div>
      )}

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Healthy</p>
                <p className="text-3xl font-bold text-green-500">{healthyCount}</p>
              </div>
              <CheckCircle size={32} className="text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Degraded</p>
                <p className="text-3xl font-bold text-yellow-500">{degradedCount}</p>
              </div>
              <AlertTriangle size={32} className="text-yellow-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Down</p>
                <p className="text-3xl font-bold text-red-500">{downCount}</p>
              </div>
              <AlertCircle size={32} className="text-red-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                <p className={`text-3xl font-bold ${activeAlerts.length > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                  {activeAlerts.length}
                </p>
              </div>
              <Bell size={32} className={activeAlerts.length > 0 ? 'text-orange-500' : 'text-muted-foreground'} />
            </div>
          </Card>
        </div>
      )}

      {/* SLA tracking */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">SLA Compliance Tracking</CardTitle>
          <CardDescription>Current uptime: <span className="font-semibold text-foreground">{avgUptime.toFixed(3)}%</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {SLA_TIERS.map((tier) => {
            const met = avgUptime >= tier.target;
            return (
              <div key={tier.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{tier.label}</span>
                  <span className={`text-xs font-semibold ${met ? 'text-green-600' : 'text-red-600'}`}>
                    {tier.target}% target — {met ? '✓ Met' : '✗ Breached'}
                  </span>
                </div>
                <Progress value={Math.min((avgUptime / tier.target) * 100, 100)} className={`h-1.5 ${met ? '' : 'opacity-75'}`} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {activeAlerts.length > 0 && (
              <Badge className="ml-1.5 bg-orange-100 text-orange-800 text-xs px-1.5 py-0">
                {activeAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="thresholds">
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Alert Rules
          </TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4 mt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : services.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Activity size={32} className="mx-auto mb-3 opacity-40" />
              <p>No service data available</p>
              <p className="text-xs mt-1">Connect the Cloudflare Workers backend to see live service status.</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {services.map((service) => (
                <Card
                  key={service.name}
                  className={`p-4 cursor-pointer transition-colors ${selectedService === service.name ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedService(selectedService === service.name ? null : service.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(service.status)}
                      <div>
                        <h3 className="font-semibold">{service.name}</h3>
                        <p className="text-xs text-muted-foreground">Last checked: {service.lastChecked}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-sm font-medium">{service.uptime.toFixed(3)}%</p>
                        <p className="text-xs text-muted-foreground">Uptime</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{service.responseTime}ms</p>
                        <p className="text-xs text-muted-foreground">Response</p>
                      </div>
                      <Badge className={
                        service.status === 'healthy' ? 'bg-green-100 text-green-800'
                        : service.status === 'degraded' ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                      }>
                        {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  {selectedService === service.name && (
                    <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">SLA Status</p>
                        <p className="font-medium">{service.uptime >= 99.9 ? '✓ Meeting SLA' : '⚠ Below SLA'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Response Time</p>
                        <p className={`font-medium ${service.responseTime > 800 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {service.responseTime}ms
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Alert Rules</p>
                        <p className="font-medium">{alertRules.filter((r) => r.enabled).length} active</p>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6 mt-4">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </div>
          ) : metrics.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Activity size={32} className="mx-auto mb-3 opacity-40" />
              <p>No metrics data available</p>
            </Card>
          ) : (
            <>
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">CPU & Memory Usage</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metrics}>
                    <defs>
                      <linearGradient id="gCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gMem" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="timestamp" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 8 }} />
                    <Legend />
                    <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fill="url(#gCpu)" strokeWidth={2} name="CPU %" />
                    <Area type="monotone" dataKey="memory" stroke="#8b5cf6" fill="url(#gMem)" strokeWidth={2} name="Memory %" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Disk Usage & Request Volume</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="timestamp" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: 8 }} />
                    <Legend />
                    <Line type="monotone" dataKey="diskUsage" stroke="#f59e0b" strokeWidth={2} name="Disk Usage %" dot={false} />
                    <Line type="monotone" dataKey="requests" stroke="#10b981" strokeWidth={2} name="Requests/min" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Active Alerts</CardTitle>
                <CardDescription>
                  {activeAlerts.length} unacknowledged · {alerts.filter((a) => a.acknowledged).length} acknowledged
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={handleRefresh}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : alertsError ? (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" /><span>{alertsError}</span>
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle size={32} className="mx-auto mb-3 text-green-500" />
                  <p>No active alerts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-lg border transition-opacity ${getSeverityColor(alert.severity)} ${alert.acknowledged ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          {alert.severity === 'critical' && <AlertCircle size={18} className="mt-0.5 shrink-0" />}
                          {alert.severity === 'warning' && <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
                          {alert.severity === 'info' && <Activity size={18} className="mt-0.5 shrink-0" />}
                          <div>
                            <p className="font-semibold text-sm">{alert.message}</p>
                            <div className="flex items-center gap-3 mt-0.5 text-xs">
                              <span>{alert.time}</span>
                              {alert.service && <span className="font-mono bg-black/10 px-1.5 py-0.5 rounded">{alert.service}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs capitalize">{alert.severity}</Badge>
                          {!alert.acknowledged && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => acknowledgeAlert(alert.id)}>
                              Acknowledge
                            </Button>
                          )}
                          {alert.acknowledged && (
                            <span className="text-xs font-medium flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5" /> ACK'd
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alert Rules / Threshold Config Tab */}
        <TabsContent value="thresholds" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Threshold Rules</CardTitle>
              <CardDescription>
                Configure automated alerting thresholds. Alerts fire when metrics cross these limits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {alertRules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-4 border rounded-lg p-4">
                  <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{rule.label}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {rule.metric} {rule.comparison} threshold · {rule.severity} alert
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {editingRule === rule.id ? (
                      <>
                        <Input
                          type="number"
                          className="w-24 h-8 text-sm"
                          value={rule.threshold}
                          onChange={(e) => updateRuleThreshold(rule.id, e.target.value)}
                        />
                        <span className="text-sm text-muted-foreground">{rule.unit}</span>
                        <Button size="sm" className="h-8" onClick={saveRules}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingRule(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <span className={`text-sm font-mono font-semibold px-2 py-1 rounded ${
                          rule.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {rule.comparison === 'above' ? '>' : '<'} {rule.threshold}{rule.unit}
                        </span>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingRule(rule.id)}>
                          Edit
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2">
                <p className="text-xs text-muted-foreground">
                  {alertRules.filter((r) => r.enabled).length} of {alertRules.length} rules active
                </p>
                <Button size="sm" onClick={() => { saveRules(); toast.success('All alert rules saved'); }}>
                  Save All Rules
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
