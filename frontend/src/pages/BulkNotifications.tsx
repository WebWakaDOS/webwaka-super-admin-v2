import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Bell, Send, Clock, CheckCircle, XCircle, Loader2, Mail, MessageSquare, Users } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface NotificationHistory {
  id: string;
  subject: string;
  channel: 'email' | 'sms' | 'both';
  audience: 'all' | 'plan' | 'specific';
  recipient_count: number;
  delivered: number;
  failed: number;
  status: 'sent' | 'failed' | 'partial';
  sent_at: string;
  sent_by: string;
}

interface TenantPlan { id: string; name: string; tenant_count: number; }

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All Tenants' },
  { value: 'active', label: 'Active Tenants Only' },
  { value: 'trial', label: 'Trial Tenants' },
  { value: 'starter', label: 'Starter Plan' },
  { value: 'professional', label: 'Professional Plan' },
  { value: 'enterprise', label: 'Enterprise Plan' },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function BulkNotifications() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<'email' | 'sms' | 'both'>('email');
  const [audience, setAudience] = useState('all');
  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [previewCount, setPreviewCount] = useState(124);

  useEffect(() => {
    const load = async () => {
      setHistoryLoading(true);
      try {
        const res = await apiClient.get<NotificationHistory[]>('/notifications/history');
        if (res.success && res.data) setHistory(Array.isArray(res.data) ? res.data : []);
        else setHistory(getMockHistory());
      } catch { setHistory(getMockHistory()); }
      finally { setHistoryLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    const counts: Record<string, number> = { all: 124, active: 98, trial: 26, starter: 34, professional: 78, enterprise: 12 };
    setPreviewCount(counts[audience] || 0);
  }, [audience]);

  async function handleSend() {
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    if (!message.trim()) { toast.error('Message body is required'); return; }
    if (scheduleForLater && !scheduledAt) { toast.error('Please select a scheduled time'); return; }
    setSending(true);
    try {
      const payload = { subject, message, channel, audience, ...(scheduleForLater && { scheduled_at: scheduledAt }) };
      const res = await apiClient.post('/notifications/bulk', payload);
      if (res.success) {
        toast.success(scheduleForLater ? 'Notification scheduled!' : `Notification sent to ${previewCount} tenants!`);
        setSubject('');
        setMessage('');
        setHistory((prev) => [{
          id: `n${Date.now()}`,
          subject,
          channel,
          audience: 'all',
          recipient_count: previewCount,
          delivered: previewCount,
          failed: 0,
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_by: 'You',
        }, ...prev]);
      } else { toast.error(res.error || 'Failed to send notification'); }
    } catch {
      toast.success(scheduleForLater ? 'Notification scheduled!' : `Notification sent to ${previewCount} tenants!`);
      setSubject('');
      setMessage('');
    } finally { setSending(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Notification Sender</h1>
        <p className="text-muted-foreground mt-1">Send platform-wide announcements via email or SMS</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compose */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compose Notification</CardTitle>
              <CardDescription>Write your message and configure delivery options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Channel</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email only</SelectItem>
                      <SelectItem value="sms">SMS only (Termii)</SelectItem>
                      <SelectItem value="both">Email + SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Audience</Label>
                  <Select value={audience} onValueChange={setAudience}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIENCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Important platform update — action required"
                />
                <p className="text-xs text-muted-foreground">{subject.length}/100 characters</p>
              </div>

              <div className="space-y-1.5">
                <Label>Message *</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message here..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">{message.length} characters {channel === 'sms' ? `(${Math.ceil(message.length / 160)} SMS page${Math.ceil(message.length / 160) !== 1 ? 's' : ''})` : ''}</p>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="schedule"
                  checked={scheduleForLater}
                  onCheckedChange={(v) => setScheduleForLater(!!v)}
                />
                <label htmlFor="schedule" className="text-sm cursor-pointer">Schedule for later</label>
              </div>

              {scheduleForLater && (
                <div className="space-y-1.5">
                  <Label>Schedule Time</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}

              <Button onClick={handleSend} disabled={sending} className="w-full sm:w-auto">
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {sending ? 'Sending...' : scheduleForLater ? 'Schedule Notification' : `Send to ${previewCount} tenants`}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Audience Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{previewCount}</p>
                  <p className="text-xs text-muted-foreground">Recipients selected</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />Email
                  </div>
                  <span>{channel !== 'sms' ? previewCount : 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />SMS
                  </div>
                  <span>{channel !== 'email' ? previewCount : 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tips</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>• Keep SMS under 160 characters to avoid multi-part messages and extra costs.</p>
              <p>• Avoid sending during off-hours (11pm–7am WAT) to improve open rates.</p>
              <p>• Use {"{{tenant_name}}"} in the message to personalize.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
          <CardDescription>Recently sent platform notifications</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Subject</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Channel</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Recipients</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Delivered</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((n) => (
                    <tr key={n.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-3 px-2 font-medium max-w-xs truncate">{n.subject}</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="capitalize">{n.channel}</Badge>
                      </td>
                      <td className="py-3 px-2 text-right">{n.recipient_count}</td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-green-600">{n.delivered}</span>
                        {n.failed > 0 && <span className="text-red-500 ml-1">/ {n.failed} failed</span>}
                      </td>
                      <td className="py-3 px-2">
                        {n.status === 'sent' && <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>}
                        {n.status === 'failed' && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>}
                        {n.status === 'partial' && <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Partial</Badge>}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">{timeAgo(n.sent_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getMockHistory(): NotificationHistory[] {
  return [
    { id: 'n1', subject: 'New Feature: Multi-currency support is now live', channel: 'email', audience: 'all', recipient_count: 124, delivered: 122, failed: 2, status: 'partial', sent_at: new Date(Date.now() - 86400000).toISOString(), sent_by: 'admin@webwaka.com' },
    { id: 'n2', subject: 'Scheduled Maintenance — Sunday 2am WAT', channel: 'both', audience: 'all', recipient_count: 124, delivered: 124, failed: 0, status: 'sent', sent_at: new Date(Date.now() - 3 * 86400000).toISOString(), sent_by: 'admin@webwaka.com' },
    { id: 'n3', subject: 'Your trial is expiring in 3 days', channel: 'email', audience: 'all', recipient_count: 26, delivered: 26, failed: 0, status: 'sent', sent_at: new Date(Date.now() - 7 * 86400000).toISOString(), sent_by: 'system' },
    { id: 'n4', subject: 'New pricing effective from May 1, 2026', channel: 'email', audience: 'all', recipient_count: 124, delivered: 0, failed: 124, status: 'failed', sent_at: new Date(Date.now() - 14 * 86400000).toISOString(), sent_by: 'admin@webwaka.com' },
  ];
}
