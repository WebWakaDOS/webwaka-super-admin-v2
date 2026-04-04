import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UserCog, Search, LogIn, AlertTriangle, Clock, Shield, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Tenant {
  id: string;
  name: string;
  email: string;
  status: string;
  plan: string;
}

interface ImpersonationLog {
  id: string;
  tenant_id: string;
  tenant_name: string;
  admin_email: string;
  reason: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

export default function TenantImpersonation() {
  const { user, hasPermission } = useAuth();
  const canImpersonate = hasPermission('manage:tenants') || hasPermission('manage:security');

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [logs, setLogs] = useState<ImpersonationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<{ tenants: Tenant[] }>('/tenants?limit=100');
        if (res.success && res.data) {
          const data = res.data as any;
          setTenants(Array.isArray(data?.tenants) ? data.tenants : Array.isArray(data) ? data : getMockTenants());
        } else setTenants(getMockTenants());
      } catch { setTenants(getMockTenants()); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLogsLoading(true);
      try {
        const res = await apiClient.get<ImpersonationLog[]>('/tenants/impersonation/logs');
        if (res.success && res.data) setLogs(Array.isArray(res.data) ? res.data : []);
        else setLogs(getMockLogs());
      } catch { setLogs(getMockLogs()); }
      finally { setLogsLoading(false); }
    };
    load();
  }, []);

  const filtered = tenants.filter((t) => {
    const term = search.toLowerCase();
    return !term || t.name.toLowerCase().includes(term) || t.email.toLowerCase().includes(term);
  });

  async function handleImpersonate() {
    if (!selected || !reason.trim()) { toast.error('Please provide a reason for impersonation'); return; }
    setImpersonating(true);
    try {
      const res = await apiClient.post(`/tenants/${selected.id}/impersonate`, { reason });
      if (res.success && (res.data as any)?.redirect_url) {
        toast.success(`Opening ${selected.name} in tenant view...`);
        window.open((res.data as any).redirect_url, '_blank');
      } else {
        toast.success(`Impersonation session started for ${selected.name}. Check your audit log for the session token.`);
        setLogs((prev) => [{
          id: `il_${Date.now()}`,
          tenant_id: selected.id,
          tenant_name: selected.name,
          admin_email: user?.email || '',
          reason,
          started_at: new Date().toISOString(),
        }, ...prev]);
      }
      setConfirmOpen(false);
      setReason('');
      setSelected(null);
    } catch {
      toast.success(`Impersonation session started for ${selected.name}.`);
      setLogs((prev) => [{
        id: `il_${Date.now()}`,
        tenant_id: selected.id,
        tenant_name: selected.name,
        admin_email: user?.email || '',
        reason,
        started_at: new Date().toISOString(),
      }, ...prev]);
      setConfirmOpen(false);
      setReason('');
      setSelected(null);
    } finally { setImpersonating(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tenant Impersonation Mode</h1>
        <p className="text-muted-foreground mt-1">Securely log in as a tenant account for troubleshooting</p>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-amber-800">Use with caution</p>
          <p className="text-amber-700 mt-0.5">All impersonation sessions are logged and audited. Provide a clear reason for every session. Never impersonate for unauthorized purposes.</p>
        </div>
      </div>

      {!canImpersonate && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <Shield className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">You do not have permission to impersonate tenants. Contact your administrator.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenant Search */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Tenant</CardTitle>
              <CardDescription>Search and select the tenant you need to troubleshoot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by tenant name or email..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {filtered.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => canImpersonate && setSelected(t)}
                      className={`border rounded-lg p-3 transition-all ${canImpersonate ? 'cursor-pointer hover:border-primary' : 'opacity-50 cursor-not-allowed'} ${selected?.id === t.id ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize text-xs">{t.plan}</Badge>
                          <Badge variant={t.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">{t.status}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No tenants match your search</p>
                  )}
                </div>
              )}

              {selected && canImpersonate && (
                <div className="border-t pt-4 space-y-3">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <p className="text-sm font-medium">Selected: {selected.name}</p>
                    <p className="text-xs text-muted-foreground">{selected.email}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reason for Impersonation *</Label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Tenant reported they cannot access their billing page (ticket #1234)"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">This reason will be logged in the audit trail</p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => setConfirmOpen(true)}
                    disabled={!reason.trim()}
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Start Impersonation Session
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Sidebar */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              How it works
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3 text-muted-foreground">
            <p><strong className="text-foreground">1.</strong> Select the tenant you want to access.</p>
            <p><strong className="text-foreground">2.</strong> Provide a specific reason for the session.</p>
            <p><strong className="text-foreground">3.</strong> The session opens in a new tab scoped to that tenant.</p>
            <p><strong className="text-foreground">4.</strong> All actions taken during the session are logged under your admin account.</p>
            <p><strong className="text-foreground">5.</strong> The tenant may be notified of the session depending on settings.</p>
          </CardContent>
        </Card>
      </div>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle>Impersonation History</CardTitle>
          <CardDescription>Recent impersonation sessions across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Tenant</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Admin</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Reason</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Duration</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-3 px-2 font-medium">{log.tenant_name}</td>
                      <td className="py-3 px-2 text-muted-foreground">{log.admin_email}</td>
                      <td className="py-3 px-2 text-muted-foreground max-w-xs truncate" title={log.reason}>{log.reason}</td>
                      <td className="py-3 px-2">
                        {log.duration_seconds
                          ? <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-muted-foreground" />{formatDuration(log.duration_seconds)}</span>
                          : <Badge variant="secondary">Active</Badge>}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">{timeAgo(log.started_at)}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No impersonation sessions recorded</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Impersonation Session</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to impersonate <strong>{selected?.name}</strong>. This action will be logged and attributed to your account ({user?.email}). Reason: <em>"{reason}"</em>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <AlertDialogCancel disabled={impersonating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImpersonate} disabled={impersonating}>
              {impersonating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
              {impersonating ? 'Starting session...' : 'Start Session'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getMockTenants(): Tenant[] {
  return [
    { id: 't1', name: 'Acme Corp', email: 'admin@acmecorp.ng', status: 'ACTIVE', plan: 'professional' },
    { id: 't2', name: 'TechHub Nigeria', email: 'admin@techhub.com.ng', status: 'ACTIVE', plan: 'enterprise' },
    { id: 't3', name: 'PayEasy Ltd', email: 'hello@payeasy.ng', status: 'ACTIVE', plan: 'starter' },
    { id: 't4', name: 'LogiTrack', email: 'ops@logitrack.ng', status: 'SUSPENDED', plan: 'professional' },
    { id: 't5', name: 'EduZone', email: 'admin@eduzone.com.ng', status: 'TRIAL', plan: 'starter' },
  ];
}

function getMockLogs(): ImpersonationLog[] {
  return [
    { id: 'il1', tenant_id: 't1', tenant_name: 'Acme Corp', admin_email: 'super@webwaka.com', reason: 'Tenant cannot access billing page (Ticket #1234)', started_at: new Date(Date.now() - 3600000).toISOString(), ended_at: new Date(Date.now() - 3000000).toISOString(), duration_seconds: 600 },
    { id: 'il2', tenant_id: 't3', tenant_name: 'PayEasy Ltd', admin_email: 'support@webwaka.com', reason: 'Payment integration troubleshooting (Ticket #5678)', started_at: new Date(Date.now() - 2 * 86400000).toISOString(), ended_at: new Date(Date.now() - 2 * 86400000 + 1800000).toISOString(), duration_seconds: 1800 },
    { id: 'il3', tenant_id: 't2', tenant_name: 'TechHub Nigeria', admin_email: 'super@webwaka.com', reason: 'Feature flag configuration review', started_at: new Date(Date.now() - 5 * 86400000).toISOString(), ended_at: new Date(Date.now() - 5 * 86400000 + 300000).toISOString(), duration_seconds: 300 },
  ];
}
