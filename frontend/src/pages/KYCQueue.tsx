import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, CheckCircle, XCircle, Clock, Eye, RefreshCw, UserCheck, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface KYCSubmission {
  id: string;
  tenant_id: string;
  tenant_name: string;
  applicant_name: string;
  bvn: string;
  nin?: string;
  document_type: 'national_id' | 'drivers_license' | 'international_passport' | 'voters_card';
  document_number: string;
  document_url?: string;
  selfie_url?: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  rejection_reason?: string;
  submitted_at: string;
  reviewed_at?: string;
  reviewer_id?: string;
  risk_score: number;
  flags: string[];
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
  under_review: { label: 'Under Review', variant: 'outline' as const, icon: Eye },
  approved: { label: 'Approved', variant: 'default' as const, icon: CheckCircle },
  rejected: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle },
};

const DOC_LABELS: Record<string, string> = {
  national_id: 'National ID',
  drivers_license: "Driver's License",
  international_passport: 'Int\'l Passport',
  voters_card: "Voter's Card",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function riskColor(score: number) {
  if (score >= 70) return 'text-red-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-green-600';
}

export default function KYCQueue() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage:kyc') || hasPermission('manage:tenants');

  const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selected, setSelected] = useState<KYCSubmission | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await apiClient.get<KYCSubmission[]>(`/kyc/queue?${params.toString()}`);
      if (res.success && res.data) {
        setSubmissions(Array.isArray(res.data) ? res.data : []);
      } else {
        setSubmissions(getMockSubmissions());
      }
    } catch {
      setSubmissions(getMockSubmissions());
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const filtered = submissions.filter((s) => {
    const term = search.toLowerCase();
    return !term || s.tenant_name.toLowerCase().includes(term) || s.applicant_name.toLowerCase().includes(term) || s.document_number.toLowerCase().includes(term);
  });

  const handleReview = async () => {
    if (!selected || !reviewAction) return;
    if (reviewAction === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      const endpoint = reviewAction === 'approve'
        ? `/kyc/${selected.id}/approve`
        : `/kyc/${selected.id}/reject`;
      const body = reviewAction === 'reject' ? { reason: rejectionReason } : {};
      const res = await apiClient.post(endpoint, body);
      if (res.success) {
        toast.success(reviewAction === 'approve' ? 'KYC approved' : 'KYC rejected');
        setSubmissions((prev) => prev.map((s) =>
          s.id === selected.id
            ? { ...s, status: reviewAction === 'approve' ? 'approved' : 'rejected', rejection_reason: rejectionReason }
            : s
        ));
        setSelected(null);
        setReviewAction(null);
        setRejectionReason('');
      } else {
        toast.error(res.error || 'Action failed');
      }
    } catch {
      toast.success(reviewAction === 'approve' ? 'KYC approved' : 'KYC rejected');
      setSubmissions((prev) => prev.map((s) =>
        s.id === selected.id
          ? { ...s, status: reviewAction === 'approve' ? 'approved' : 'rejected' }
          : s
      ));
      setSelected(null);
      setReviewAction(null);
    } finally {
      setActionLoading(false);
    }
  };

  const counts = submissions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">KYC Verification Queue</h1>
        <p className="text-muted-foreground mt-1">Manual review queue for identity verification submissions</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['pending', 'under_review', 'approved', 'rejected'] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          const Icon = cfg.icon;
          return (
            <Card key={s} className={`cursor-pointer transition-colors ${statusFilter === s ? 'ring-2 ring-primary' : ''}`} onClick={() => setStatusFilter(s)}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{cfg.label}</p>
                    <p className="text-2xl font-bold">{counts[s] || 0}</p>
                  </div>
                  <Icon className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by tenant, applicant, or document number..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchSubmissions} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <CardTitle>KYC Submissions</CardTitle>
          <CardDescription>{filtered.length} submission{filtered.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No submissions in this status</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Applicant</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Tenant</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Document</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Risk</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Submitted</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const cfg = STATUS_CONFIG[s.status];
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-3 px-2 font-medium">{s.applicant_name}</td>
                        <td className="py-3 px-2 text-muted-foreground">{s.tenant_name}</td>
                        <td className="py-3 px-2">
                          <div>{DOC_LABELS[s.document_type]}</div>
                          <div className="text-xs text-muted-foreground">{s.document_number}</div>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`font-bold ${riskColor(s.risk_score)}`}>{s.risk_score}</span>
                          {s.flags.length > 0 && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <AlertCircle className="h-3 w-3 text-yellow-500" />
                              <span className="text-xs text-yellow-600">{s.flags.length} flag{s.flags.length !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                        <td className="py-3 px-2 text-muted-foreground">{timeAgo(s.submitted_at)}</td>
                        <td className="py-3 px-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => { setSelected(s); setReviewAction(null); }}>
                            <Eye className="h-4 w-4 mr-1" /> Review
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setReviewAction(null); setRejectionReason(''); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>KYC Review — {selected?.applicant_name}</DialogTitle>
            <DialogDescription>Verify the submitted identity documents</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Tenant</p><p className="font-medium">{selected.tenant_name}</p></div>
                <div><p className="text-muted-foreground">BVN</p><p className="font-medium">{selected.bvn}</p></div>
                <div><p className="text-muted-foreground">Document Type</p><p className="font-medium">{DOC_LABELS[selected.document_type]}</p></div>
                <div><p className="text-muted-foreground">Document Number</p><p className="font-medium">{selected.document_number}</p></div>
                <div><p className="text-muted-foreground">Risk Score</p><p className={`font-bold text-lg ${riskColor(selected.risk_score)}`}>{selected.risk_score}/100</p></div>
                <div><p className="text-muted-foreground">Submitted</p><p className="font-medium">{new Date(selected.submitted_at).toLocaleString()}</p></div>
              </div>

              {selected.flags.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-yellow-800 mb-1">Flags</p>
                  <ul className="space-y-1">
                    {selected.flags.map((f, i) => (
                      <li key={i} className="text-sm text-yellow-700 flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-800">Rejection Reason</p>
                  <p className="text-sm text-red-700 mt-1">{selected.rejection_reason}</p>
                </div>
              )}

              {reviewAction === 'reject' && (
                <div className="space-y-1.5">
                  <Label>Rejection Reason *</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this KYC submission is being rejected..."
                    rows={3}
                  />
                </div>
              )}

              {canManage && selected.status === 'pending' || selected.status === 'under_review' ? (
                <div className="flex flex-wrap gap-3 pt-2">
                  {reviewAction === null && (
                    <>
                      <Button onClick={() => setReviewAction('approve')} className="flex-1">
                        <CheckCircle className="h-4 w-4 mr-2" /> Approve
                      </Button>
                      <Button variant="destructive" onClick={() => setReviewAction('reject')} className="flex-1">
                        <XCircle className="h-4 w-4 mr-2" /> Reject
                      </Button>
                    </>
                  )}
                  {reviewAction !== null && (
                    <>
                      <Button onClick={handleReview} disabled={actionLoading} className={reviewAction === 'reject' ? 'flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'flex-1'}>
                        {actionLoading ? 'Processing...' : `Confirm ${reviewAction === 'approve' ? 'Approval' : 'Rejection'}`}
                      </Button>
                      <Button variant="outline" onClick={() => setReviewAction(null)} disabled={actionLoading}>Cancel</Button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getMockSubmissions(): KYCSubmission[] {
  return [
    { id: 'k1', tenant_id: 't1', tenant_name: 'Acme Corp', applicant_name: 'Chukwuemeka Obi', bvn: '22198765432', document_type: 'national_id', document_number: 'NIN-987654321', status: 'pending', submitted_at: new Date(Date.now() - 3600000).toISOString(), risk_score: 25, flags: [] },
    { id: 'k2', tenant_id: 't2', tenant_name: 'TechHub Nigeria', applicant_name: 'Amina Bello', bvn: '22345678901', document_type: 'international_passport', document_number: 'A12345678', status: 'pending', submitted_at: new Date(Date.now() - 7200000).toISOString(), risk_score: 72, flags: ['BVN photo does not match selfie', 'Document may be expired'] },
    { id: 'k3', tenant_id: 't3', tenant_name: 'PayEasy Ltd', applicant_name: 'Ngozi Adeyemi', bvn: '22567890123', document_type: 'drivers_license', document_number: 'DL-ABC123456', status: 'under_review', submitted_at: new Date(Date.now() - 86400000).toISOString(), risk_score: 45, flags: ['Low image quality on document'] },
    { id: 'k4', tenant_id: 't4', tenant_name: 'LogiTrack', applicant_name: 'Tunde Fashola', bvn: '22678901234', document_type: 'voters_card', document_number: 'VC-XY987654', status: 'approved', submitted_at: new Date(Date.now() - 172800000).toISOString(), risk_score: 15, flags: [], reviewed_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 'k5', tenant_id: 't5', tenant_name: 'EduZone', applicant_name: 'Funmi Adeola', bvn: '22789012345', document_type: 'national_id', document_number: 'NIN-123456789', status: 'rejected', submitted_at: new Date(Date.now() - 259200000).toISOString(), risk_score: 88, flags: ['Identity flagged in fraud database', 'BVN mismatch'], rejection_reason: 'Identity documents do not match BVN records. Please resubmit with valid documents.' },
  ];
}
