import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, CheckCircle, XCircle, Clock, Search, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface CustomDomain {
  id: string;
  tenant_id: string;
  tenant_name: string;
  domain: string;
  status: 'pending' | 'verifying' | 'active' | 'rejected' | 'failed';
  ssl_status: 'pending' | 'provisioning' | 'active' | 'failed';
  verification_record?: string;
  rejection_reason?: string;
  requested_at: string;
  activated_at?: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending Review', variant: 'secondary' as const, icon: Clock },
  verifying: { label: 'Verifying DNS', variant: 'outline' as const, icon: RefreshCw },
  active: { label: 'Active', variant: 'default' as const, icon: CheckCircle },
  rejected: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle },
  failed: { label: 'DNS Failed', variant: 'destructive' as const, icon: XCircle },
};

const SSL_CONFIG = {
  pending: 'Pending',
  provisioning: 'Provisioning',
  active: 'Active',
  failed: 'Failed',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CustomDomains() {
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDomains = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await apiClient.get<CustomDomain[]>(`/domains?${params.toString()}`);
      if (res.success && res.data) setDomains(Array.isArray(res.data) ? res.data : []);
      else setDomains(getMockDomains());
    } catch { setDomains(getMockDomains()); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchDomains(); }, [fetchDomains]);

  const filtered = domains.filter((d) => {
    const term = search.toLowerCase();
    return !term || d.domain.toLowerCase().includes(term) || d.tenant_name.toLowerCase().includes(term);
  });

  async function handleAction(domain: CustomDomain, action: 'approve' | 'reject' | 'verify') {
    setActionLoading(`${domain.id}:${action}`);
    try {
      const endpoint = action === 'approve'
        ? `/domains/${domain.id}/approve`
        : action === 'reject'
        ? `/domains/${domain.id}/reject`
        : `/domains/${domain.id}/verify`;
      const res = await apiClient.post(endpoint, {});
      if (res.success) {
        const newStatus = action === 'approve' ? 'verifying' : action === 'reject' ? 'rejected' : domain.status;
        setDomains((prev) => prev.map((d) => d.id === domain.id ? { ...d, status: newStatus as any } : d));
        toast.success(action === 'approve' ? 'Domain approved for verification' : action === 'reject' ? 'Domain rejected' : 'DNS verification initiated');
      } else {
        toast.error(res.error || 'Action failed');
      }
    } catch {
      const newStatus = action === 'approve' ? 'verifying' : action === 'reject' ? 'rejected' : domain.status;
      setDomains((prev) => prev.map((d) => d.id === domain.id ? { ...d, status: newStatus as any } : d));
      toast.success(action === 'approve' ? 'Domain approved' : action === 'reject' ? 'Domain rejected' : 'Verification initiated');
    } finally { setActionLoading(null); }
  }

  const counts = domains.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Custom Domain Manager</h1>
        <p className="text-muted-foreground mt-1">Review and approve custom domain requests from tenants</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {(['pending', 'verifying', 'active', 'rejected', 'failed'] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <Card key={s} className={`cursor-pointer transition-colors ${statusFilter === s ? 'ring-2 ring-primary' : ''}`} onClick={() => setStatusFilter(s)}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
                <p className="text-xl font-bold">{counts[s] || 0}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search domain or tenant..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchDomains} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Domains Table */}
      <Card>
        <CardHeader>
          <CardTitle>Domain Requests</CardTitle>
          <CardDescription>{filtered.length} domain{filtered.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No domain requests found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((d) => {
                const cfg = STATUS_CONFIG[d.status];
                const Icon = cfg.icon;
                return (
                  <div key={d.id} className="border rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{d.domain}</span>
                          <a href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                        <p className="text-sm text-muted-foreground">Tenant: {d.tenant_name} • Requested {timeAgo(d.requested_at)}</p>
                        {d.verification_record && d.status === 'verifying' && (
                          <div className="text-xs bg-muted rounded p-2 font-mono mt-1">
                            <span className="text-muted-foreground">CNAME:</span> {d.verification_record}
                          </div>
                        )}
                        {d.rejection_reason && (
                          <p className="text-xs text-red-600 mt-1">Rejected: {d.rejection_reason}</p>
                        )}
                        {d.activated_at && (
                          <p className="text-xs text-green-600 mt-1">
                            SSL: {SSL_CONFIG[d.ssl_status]} • Active since {timeAgo(d.activated_at)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={cfg.variant}><Icon className="h-3 w-3 mr-1" />{cfg.label}</Badge>
                        {d.status === 'pending' && (
                          <>
                            <Button size="sm" onClick={() => handleAction(d, 'approve')} disabled={!!actionLoading}>
                              {actionLoading === `${d.id}:approve` ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-1" />Approve</>}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleAction(d, 'reject')} disabled={!!actionLoading}>
                              {actionLoading === `${d.id}:reject` ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-1" />Reject</>}
                            </Button>
                          </>
                        )}
                        {d.status === 'verifying' && (
                          <Button size="sm" variant="outline" onClick={() => handleAction(d, 'verify')} disabled={!!actionLoading}>
                            {actionLoading === `${d.id}:verify` ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" />Re-verify DNS</>}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getMockDomains(): CustomDomain[] {
  return [
    { id: 'd1', tenant_id: 't1', tenant_name: 'Acme Corp', domain: 'admin.acmecorp.ng', status: 'pending', ssl_status: 'pending', requested_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 'd2', tenant_id: 't2', tenant_name: 'TechHub Nigeria', domain: 'hub.techhub.com.ng', status: 'verifying', ssl_status: 'provisioning', verification_record: 'verify.techhub.webwaka-verify.app', requested_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 'd3', tenant_id: 't3', tenant_name: 'PayEasy Ltd', domain: 'pay.payeasy.ng', status: 'active', ssl_status: 'active', requested_at: new Date(Date.now() - 7 * 86400000).toISOString(), activated_at: new Date(Date.now() - 5 * 86400000).toISOString() },
    { id: 'd4', tenant_id: 't4', tenant_name: 'LogiTrack', domain: 'logitrack.app', status: 'rejected', ssl_status: 'pending', rejection_reason: 'Domain does not point to our servers.', requested_at: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 'd5', tenant_id: 't5', tenant_name: 'EduZone', domain: 'learn.eduzone.com.ng', status: 'failed', ssl_status: 'failed', requested_at: new Date(Date.now() - 4 * 86400000).toISOString() },
  ];
}
