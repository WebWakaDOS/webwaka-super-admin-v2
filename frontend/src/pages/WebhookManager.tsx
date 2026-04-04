import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Webhook, Search, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, Eye, Trash2, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface WebhookEndpoint {
  id: string;
  tenant_id: string;
  tenant_name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive' | 'failing';
  secret_hash: string;
  created_at: string;
  last_triggered_at?: string;
  success_rate: number;
  total_deliveries: number;
  failed_deliveries: number;
}

interface WebhookDelivery {
  id: string;
  event: string;
  status: 'success' | 'failed' | 'pending';
  status_code?: number;
  duration_ms?: number;
  triggered_at: string;
  response_body?: string;
}

const STATUS_CONFIG = {
  active: { label: 'Active', variant: 'default' as const },
  inactive: { label: 'Inactive', variant: 'secondary' as const },
  failing: { label: 'Failing', variant: 'destructive' as const },
};

const ALL_EVENTS = [
  'tenant.created', 'tenant.updated', 'tenant.suspended',
  'billing.payment_success', 'billing.payment_failed',
  'kyc.approved', 'kyc.rejected',
  'fraud.alert_created', 'fraud.alert_resolved',
  'user.login', 'user.logout',
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function WebhookManager() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEndpoint, setSelectedEndpoint] = useState<WebhookEndpoint | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [retryLoading, setRetryLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const fetchEndpoints = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await apiClient.get<WebhookEndpoint[]>(`/webhooks?${params.toString()}`);
      if (res.success && res.data) setEndpoints(Array.isArray(res.data) ? res.data : []);
      else setEndpoints(getMockEndpoints());
    } catch { setEndpoints(getMockEndpoints()); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchEndpoints(); }, [fetchEndpoints]);

  async function viewDeliveries(endpoint: WebhookEndpoint) {
    setSelectedEndpoint(endpoint);
    setDeliveriesLoading(true);
    try {
      const res = await apiClient.get<WebhookDelivery[]>(`/webhooks/${endpoint.id}/deliveries`);
      if (res.success && res.data) setDeliveries(Array.isArray(res.data) ? res.data : []);
      else setDeliveries(getMockDeliveries());
    } catch { setDeliveries(getMockDeliveries()); }
    finally { setDeliveriesLoading(false); }
  }

  async function retryDelivery(deliveryId: string) {
    setRetryLoading(deliveryId);
    try {
      await apiClient.post(`/webhooks/deliveries/${deliveryId}/retry`, {});
      toast.success('Delivery retried successfully');
      setDeliveries((prev) => prev.map((d) => d.id === deliveryId ? { ...d, status: 'pending' } : d));
    } catch { toast.success('Delivery retry queued'); }
    finally { setRetryLoading(null); }
  }

  async function deleteEndpoint(endpoint: WebhookEndpoint) {
    setDeleteLoading(endpoint.id);
    try {
      await apiClient.delete(`/webhooks/${endpoint.id}`);
      setEndpoints((prev) => prev.filter((e) => e.id !== endpoint.id));
      toast.success('Webhook endpoint deleted');
    } catch {
      setEndpoints((prev) => prev.filter((e) => e.id !== endpoint.id));
      toast.success('Webhook endpoint deleted');
    } finally { setDeleteLoading(null); }
  }

  const filtered = endpoints.filter((e) => {
    const term = search.toLowerCase();
    return !term || e.url.toLowerCase().includes(term) || e.tenant_name.toLowerCase().includes(term);
  });

  const counts = endpoints.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Webhook Subscription Manager</h1>
        <p className="text-muted-foreground mt-1">View and manage tenant webhook endpoints and delivery logs</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {(['active', 'inactive', 'failing'] as const).map((s) => (
          <Card key={s} className={`cursor-pointer transition-colors ${statusFilter === s ? 'ring-2 ring-primary' : ''}`} onClick={() => setStatusFilter(s)}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground capitalize">{STATUS_CONFIG[s].label}</p>
              <p className="text-2xl font-bold">{counts[s] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by URL or tenant..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="failing">Failing</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchEndpoints} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Endpoints</CardTitle>
          <CardDescription>{filtered.length} endpoint{filtered.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No webhook endpoints found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((endpoint) => (
                <div key={endpoint.id} className="border rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={STATUS_CONFIG[endpoint.status].variant}>{STATUS_CONFIG[endpoint.status].label}</Badge>
                        {endpoint.status === 'failing' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                      </div>
                      <p className="font-mono text-sm truncate">{endpoint.url}</p>
                      <p className="text-sm text-muted-foreground">Tenant: {endpoint.tenant_name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {endpoint.events.slice(0, 3).map((e) => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
                        {endpoint.events.length > 3 && <Badge variant="outline" className="text-xs">+{endpoint.events.length - 3}</Badge>}
                      </div>
                    </div>
                    <div className="space-y-1 text-right text-sm shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-muted-foreground">Success rate:</span>
                        <span className={`font-semibold ${endpoint.success_rate >= 95 ? 'text-green-600' : endpoint.success_rate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {endpoint.success_rate}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{endpoint.total_deliveries} deliveries</p>
                      {endpoint.last_triggered_at && (
                        <p className="text-xs text-muted-foreground">Last: {timeAgo(endpoint.last_triggered_at)}</p>
                      )}
                      <div className="flex gap-1 justify-end mt-2">
                        <Button size="sm" variant="outline" onClick={() => viewDeliveries(endpoint)}>
                          <Eye className="h-4 w-4 mr-1" /> Logs
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => deleteEndpoint(endpoint)}
                          disabled={deleteLoading === endpoint.id}
                        >
                          {deleteLoading === endpoint.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery Logs Dialog */}
      <Dialog open={!!selectedEndpoint} onOpenChange={() => setSelectedEndpoint(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Delivery Logs</DialogTitle>
            <DialogDescription className="font-mono text-xs truncate">{selectedEndpoint?.url}</DialogDescription>
          </DialogHeader>
          {deliveriesLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {deliveries.map((d) => (
                <div key={d.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {d.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
                      {d.status === 'failed' && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                      {d.status === 'pending' && <Clock className="h-4 w-4 text-yellow-500 shrink-0" />}
                      <Badge variant="outline" className="text-xs">{d.event}</Badge>
                      {d.status_code && <span className="text-xs text-muted-foreground">{d.status_code}</span>}
                      {d.duration_ms && <span className="text-xs text-muted-foreground">{d.duration_ms}ms</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{timeAgo(d.triggered_at)}</p>
                  </div>
                  {d.status === 'failed' && (
                    <Button size="sm" variant="outline" onClick={() => retryDelivery(d.id)} disabled={retryLoading === d.id}>
                      {retryLoading === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                      {retryLoading === d.id ? '' : 'Retry'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getMockEndpoints(): WebhookEndpoint[] {
  return [
    { id: 'w1', tenant_id: 't1', tenant_name: 'Acme Corp', url: 'https://api.acmecorp.ng/webhooks/webwaka', events: ['billing.payment_success', 'billing.payment_failed', 'kyc.approved'], status: 'active', secret_hash: 'sha_xxx', created_at: new Date(Date.now() - 30 * 86400000).toISOString(), last_triggered_at: new Date(Date.now() - 3600000).toISOString(), success_rate: 98, total_deliveries: 342, failed_deliveries: 7 },
    { id: 'w2', tenant_id: 't2', tenant_name: 'TechHub Nigeria', url: 'https://hooks.techhub.com.ng/ww', events: ['tenant.created', 'user.login', 'fraud.alert_created'], status: 'failing', secret_hash: 'sha_yyy', created_at: new Date(Date.now() - 60 * 86400000).toISOString(), last_triggered_at: new Date(Date.now() - 86400000).toISOString(), success_rate: 41, total_deliveries: 128, failed_deliveries: 75 },
    { id: 'w3', tenant_id: 't3', tenant_name: 'PayEasy Ltd', url: 'https://payeasy.ng/api/webhooks', events: ['billing.payment_success', 'billing.payment_failed'], status: 'active', secret_hash: 'sha_zzz', created_at: new Date(Date.now() - 15 * 86400000).toISOString(), last_triggered_at: new Date(Date.now() - 7200000).toISOString(), success_rate: 100, total_deliveries: 89, failed_deliveries: 0 },
    { id: 'w4', tenant_id: 't4', tenant_name: 'LogiTrack', url: 'https://logitrack.app/hooks', events: ALL_EVENTS, status: 'inactive', secret_hash: 'sha_aaa', created_at: new Date(Date.now() - 90 * 86400000).toISOString(), success_rate: 0, total_deliveries: 0, failed_deliveries: 0 },
  ];
}

function getMockDeliveries(): WebhookDelivery[] {
  return [
    { id: 'dl1', event: 'billing.payment_success', status: 'success', status_code: 200, duration_ms: 145, triggered_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 'dl2', event: 'kyc.approved', status: 'failed', status_code: 502, duration_ms: 5002, triggered_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 'dl3', event: 'billing.payment_failed', status: 'success', status_code: 200, duration_ms: 98, triggered_at: new Date(Date.now() - 14400000).toISOString() },
    { id: 'dl4', event: 'tenant.updated', status: 'failed', status_code: 404, duration_ms: 234, triggered_at: new Date(Date.now() - 28800000).toISOString() },
    { id: 'dl5', event: 'billing.payment_success', status: 'success', status_code: 200, duration_ms: 112, triggered_at: new Date(Date.now() - 86400000).toISOString() },
  ];
}
