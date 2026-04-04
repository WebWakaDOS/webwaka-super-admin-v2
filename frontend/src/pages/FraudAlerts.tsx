import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle, Ban, Search, RefreshCw, Shield, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface FraudAlert {
  id: string;
  tenant_id: string;
  tenant_name: string;
  type: 'card_fraud' | 'account_takeover' | 'chargeback' | 'suspicious_login' | 'velocity_abuse' | 'identity_theft';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  description: string;
  amount_kobo?: number;
  ip_address?: string;
  device_fingerprint?: string;
  created_at: string;
  updated_at: string;
}

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', class: 'bg-red-100 text-red-800 border-red-200' },
  high: { label: 'High', class: 'bg-orange-100 text-orange-800 border-orange-200' },
  medium: { label: 'Medium', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  low: { label: 'Low', class: 'bg-blue-100 text-blue-800 border-blue-200' },
};

const STATUS_CONFIG = {
  open: { label: 'Open', variant: 'destructive' as const },
  investigating: { label: 'Investigating', variant: 'secondary' as const },
  resolved: { label: 'Resolved', variant: 'default' as const },
  dismissed: { label: 'Dismissed', variant: 'outline' as const },
};

const TYPE_LABELS: Record<string, string> = {
  card_fraud: 'Card Fraud',
  account_takeover: 'Account Takeover',
  chargeback: 'Chargeback',
  suspicious_login: 'Suspicious Login',
  velocity_abuse: 'Velocity Abuse',
  identity_theft: 'Identity Theft',
};

function formatKobo(kobo: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(kobo / 100);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function FraudAlerts() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage:security');

  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open');
  const [actionAlert, setActionAlert] = useState<{ alert: FraudAlert; action: 'dismiss' | 'suspend' | 'resolve' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      const res = await apiClient.get<FraudAlert[]>(`/fraud/alerts?${params.toString()}`);
      if (res.success && res.data) {
        setAlerts(Array.isArray(res.data) ? res.data : []);
      } else {
        setAlerts(getMockAlerts());
      }
    } catch {
      setAlerts(getMockAlerts());
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const filtered = alerts.filter((a) => {
    const term = search.toLowerCase();
    return !term || a.tenant_name.toLowerCase().includes(term) || a.description.toLowerCase().includes(term) || a.type.includes(term);
  });

  const counts = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  const handleAction = async () => {
    if (!actionAlert) return;
    setActionLoading(true);
    try {
      const { alert, action } = actionAlert;
      let endpoint = '';
      if (action === 'dismiss') endpoint = `/fraud/alerts/${alert.id}/dismiss`;
      else if (action === 'resolve') endpoint = `/fraud/alerts/${alert.id}/resolve`;
      else if (action === 'suspend') endpoint = `/tenants/${alert.tenant_id}/suspend`;

      const res = await apiClient.post(endpoint, {});
      if (res.success) {
        toast.success(
          action === 'dismiss' ? 'Alert dismissed' :
          action === 'resolve' ? 'Alert marked as resolved' :
          'Tenant suspended'
        );
        setAlerts((prev) =>
          action === 'suspend'
            ? prev
            : prev.map((a) => a.id === alert.id ? { ...a, status: action === 'dismiss' ? 'dismissed' : 'resolved' } : a)
        );
      } else {
        toast.error(res.error || 'Action failed');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(false);
      setActionAlert(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fraud Alert Resolution Center</h1>
        <p className="text-muted-foreground mt-1">Review and resolve fraud alerts generated across the platform</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['open', 'investigating', 'resolved', 'dismissed'] as const).map((s) => (
          <Card key={s} className={`cursor-pointer transition-colors ${statusFilter === s ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter(s)}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground capitalize">{STATUS_CONFIG[s].label}</p>
                  <p className="text-2xl font-bold">{counts[s] || 0}</p>
                </div>
                {s === 'open' && <AlertTriangle className="h-8 w-8 text-red-500" />}
                {s === 'investigating' && <Shield className="h-8 w-8 text-yellow-500" />}
                {s === 'resolved' && <CheckCircle className="h-8 w-8 text-green-500" />}
                {s === 'dismissed' && <XCircle className="h-8 w-8 text-muted-foreground" />}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by tenant, type, description..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchAlerts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Alerts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fraud Alerts</CardTitle>
          <CardDescription>{filtered.length} alert{filtered.length !== 1 ? 's' : ''} found</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No alerts match your filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((alert) => (
                <div key={alert.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full border font-medium ${SEVERITY_CONFIG[alert.severity].class}`}>
                        {SEVERITY_CONFIG[alert.severity].label}
                      </span>
                      <Badge variant={STATUS_CONFIG[alert.status].variant}>
                        {STATUS_CONFIG[alert.status].label}
                      </Badge>
                      <Badge variant="outline">{TYPE_LABELS[alert.type] || alert.type}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(alert.created_at)}</span>
                  </div>

                  <div>
                    <p className="font-semibold">{alert.tenant_name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{alert.description}</p>
                    {alert.amount_kobo !== undefined && (
                      <p className="text-sm mt-1">
                        <span className="text-muted-foreground">Amount: </span>
                        <span className="font-medium">{formatKobo(alert.amount_kobo)}</span>
                      </p>
                    )}
                    {alert.ip_address && (
                      <p className="text-xs text-muted-foreground mt-0.5">IP: {alert.ip_address}</p>
                    )}
                  </div>

                  {canManage && alert.status !== 'resolved' && alert.status !== 'dismissed' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActionAlert({ alert, action: 'resolve' })}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Mark Resolved
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActionAlert({ alert, action: 'dismiss' })}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setActionAlert({ alert, action: 'suspend' })}
                      >
                        <Ban className="h-4 w-4 mr-1" />
                        Suspend Tenant
                      </Button>
                    </div>
                  )}

                  {!canManage && (
                    <p className="text-xs text-muted-foreground italic">You need manage:security permission to take actions</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!actionAlert} onOpenChange={() => setActionAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionAlert?.action === 'dismiss' && 'Dismiss Alert'}
              {actionAlert?.action === 'resolve' && 'Mark as Resolved'}
              {actionAlert?.action === 'suspend' && 'Suspend Tenant'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionAlert?.action === 'dismiss' && `Dismiss the fraud alert for ${actionAlert.alert.tenant_name}? This will mark it as non-actionable.`}
              {actionAlert?.action === 'resolve' && `Mark the alert for ${actionAlert?.alert.tenant_name} as resolved?`}
              {actionAlert?.action === 'suspend' && `Suspend tenant "${actionAlert?.alert.tenant_name}"? This will immediately revoke their platform access.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={actionLoading}
              className={actionAlert?.action === 'suspend' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {actionLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getMockAlerts(): FraudAlert[] {
  return [
    { id: 'a1', tenant_id: 't1', tenant_name: 'Acme Corp', type: 'card_fraud', severity: 'critical', status: 'open', description: 'Multiple high-value transactions detected from different countries within 2 hours.', amount_kobo: 4500000, ip_address: '192.168.1.1', created_at: new Date(Date.now() - 3600000).toISOString(), updated_at: new Date().toISOString() },
    { id: 'a2', tenant_id: 't2', tenant_name: 'TechHub Nigeria', type: 'account_takeover', severity: 'high', status: 'investigating', description: 'Admin account login from an unrecognized device in a new location.', ip_address: '41.206.10.5', created_at: new Date(Date.now() - 7200000).toISOString(), updated_at: new Date().toISOString() },
    { id: 'a3', tenant_id: 't3', tenant_name: 'PayEasy Ltd', type: 'velocity_abuse', severity: 'medium', status: 'open', description: 'API rate limit exceeded — 5,000 requests in 60 seconds.', created_at: new Date(Date.now() - 14400000).toISOString(), updated_at: new Date().toISOString() },
    { id: 'a4', tenant_id: 't4', tenant_name: 'LogiTrack', type: 'chargeback', severity: 'high', status: 'open', description: 'Chargeback rate exceeded 2% threshold for the current month.', amount_kobo: 1200000, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date().toISOString() },
    { id: 'a5', tenant_id: 't5', tenant_name: 'EduZone', type: 'suspicious_login', severity: 'low', status: 'resolved', description: 'Login from new browser, verified via 2FA.', ip_address: '102.89.44.12', created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date().toISOString() },
    { id: 'a6', tenant_id: 't6', tenant_name: 'RealProp NG', type: 'identity_theft', severity: 'critical', status: 'open', description: 'BVN linked to this tenant matches a flagged identity record.', created_at: new Date(Date.now() - 43200000).toISOString(), updated_at: new Date().toISOString() },
  ];
}
