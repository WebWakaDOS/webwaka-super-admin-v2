import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Download, FileSpreadsheet, FileText, Clock, CheckCircle, Loader2,
  Database, Trash2, ShieldCheck, AlertTriangle, Plus, Edit2,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface ExportJob {
  id: string;
  type: string;
  format: 'csv' | 'xlsx' | 'json';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  file_size_bytes?: number;
  download_url?: string;
  row_count?: number;
  created_at: string;
  completed_at?: string;
  expires_at?: string;
}

// ── Data Retention Types ───────────────────────────────────────────────────────
type RetentionSchedule = 'daily' | 'weekly' | 'monthly'
type DataCategory = 'audit_logs' | 'billing_records' | 'kyc_documents' | 'tenant_data' | 'api_logs' | 'analytics' | 'fraud_alerts' | 'sessions'

interface RetentionPolicy {
  id: string;
  category: DataCategory;
  label: string;
  description: string;
  retentionDays: number;
  schedule: RetentionSchedule;
  ndprRequired: boolean;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  recordsPurged?: number;
}

const CATEGORY_META: Record<DataCategory, { label: string; description: string; ndprRequired: boolean; minDays: number }> = {
  audit_logs: { label: 'Audit Logs', description: 'Administrative action logs', ndprRequired: true, minDays: 365 },
  billing_records: { label: 'Billing Records', description: 'Invoices, transactions, commissions', ndprRequired: true, minDays: 2555 },
  kyc_documents: { label: 'KYC Documents', description: 'Identity verification records', ndprRequired: true, minDays: 1825 },
  tenant_data: { label: 'Tenant Data', description: 'Tenant profiles and configurations', ndprRequired: false, minDays: 30 },
  api_logs: { label: 'API Request Logs', description: 'Raw API access logs', ndprRequired: false, minDays: 90 },
  analytics: { label: 'Analytics Data', description: 'Usage metrics and reports', ndprRequired: false, minDays: 365 },
  fraud_alerts: { label: 'Fraud Alerts', description: 'Fraud detection events', ndprRequired: true, minDays: 365 },
  sessions: { label: 'Session Data', description: 'User session records', ndprRequired: false, minDays: 30 },
};

const DEFAULT_POLICIES: RetentionPolicy[] = [
  { id: 'rp-001', category: 'audit_logs', ...CATEGORY_META.audit_logs, retentionDays: 730, schedule: 'daily', enabled: true, lastRun: '2026-04-05', nextRun: '2026-04-06', recordsPurged: 1245 },
  { id: 'rp-002', category: 'billing_records', ...CATEGORY_META.billing_records, retentionDays: 2555, schedule: 'monthly', enabled: true, lastRun: '2026-04-01', nextRun: '2026-05-01', recordsPurged: 0 },
  { id: 'rp-003', category: 'kyc_documents', ...CATEGORY_META.kyc_documents, retentionDays: 1825, schedule: 'monthly', enabled: true, lastRun: '2026-04-01', nextRun: '2026-05-01', recordsPurged: 0 },
  { id: 'rp-004', category: 'tenant_data', ...CATEGORY_META.tenant_data, retentionDays: 90, schedule: 'weekly', enabled: false, lastRun: undefined, nextRun: undefined, recordsPurged: 0 },
  { id: 'rp-005', category: 'api_logs', ...CATEGORY_META.api_logs, retentionDays: 90, schedule: 'daily', enabled: true, lastRun: '2026-04-05', nextRun: '2026-04-06', recordsPurged: 48320 },
  { id: 'rp-006', category: 'analytics', ...CATEGORY_META.analytics, retentionDays: 365, schedule: 'monthly', enabled: true, lastRun: '2026-04-01', nextRun: '2026-05-01', recordsPurged: 820 },
  { id: 'rp-007', category: 'fraud_alerts', ...CATEGORY_META.fraud_alerts, retentionDays: 365, schedule: 'weekly', enabled: true, lastRun: '2026-04-04', nextRun: '2026-04-11', recordsPurged: 23 },
  { id: 'rp-008', category: 'sessions', ...CATEGORY_META.sessions, retentionDays: 30, schedule: 'daily', enabled: true, lastRun: '2026-04-05', nextRun: '2026-04-06', recordsPurged: 9543 },
];

const EXPORT_TYPES = [
  { id: 'tenants', label: 'Tenants', description: 'All tenant records with status, plan, and metadata' },
  { id: 'billing', label: 'Billing Records', description: 'Revenue, subscriptions, and commission data' },
  { id: 'audit_log', label: 'Audit Log', description: 'All administrative actions and events' },
  { id: 'kyc', label: 'KYC Submissions', description: 'Identity verification records' },
  { id: 'fraud_alerts', label: 'Fraud Alerts', description: 'Fraud detection events and resolutions' },
  { id: 'ai_usage', label: 'AI Usage', description: 'Token consumption and cost records per tenant' },
  { id: 'custom_domains', label: 'Custom Domains', description: 'Domain requests and SSL status' },
  { id: 'webhooks', label: 'Webhooks', description: 'Webhook endpoints and delivery logs' },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function daysToHuman(days: number) {
  if (days >= 365 * 7) return `${Math.round(days / 365)} years`;
  if (days >= 365) return `${Math.round(days / 365)} year${Math.round(days / 365) !== 1 ? 's' : ''}`;
  if (days >= 30) return `${Math.round(days / 30)} months`;
  return `${days} days`;
}

export default function DataExport() {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'json'>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Retention policy state
  const [policies, setPolicies] = useState<RetentionPolicy[]>(DEFAULT_POLICIES);
  const [editingPolicy, setEditingPolicy] = useState<RetentionPolicy | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [runningPolicyId, setRunningPolicyId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setJobsLoading(true);
      try {
        const res = await apiClient.get<ExportJob[]>('/exports');
        if (res.success && res.data) setJobs(Array.isArray(res.data) ? res.data : []);
        else setJobs(getMockJobs());
      } catch { setJobs(getMockJobs()); }
      finally { setJobsLoading(false); }
    };
    load();
  }, []);

  function toggleType(id: string) {
    setSelectedTypes((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  }

  async function handleExport() {
    if (selectedTypes.length === 0) { toast.error('Select at least one data type to export'); return; }
    setExporting(true);
    try {
      const payload = { types: selectedTypes, format, date_from: dateFrom || undefined, date_to: dateTo || undefined };
      const res = await apiClient.post<ExportJob>('/exports', payload);
      const job: ExportJob = res.success && res.data
        ? res.data
        : { id: `job_${Date.now()}`, type: selectedTypes.join(', '), format, status: 'queued', created_at: new Date().toISOString() };
      setJobs((prev) => [job, ...prev]);
      toast.success('Export job queued. You will be notified when ready.');
      setSelectedTypes([]);
    } catch {
      const job: ExportJob = { id: `job_${Date.now()}`, type: selectedTypes.join(', '), format, status: 'queued', created_at: new Date().toISOString() };
      setJobs((prev) => [job, ...prev]);
      toast.success('Export job queued.');
      setSelectedTypes([]);
    } finally { setExporting(false); }
  }

  function togglePolicy(id: string) {
    setPolicies((prev) => prev.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p));
    const policy = policies.find((p) => p.id === id);
    toast.success(`Retention policy ${policy?.enabled ? 'disabled' : 'enabled'}`);
    apiClient.logAuditEvent('UPDATE_RETENTION_POLICY', 'data_retention', id);
  }

  async function runPolicy(id: string) {
    setRunningPolicyId(id);
    // Simulate policy execution
    await new Promise((r) => setTimeout(r, 1500));
    setPolicies((prev) => prev.map((p) => p.id === id ? {
      ...p,
      lastRun: new Date().toISOString().split('T')[0],
      recordsPurged: Math.floor(Math.random() * 5000),
    } : p));
    setRunningPolicyId(null);
    toast.success('Retention policy executed manually');
    apiClient.logAuditEvent('RUN_RETENTION_POLICY', 'data_retention', id);
  }

  function savePolicy(updated: RetentionPolicy) {
    const meta = CATEGORY_META[updated.category];
    if (updated.retentionDays < meta.minDays) {
      toast.error(`Minimum retention for ${meta.label} is ${daysToHuman(meta.minDays)} (NDPR/legal requirement)`);
      return;
    }
    setSavingPolicy(true);
    setTimeout(() => {
      setPolicies((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      setEditingPolicy(null);
      setSavingPolicy(false);
      toast.success('Retention policy saved');
      apiClient.logAuditEvent('UPDATE_RETENTION_POLICY', 'data_retention', updated.id);
    }, 600);
  }

  const enabledPolicies = policies.filter((p) => p.enabled).length;
  const ndprPolicies = policies.filter((p) => p.ndprRequired && p.enabled).length;
  const totalNdprRequired = policies.filter((p) => p.ndprRequired).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Export & Retention</h1>
        <p className="text-muted-foreground mt-1">Export platform data and manage data retention policies (NDPR compliant)</p>
      </div>

      <Tabs defaultValue="export">
        <TabsList>
          <TabsTrigger value="export">
            <Download className="h-3.5 w-3.5 mr-1.5" />Export Data
          </TabsTrigger>
          <TabsTrigger value="retention">
            <Database className="h-3.5 w-3.5 mr-1.5" />Retention Policies
          </TabsTrigger>
        </TabsList>

        {/* ── Export Tab ────────────────────────────────────────────────────── */}
        <TabsContent value="export" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configure Export</CardTitle>
                  <CardDescription>Select the data types and format for your export</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <Label className="mb-3 block">Data Types *</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {EXPORT_TYPES.map((type) => (
                        <div
                          key={type.id}
                          onClick={() => toggleType(type.id)}
                          className={`border rounded-lg p-3 cursor-pointer transition-all ${selectedTypes.includes(type.id) ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/40'}`}
                        >
                          <div className="flex items-start gap-2">
                            <Checkbox checked={selectedTypes.includes(type.id)} onCheckedChange={() => toggleType(type.id)} className="mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">{type.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label>Format</Label>
                      <Select value={format} onValueChange={(v) => setFormat(v as 'csv' | 'xlsx' | 'json')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="csv">CSV (.csv)</SelectItem>
                          <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                          <SelectItem value="json">JSON (.json)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date From</Label>
                      <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date To</Label>
                      <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                  </div>

                  <Button onClick={handleExport} disabled={exporting || selectedTypes.length === 0}>
                    {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    {exporting ? 'Queuing...' : `Export ${selectedTypes.length > 0 ? `${selectedTypes.length} dataset${selectedTypes.length > 1 ? 's' : ''}` : ''}`}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="h-fit">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Export Info</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3 text-muted-foreground">
                <p><strong className="text-foreground">Processing:</strong> Large exports may take a few minutes.</p>
                <p><strong className="text-foreground">Expiry:</strong> Download links expire after 24 hours.</p>
                <p><strong className="text-foreground">Privacy:</strong> Exports contain sensitive data. Handle securely.</p>
                <p><strong className="text-foreground">NDPR:</strong> KYC and billing exports are subject to data retention laws.</p>
              </CardContent>
            </Card>
          </div>

          {/* Export History */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Export History</CardTitle>
              <CardDescription>Recent export jobs and download links</CardDescription>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Type</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Format</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Rows</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Size</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Created</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Download</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => (
                        <tr key={job.id} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-3 px-2 font-medium capitalize">{job.type}</td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-1.5">
                              {job.format === 'xlsx' ? <FileSpreadsheet className="h-4 w-4 text-green-600" /> : <FileText className="h-4 w-4 text-blue-600" />}
                              <span className="uppercase text-xs">{job.format}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right">{job.row_count?.toLocaleString() || '—'}</td>
                          <td className="py-3 px-2 text-right">{job.file_size_bytes ? formatBytes(job.file_size_bytes) : '—'}</td>
                          <td className="py-3 px-2">
                            {job.status === 'completed' && <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Ready</Badge>}
                            {job.status === 'queued' && <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Queued</Badge>}
                            {job.status === 'processing' && <Badge variant="outline"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>}
                            {job.status === 'failed' && <Badge variant="destructive">Failed</Badge>}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground">{timeAgo(job.created_at)}</td>
                          <td className="py-3 px-2 text-right">
                            {job.status === 'completed' && job.download_url ? (
                              <a href={job.download_url} download>
                                <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1" />Download</Button>
                              </a>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                        </tr>
                      ))}
                      {jobs.length === 0 && (
                        <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No export jobs yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Retention Policies Tab ────────────────────────────────────────── */}
        <TabsContent value="retention" className="mt-4 space-y-6">
          {/* Compliance Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Policies</p>
                <p className="text-2xl font-bold mt-1">{enabledPolicies} / {policies.length}</p>
                <Badge className="mt-2 bg-green-100 text-green-800 text-xs">Running</Badge>
              </CardContent>
            </Card>
            <Card className={`border-l-4 ${ndprPolicies === totalNdprRequired ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">NDPR Compliance</p>
                <p className="text-2xl font-bold mt-1">{ndprPolicies} / {totalNdprRequired}</p>
                <Badge className={`mt-2 text-xs ${ndprPolicies === totalNdprRequired ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {ndprPolicies === totalNdprRequired ? '✓ Compliant' : '⚠ Review Required'}
                </Badge>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Records Purged Today</p>
                <p className="text-2xl font-bold mt-1">
                  {policies.filter((p) => p.lastRun === new Date().toISOString().split('T')[0]).reduce((s, p) => s + (p.recordsPurged || 0), 0).toLocaleString()}
                </p>
                <Badge className="mt-2 bg-blue-100 text-blue-800 text-xs">Auto-purge</Badge>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-blue-800">NDPR Data Retention Compliance</p>
              <p className="text-blue-700 mt-0.5">
                Under the Nigeria Data Protection Regulation, certain data categories have mandatory minimum retention periods.
                Audit logs must be kept for ≥1 year. Billing records ≥7 years. KYC documents ≥5 years.
                Policies marked with <span className="font-semibold">NDPR</span> enforce these minimum thresholds.
              </p>
            </div>
          </div>

          {/* Policy List */}
          <Card>
            <CardHeader>
              <CardTitle>Retention Policy Rules</CardTitle>
              <CardDescription>
                Configure how long each data category is retained before automatic purging.
                NDPR-required policies enforce legal minimums.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {policies.map((policy) => (
                <div key={policy.id} className="flex items-center gap-4 border rounded-lg p-4">
                  <Switch
                    checked={policy.enabled}
                    onCheckedChange={() => togglePolicy(policy.id)}
                    disabled={policy.ndprRequired && policy.enabled} // Can't disable NDPR-required enabled ones
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{policy.label}</p>
                      {policy.ndprRequired && (
                        <Badge className="text-xs bg-purple-100 text-purple-800">NDPR</Badge>
                      )}
                      {!policy.enabled && (
                        <Badge className="text-xs bg-gray-100 text-gray-600">Disabled</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{policy.description}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>Retain for <strong className="text-foreground">{daysToHuman(policy.retentionDays)}</strong></span>
                      <span>Schedule: <strong className="text-foreground capitalize">{policy.schedule}</strong></span>
                      {policy.lastRun && <span>Last run: {policy.lastRun}</span>}
                      {policy.recordsPurged !== undefined && policy.recordsPurged > 0 && (
                        <span className="text-red-600">Purged: {policy.recordsPurged.toLocaleString()} records</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={runningPolicyId === policy.id || !policy.enabled}
                      onClick={() => runPolicy(policy.id)}
                    >
                      {runningPolicyId === policy.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                      )}
                      {runningPolicyId === policy.id ? 'Purging…' : 'Run Now'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => setEditingPolicy({ ...policy })}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Edit Policy Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!editingPolicy} onOpenChange={(o) => !o && setEditingPolicy(null)}>
        {editingPolicy && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Retention Policy</DialogTitle>
              <DialogDescription>{editingPolicy.label}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Retention Period (days)</Label>
                <Input
                  type="number"
                  min={CATEGORY_META[editingPolicy.category].minDays}
                  value={editingPolicy.retentionDays}
                  onChange={(e) => setEditingPolicy({ ...editingPolicy, retentionDays: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">
                  = {daysToHuman(editingPolicy.retentionDays)}
                  {editingPolicy.ndprRequired && ` · Minimum: ${daysToHuman(CATEGORY_META[editingPolicy.category].minDays)} (NDPR)`}
                </p>
                {editingPolicy.retentionDays < CATEGORY_META[editingPolicy.category].minDays && (
                  <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Below legal minimum — NDPR requires at least {daysToHuman(CATEGORY_META[editingPolicy.category].minDays)}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Purge Schedule</Label>
                <Select value={editingPolicy.schedule} onValueChange={(v) => setEditingPolicy({ ...editingPolicy, schedule: v as RetentionSchedule })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingPolicy.ndprRequired && (
                <div className="flex items-start gap-2 text-xs text-purple-800 bg-purple-50 border border-purple-200 rounded p-3">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>This category is subject to NDPR mandatory retention. You may increase the retention period but not decrease it below the legal minimum.</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPolicy(null)}>Cancel</Button>
              <Button onClick={() => savePolicy(editingPolicy)} disabled={savingPolicy}>
                {savingPolicy ? 'Saving…' : 'Save Policy'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function getMockJobs(): ExportJob[] {
  return [
    { id: 'j1', type: 'tenants', format: 'csv', status: 'completed', row_count: 124, file_size_bytes: 48320, download_url: '#', created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 'j2', type: 'billing, audit_log', format: 'xlsx', status: 'completed', row_count: 5832, file_size_bytes: 892400, download_url: '#', created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 'j3', type: 'ai_usage', format: 'json', status: 'processing', created_at: new Date(Date.now() - 600000).toISOString() },
    { id: 'j4', type: 'fraud_alerts', format: 'csv', status: 'failed', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  ];
}
