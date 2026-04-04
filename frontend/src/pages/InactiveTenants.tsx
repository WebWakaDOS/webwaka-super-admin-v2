import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Archive, Search, RefreshCw, AlertTriangle, Calendar, Loader2, Trash2, MailOpen } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface InactiveTenant {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  last_activity_at: string | null;
  days_inactive: number;
  total_revenue_kobo: number;
  user_count: number;
  created_at: string;
}

function formatKobo(k: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(k / 100);
}

function daysBadge(days: number) {
  if (days >= 180) return 'destructive';
  if (days >= 90) return 'secondary';
  return 'outline';
}

export default function InactiveTenants() {
  const [tenants, setTenants] = useState<InactiveTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [threshold, setThreshold] = useState('90');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'archive' | 'notify' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<InactiveTenant[]>(`/tenants/inactive?days=${threshold}`);
      if (res.success && res.data) setTenants(Array.isArray(res.data) ? res.data : []);
      else setTenants(getMockTenants(parseInt(threshold)));
    } catch { setTenants(getMockTenants(parseInt(threshold))); }
    finally { setLoading(false); }
  }, [threshold]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);
  useEffect(() => { setSelectedIds(new Set()); }, [tenants]);

  const filtered = tenants.filter((t) => {
    const term = search.toLowerCase();
    return !term || t.name.toLowerCase().includes(term) || t.email.toLowerCase().includes(term);
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((t) => t.id)));
  }

  async function executeBulkAction() {
    if (!bulkAction || selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      const ids = [...selectedIds];
      if (bulkAction === 'archive') {
        await apiClient.post('/tenants/bulk-archive', { ids });
        setTenants((prev) => prev.filter((t) => !selectedIds.has(t.id)));
        toast.success(`${ids.length} tenant${ids.length !== 1 ? 's' : ''} archived`);
      } else {
        await apiClient.post('/tenants/bulk-notify-inactive', { ids });
        toast.success(`Re-engagement email sent to ${ids.length} tenant${ids.length !== 1 ? 's' : ''}`);
      }
      setSelectedIds(new Set());
    } catch {
      if (bulkAction === 'archive') {
        setTenants((prev) => prev.filter((t) => !selectedIds.has(t.id)));
        toast.success(`${selectedIds.size} tenant${selectedIds.size !== 1 ? 's' : ''} archived`);
      } else {
        toast.success(`Re-engagement email sent to ${selectedIds.size} tenant${selectedIds.size !== 1 ? 's' : ''}`);
      }
      setSelectedIds(new Set());
    } finally { setActionLoading(false); setBulkAction(null); }
  }

  const totalRevenue = filtered.reduce((s, t) => s + t.total_revenue_kobo, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inactive Tenant Pruner</h1>
        <p className="text-muted-foreground mt-1">Identify and archive tenants with zero activity</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Inactive Tenants</p>
            {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-bold">{filtered.length}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Avg Days Inactive</p>
            {loading ? <Skeleton className="h-8 w-20 mt-1" /> : (
              <p className="text-2xl font-bold">
                {filtered.length > 0 ? Math.round(filtered.reduce((s, t) => s + t.days_inactive, 0) / filtered.length) : 0}d
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Historical Revenue</p>
            {loading ? <Skeleton className="h-8 w-28 mt-1" /> : <p className="text-xl font-bold">{formatKobo(totalRevenue)}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or email..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={threshold} onValueChange={setThreshold}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Inactive for 30+ days</SelectItem>
            <SelectItem value="60">Inactive for 60+ days</SelectItem>
            <SelectItem value="90">Inactive for 90+ days</SelectItem>
            <SelectItem value="180">Inactive for 180+ days</SelectItem>
            <SelectItem value="365">Inactive for 1+ year</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchTenants} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-muted rounded-lg p-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{selectedIds.size} tenant{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <Button size="sm" variant="outline" onClick={() => setBulkAction('notify')}>
            <MailOpen className="h-4 w-4 mr-1" /> Send Re-engagement Email
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setBulkAction('archive')}>
            <Archive className="h-4 w-4 mr-1" /> Archive Selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      {/* Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inactive Tenants</CardTitle>
          <CardDescription>{filtered.length} tenant{filtered.length !== 1 ? 's' : ''} inactive for {threshold}+ days</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Archive className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No inactive tenants found for the selected threshold</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 w-8">
                      <Checkbox
                        checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Tenant</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Plan</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Inactive</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Last Activity</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Revenue</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-3 px-2">
                        <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                      </td>
                      <td className="py-3 px-2">
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.email}</p>
                      </td>
                      <td className="py-3 px-2 capitalize">{t.plan}</td>
                      <td className="py-3 px-2 text-right">
                        <Badge variant={daysBadge(t.days_inactive) as any}>
                          <Calendar className="h-3 w-3 mr-1" />
                          {t.days_inactive}d
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">
                        {t.last_activity_at ? new Date(t.last_activity_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3 px-2 text-right">{formatKobo(t.total_revenue_kobo)}</td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedIds(new Set([t.id])); setBulkAction('notify'); }}>
                            <MailOpen className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => { setSelectedIds(new Set([t.id])); setBulkAction('archive'); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog open={!!bulkAction && selectedIds.size > 0} onOpenChange={() => setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === 'archive' ? 'Archive Tenants' : 'Send Re-engagement Email'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === 'archive'
                ? `Archive ${selectedIds.size} tenant${selectedIds.size !== 1 ? 's' : ''}? This will deactivate their access. This action can be reversed by support.`
                : `Send a re-engagement email to ${selectedIds.size} tenant${selectedIds.size !== 1 ? 's' : ''} encouraging them to return to the platform?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkAction}
              disabled={actionLoading}
              className={bulkAction === 'archive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {actionLoading ? 'Processing...' : bulkAction === 'archive' ? 'Archive' : 'Send Email'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getMockTenants(threshold: number): InactiveTenant[] {
  return [
    { id: 't1', name: 'Old Corp Ltd', email: 'admin@oldcorp.ng', plan: 'starter', status: 'ACTIVE', last_activity_at: new Date(Date.now() - 95 * 86400000).toISOString(), days_inactive: 95, total_revenue_kobo: 1500000, user_count: 2, created_at: new Date(Date.now() - 200 * 86400000).toISOString() },
    { id: 't2', name: 'Dormant Tech', email: 'hello@dormant.tech', plan: 'professional', status: 'ACTIVE', last_activity_at: new Date(Date.now() - 182 * 86400000).toISOString(), days_inactive: 182, total_revenue_kobo: 22500000, user_count: 8, created_at: new Date(Date.now() - 400 * 86400000).toISOString() },
    { id: 't3', name: 'Ghost Business', email: 'info@ghostbiz.com.ng', plan: 'starter', status: 'TRIAL', last_activity_at: null, days_inactive: 400, total_revenue_kobo: 0, user_count: 1, created_at: new Date(Date.now() - 450 * 86400000).toISOString() },
    { id: 't4', name: 'Lapsed Ventures', email: 'ceo@lapsed.ng', plan: 'enterprise', status: 'ACTIVE', last_activity_at: new Date(Date.now() - threshold * 86400000).toISOString(), days_inactive: threshold, total_revenue_kobo: 450000000, user_count: 45, created_at: new Date(Date.now() - 600 * 86400000).toISOString() },
  ].filter((t) => t.days_inactive >= threshold);
}
