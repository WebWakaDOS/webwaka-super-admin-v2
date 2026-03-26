import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, CheckCircle, AlertTriangle, Activity, Database, Zap, Clock } from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  responseTime: number;
  lastChecked: string;
}

interface SystemMetric {
  timestamp: string;
  cpu: number;
  memory: number;
  diskUsage: number;
  requests: number;
}

const SERVICES: ServiceStatus[] = [
  {
    name: 'API Gateway',
    status: 'healthy',
    uptime: 99.98,
    responseTime: 45,
    lastChecked: '2 seconds ago',
  },
  {
    name: 'Database Cluster',
    status: 'healthy',
    uptime: 99.99,
    responseTime: 120,
    lastChecked: '5 seconds ago',
  },
  {
    name: 'Cache Layer (Redis)',
    status: 'healthy',
    uptime: 99.95,
    responseTime: 8,
    lastChecked: '3 seconds ago',
  },
  {
    name: 'Message Queue',
    status: 'degraded',
    uptime: 98.5,
    responseTime: 250,
    lastChecked: '1 second ago',
  },
  {
    name: 'File Storage',
    status: 'healthy',
    uptime: 99.99,
    responseTime: 180,
    lastChecked: '4 seconds ago',
  },
  {
    name: 'Payment Gateway',
    status: 'healthy',
    uptime: 99.9,
    responseTime: 500,
    lastChecked: '6 seconds ago',
  },
];

const METRICS: SystemMetric[] = [
  { timestamp: '00:00', cpu: 35, memory: 42, diskUsage: 65, requests: 1200 },
  { timestamp: '04:00', cpu: 28, memory: 38, diskUsage: 64, requests: 950 },
  { timestamp: '08:00', cpu: 52, memory: 58, diskUsage: 66, requests: 2100 },
  { timestamp: '12:00', cpu: 68, memory: 72, diskUsage: 68, requests: 3500 },
  { timestamp: '16:00', cpu: 45, memory: 52, diskUsage: 67, requests: 2800 },
  { timestamp: '20:00', cpu: 38, memory: 45, diskUsage: 65, requests: 1600 },
  { timestamp: '23:59', cpu: 32, memory: 40, diskUsage: 64, requests: 1100 },
];

const ALERTS = [
  { id: 1, severity: 'warning', message: 'Message Queue response time elevated (250ms)', time: '5 minutes ago' },
  { id: 2, severity: 'info', message: 'Database backup completed successfully', time: '1 hour ago' },
  { id: 3, severity: 'warning', message: 'Disk usage approaching 70% threshold', time: '2 hours ago' },
  { id: 4, severity: 'info', message: 'API Gateway version updated to 2.1.0', time: '3 hours ago' },
];

export default function SystemHealth() {
  const { t } = useTranslation();
  const [selectedService, setSelectedService] = useState<string | null>(null);

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

  const healthyServices = SERVICES.filter((s) => s.status === 'healthy').length;
  const degradedServices = SERVICES.filter((s) => s.status === 'degraded').length;
  const downServices = SERVICES.filter((s) => s.status === 'down').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('health.title')}</h1>
        <p className="text-gray-400 mt-1">Platform infrastructure and service monitoring</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Healthy Services</p>
              <p className="text-2xl font-bold mt-2 text-green-400">{healthyServices}</p>
            </div>
            <CheckCircle size={32} className="text-green-400/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Degraded Services</p>
              <p className="text-2xl font-bold mt-2 text-yellow-400">{degradedServices}</p>
            </div>
            <AlertTriangle size={32} className="text-yellow-400/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Down Services</p>
              <p className="text-2xl font-bold mt-2 text-red-400">{downServices}</p>
            </div>
            <AlertCircle size={32} className="text-red-400/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Avg Uptime</p>
              <p className="text-2xl font-bold mt-2">99.6%</p>
            </div>
            <Activity size={32} className="text-blue-400/30" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services">
          <Card className="p-6">
            <div className="space-y-3">
              {SERVICES.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between p-4 border border-gray-700 rounded-lg hover:bg-gray-800/50 transition cursor-pointer"
                  onClick={() => setSelectedService(service.name)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div>{getStatusIcon(service.status)}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{service.name}</h3>
                      <p className="text-xs text-gray-500">Last checked: {service.lastChecked}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-8 text-right">
                    <div>
                      <p className="text-xs text-gray-500">Uptime</p>
                      <p className="font-semibold text-green-400">{service.uptime}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Response Time</p>
                      <p className="font-semibold">{service.responseTime}ms</p>
                    </div>
                    <div>
                      <Badge className={`${getStatusColor(service.status)}`}>
                        {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics">
          <div className="space-y-4">
            {/* CPU & Memory */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">CPU & Memory Usage</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={METRICS}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="timestamp" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                  <Legend />
                  <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
                  <Area type="monotone" dataKey="memory" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMemory)" name="Memory %" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Disk & Requests */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Disk Usage & Request Volume</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={METRICS}>
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
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card className="p-6">
            <div className="space-y-3">
              {ALERTS.map((alert) => (
                <div key={alert.id} className={`p-4 rounded-lg border border-gray-700 ${getSeverityColor(alert.severity)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {alert.severity === 'critical' && <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />}
                      {alert.severity === 'warning' && <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" />}
                      {alert.severity === 'info' && <Activity size={20} className="mt-0.5 flex-shrink-0" />}
                      <div>
                        <p className="font-semibold">{alert.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{alert.time}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
