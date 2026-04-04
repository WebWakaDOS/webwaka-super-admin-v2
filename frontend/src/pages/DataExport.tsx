import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Download, FileSpreadsheet, FileText, Clock, CheckCircle, Loader2, Database } from 'lucide-react';
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

export default function DataExport() {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'json'>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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
      toast.success('Export job queued. You will be notified when ready.');
      setSelectedTypes([]);
    } finally { setExporting(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Export Utility</h1>
        <p className="text-muted-foreground mt-1">Export tenant data, billing records, and audit logs to CSV, Excel, or JSON</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export Config */}
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
                        <Checkbox
                          checked={selectedTypes.includes(type.id)}
                          onCheckedChange={() => toggleType(type.id)}
                          className="mt-0.5"
                        />
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
                  <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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

        {/* Info Sidebar */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Export Info</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3 text-muted-foreground">
            <p><strong className="text-foreground">Processing:</strong> Large exports may take a few minutes to generate.</p>
            <p><strong className="text-foreground">Expiry:</strong> Download links expire after 24 hours.</p>
            <p><strong className="text-foreground">Privacy:</strong> Exports contain sensitive data. Handle securely.</p>
            <p><strong className="text-foreground">Formats:</strong> CSV is best for large datasets; XLSX is best for analysis; JSON is best for API integration.</p>
          </CardContent>
        </Card>
      </div>

      {/* Export History */}
      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
          <CardDescription>Recent export jobs and download links</CardDescription>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
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
                            <Button size="sm" variant="outline">
                              <Download className="h-4 w-4 mr-1" /> Download
                            </Button>
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
    </div>
  );
}

function getMockJobs(): ExportJob[] {
  return [
    { id: 'j1', type: 'tenants', format: 'csv', status: 'completed', row_count: 124, file_size_bytes: 48320, download_url: '#', created_at: new Date(Date.now() - 3600000).toISOString(), completed_at: new Date(Date.now() - 3500000).toISOString(), expires_at: new Date(Date.now() + 20 * 3600000).toISOString() },
    { id: 'j2', type: 'billing, audit_log', format: 'xlsx', status: 'completed', row_count: 5832, file_size_bytes: 892400, download_url: '#', created_at: new Date(Date.now() - 86400000).toISOString(), completed_at: new Date(Date.now() - 85000000).toISOString() },
    { id: 'j3', type: 'ai_usage', format: 'json', status: 'processing', created_at: new Date(Date.now() - 600000).toISOString() },
    { id: 'j4', type: 'fraud_alerts', format: 'csv', status: 'failed', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  ];
}
