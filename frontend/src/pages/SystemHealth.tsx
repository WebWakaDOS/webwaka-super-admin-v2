import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, CheckCircle, AlertTriangle, Activity, RefreshCw } from 'lucide-react';
import { useHealthData } from '@/hooks/useHealthData';
import { apiClient } from '@/lib/api';

interface HealthAlert {
  id: string | number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  time: string;
}

export default function SystemHealth() {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { services, metrics, loading, error } = useHealthData(true, 30000);

  useEffect(() => {
    fetchAlerts();
  }, []);

  async function fetchAlerts() {
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      const res = await apiClient.getHealthAlerts();
      if (res.success && res.data) {
        setAlerts((res.data as HealthAlert[]) || []);
      } else {
        setAlertsError(res.error || 'Failed to load alerts');
      }
    } catch (err) {
      setAlertsError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setAlertsLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle size={20} className="text-green-400" />;
      case 'degraded':
        return <AlertTriangle size={20} className="text-yellow-400" />;
      case 'down':
        return <AlertCircle size={20} className="text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-900/30 text-green-400';
      case 'degraded':
        return 'bg-yellow-900/30 text-yellow-400';
      case 'down':
        return 'bg-red-900/30 text-red-400';
      default:
        return 'bg-gray-900/30 text-gray-400';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-900/30 text-red-400';
      case 'warning':
        return 'bg-yellow-900/30 text-yellow-400';
      case 'info':
        return 'bg-blue-900/30 text-blue-400';
      default:
        return 'bg-gray-900/30 text-gray-400';
    }
  };

  const healthyServices = services.filter((s) => s.status === 'healthy').length;
  const degradedServices = services.filter((s) => s.status === 'degraded').length;
  const downServices = services.filter((s) => s.status === 'down').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
          <p className="text-muted-foreground mt-1">Real-time infrastructure monitoring</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* API error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error} — showing last available data.</span>
        </div>
      )}

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Healthy Services</p>
                <p className="text-3xl font-bold text-green-400">{healthyServices}</p>
              </div>
              <CheckCircle size={32} className="text-green-400" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Degraded</p>
                <p className="text-3xl font-bold text-yellow-400">{degradedServices}</p>
              </div>
              <AlertTriangle size={32} className="text-yellow-400" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Down</p>
                <p className="text-3xl font-bold text-red-400">{downServices}</p>
              </div>
              <AlertCircle size={32} className="text-red-400" />
            </div>
          </Card>
        </div>
      )}

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : services.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Activity size={32} className="mx-auto mb-3 opacity-40" />
              <p>No service data available</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {services.map((service) => (
                <Card
                  key={service.name}
                  className={`p-4 cursor-pointer border transition-colors ${
                    selectedService === service.name ? 'border-primary' : 'border-gray-700'
                  }`}
                  onClick={() => setSelectedService(
                    selectedService === service.name ? null : service.name
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(service.status)}
                      <div>
                        <h3 className="font-semibold">{service.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          Last checked: {service.lastChecked}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{service.uptime.toFixed(2)}%</p>
                        <p className="text-xs text-muted-foreground">Uptime</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{service.responseTime}ms</p>
                        <p className="text-xs text-muted-foreground">Response</p>
                      </div>
                      <Badge className={getStatusColor(service.status)}>
                        {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6">
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
              {/* CPU & Memory */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">CPU & Memory Usage</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="timestamp" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                    <Legend />
                    <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} name="CPU %" />
                    <Area type="monotone" dataKey="memory" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={2} name="Memory %" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              {/* Disk & Requests */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Disk Usage & Request Volume</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="timestamp" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                    <Legend />
                    <Line type="monotone" dataKey="diskUsage" stroke="#f59e0b" strokeWidth={2} name="Disk Usage %" />
                    <Line type="monotone" dataKey="requests" stroke="#10b981" strokeWidth={2} name="Requests/min" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card className="p-6">
            {alertsLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : alertsError ? (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{alertsError}</span>
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle size={32} className="mx-auto mb-3 text-green-400" />
                <p>No active alerts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border border-gray-700 ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {alert.severity === 'critical' && <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />}
                        {alert.severity === 'warning' && <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" />}
                        {alert.severity === 'info' && <Activity size={20} className="mt-0.5 flex-shrink-0" />}
                        <div>
                          <p className="font-semibold">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
