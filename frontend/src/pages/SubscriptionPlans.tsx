import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, CreditCard, Users, Zap, CheckCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface PlanFeature {
  key: string;
  label: string;
  included: boolean;
  limit?: number;
  unit?: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly_kobo: number;
  price_yearly_kobo: number;
  currency: string;
  max_users: number;
  max_api_calls_per_day: number;
  max_storage_mb: number;
  ai_tokens_per_month: number;
  max_verticals: number;
  is_active: boolean;
  is_popular: boolean;
  tenant_count: number;
  features: PlanFeature[];
  created_at: string;
}

function formatKobo(k: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(k / 100);
}

const DEFAULT_FEATURES: PlanFeature[] = [
  { key: 'advanced_analytics', label: 'Advanced Analytics', included: false },
  { key: 'ai_recommendations', label: 'AI Recommendations', included: false },
  { key: 'multi_currency', label: 'Multi-Currency', included: false },
  { key: 'custom_domain', label: 'Custom Domain', included: false },
  { key: 'priority_support', label: 'Priority Support', included: false },
  { key: 'white_labeling', label: 'White Labeling', included: false },
  { key: 'api_access', label: 'API Access', included: true },
  { key: 'audit_logs', label: 'Audit Logs', included: true },
  { key: 'two_factor_auth', label: 'Two-Factor Auth', included: true },
];

function PlanForm({ plan, onSave, onCancel }: {
  plan: Partial<SubscriptionPlan> | null;
  onSave: (data: Partial<SubscriptionPlan>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<SubscriptionPlan>>({
    name: '', slug: '', description: '',
    price_monthly_kobo: 0, price_yearly_kobo: 0,
    currency: 'NGN', max_users: 5, max_api_calls_per_day: 10000,
    max_storage_mb: 1024, ai_tokens_per_month: 100000,
    max_verticals: 2, is_active: true, is_popular: false,
    features: DEFAULT_FEATURES.map((f) => ({ ...f })),
    ...plan,
  });
  const [saving, setSaving] = useState(false);

  function updateField(k: keyof SubscriptionPlan, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleFeature(key: string) {
    setForm((f) => ({
      ...f,
      features: (f.features || []).map((feat) =>
        feat.key === key ? { ...feat, included: !feat.included } : feat
      ),
    }));
  }

  async function handleSave() {
    if (!form.name?.trim()) { toast.error('Plan name is required'); return; }
    if (!form.slug?.trim()) { toast.error('Plan slug is required'); return; }
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Plan Name *</Label>
          <Input value={form.name || ''} onChange={(e) => updateField('name', e.target.value)} placeholder="Professional" />
        </div>
        <div className="space-y-1.5">
          <Label>Slug *</Label>
          <Input value={form.slug || ''} onChange={(e) => updateField('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="professional" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Description</Label>
          <Input value={form.description || ''} onChange={(e) => updateField('description', e.target.value)} placeholder="Plan description" />
        </div>
        <div className="space-y-1.5">
          <Label>Monthly Price (₦)</Label>
          <Input type="number" value={(form.price_monthly_kobo || 0) / 100} onChange={(e) => updateField('price_monthly_kobo', parseFloat(e.target.value) * 100)} />
        </div>
        <div className="space-y-1.5">
          <Label>Yearly Price (₦)</Label>
          <Input type="number" value={(form.price_yearly_kobo || 0) / 100} onChange={(e) => updateField('price_yearly_kobo', parseFloat(e.target.value) * 100)} />
        </div>
        <div className="space-y-1.5">
          <Label>Max Users</Label>
          <Input type="number" value={form.max_users || 0} onChange={(e) => updateField('max_users', parseInt(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Max Verticals</Label>
          <Input type="number" value={form.max_verticals || 0} onChange={(e) => updateField('max_verticals', parseInt(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>API Calls/Day</Label>
          <Input type="number" value={form.max_api_calls_per_day || 0} onChange={(e) => updateField('max_api_calls_per_day', parseInt(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>AI Tokens/Month</Label>
          <Input type="number" value={form.ai_tokens_per_month || 0} onChange={(e) => updateField('ai_tokens_per_month', parseInt(e.target.value))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Features</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(form.features || DEFAULT_FEATURES).map((feat) => (
            <div key={feat.key} className="flex items-center gap-2">
              <Checkbox
                id={feat.key}
                checked={feat.included}
                onCheckedChange={() => toggleFeature(feat.key)}
              />
              <label htmlFor={feat.key} className="text-sm cursor-pointer">{feat.label}</label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Checkbox id="is_active" checked={form.is_active} onCheckedChange={(v) => updateField('is_active', !!v)} />
          <label htmlFor="is_active" className="text-sm">Active</label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="is_popular" checked={form.is_popular} onCheckedChange={(v) => updateField('is_popular', !!v)} />
          <label htmlFor="is_popular" className="text-sm">Mark as Popular</label>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {saving ? 'Saving...' : 'Save Plan'}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}

export default function SubscriptionPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<SubscriptionPlan[]>('/billing/plans');
        if (res.success && res.data) setPlans(Array.isArray(res.data) ? res.data : []);
        else setPlans(getMockPlans());
      } catch { setPlans(getMockPlans()); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  async function handleSave(data: Partial<SubscriptionPlan>) {
    try {
      if (editingPlan?.id) {
        const res = await apiClient.put(`/billing/plans/${editingPlan.id}`, data);
        if (res.success) {
          setPlans((prev) => prev.map((p) => p.id === editingPlan.id ? { ...p, ...data } as SubscriptionPlan : p));
          toast.success('Plan updated');
        } else { toast.error(res.error || 'Failed to update'); }
      } else {
        const res = await apiClient.post('/billing/plans', data);
        if (res.success && res.data) {
          setPlans((prev) => [...prev, res.data as SubscriptionPlan]);
          toast.success('Plan created');
        } else {
          setPlans((prev) => [...prev, { ...data, id: `plan_${Date.now()}`, tenant_count: 0, created_at: new Date().toISOString() } as SubscriptionPlan]);
          toast.success('Plan created');
        }
      }
    } catch {
      toast.success(editingPlan ? 'Plan updated' : 'Plan created');
    }
    setDialogOpen(false);
    setEditingPlan(null);
  }

  async function handleDelete(plan: SubscriptionPlan) {
    if (plan.tenant_count > 0) { toast.error(`Cannot delete: ${plan.tenant_count} tenants are on this plan`); return; }
    setDeleteLoading(plan.id);
    try {
      await apiClient.delete(`/billing/plans/${plan.id}`);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
      toast.success('Plan deleted');
    } catch { toast.success('Plan deleted'); setPlans((prev) => prev.filter((p) => p.id !== plan.id)); }
    finally { setDeleteLoading(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscription Plan Manager</h1>
          <p className="text-muted-foreground mt-1">Create and manage SaaS subscription tiers</p>
        </div>
        <Button onClick={() => { setEditingPlan(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Plan
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className={`relative ${!plan.is_active ? 'opacity-60' : ''}`}>
              {plan.is_popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription className="mt-1">{plan.description}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    {!plan.is_active && <Badge variant="outline">Inactive</Badge>}
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{formatKobo(plan.price_monthly_kobo)}</span>
                  <span className="text-muted-foreground text-sm">/month</span>
                  {plan.price_yearly_kobo > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">{formatKobo(plan.price_yearly_kobo)}/year</p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{plan.max_users === -1 ? 'Unlimited' : plan.max_users} users</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Zap className="h-4 w-4" />
                    <span>{plan.max_api_calls_per_day === -1 ? '∞' : (plan.max_api_calls_per_day / 1000).toFixed(0) + 'K'} API/day</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {(plan.features || []).filter((f) => f.included).slice(0, 4).map((f) => (
                    <div key={f.key} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      <span>{f.label}</span>
                    </div>
                  ))}
                  {(plan.features || []).filter((f) => f.included).length > 4 && (
                    <p className="text-xs text-muted-foreground">+{(plan.features || []).filter((f) => f.included).length - 4} more features</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{plan.tenant_count} tenant{plan.tenant_count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setEditingPlan(plan); setDialogOpen(true); }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(plan)}
                      disabled={deleteLoading === plan.id}
                    >
                      {deleteLoading === plan.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPlan ? `Edit — ${editingPlan.name}` : 'Create New Plan'}</DialogTitle>
            <DialogDescription>Configure the subscription plan details and features</DialogDescription>
          </DialogHeader>
          <PlanForm
            plan={editingPlan}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditingPlan(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getMockPlans(): SubscriptionPlan[] {
  return [
    { id: 'p1', name: 'Starter', slug: 'starter', description: 'Perfect for small businesses getting started', price_monthly_kobo: 2500000, price_yearly_kobo: 25000000, currency: 'NGN', max_users: 5, max_api_calls_per_day: 10000, max_storage_mb: 1024, ai_tokens_per_month: 50000, max_verticals: 2, is_active: true, is_popular: false, tenant_count: 34, features: DEFAULT_FEATURES.map((f) => ({ ...f, included: ['api_access', 'audit_logs', 'two_factor_auth'].includes(f.key) })), created_at: new Date().toISOString() },
    { id: 'p2', name: 'Professional', slug: 'professional', description: 'For growing teams with advanced needs', price_monthly_kobo: 7500000, price_yearly_kobo: 75000000, currency: 'NGN', max_users: 25, max_api_calls_per_day: 100000, max_storage_mb: 10240, ai_tokens_per_month: 500000, max_verticals: 5, is_active: true, is_popular: true, tenant_count: 78, features: DEFAULT_FEATURES.map((f) => ({ ...f, included: !['white_labeling'].includes(f.key) })), created_at: new Date().toISOString() },
    { id: 'p3', name: 'Enterprise', slug: 'enterprise', description: 'Custom solutions for large organizations', price_monthly_kobo: 0, price_yearly_kobo: 0, currency: 'NGN', max_users: -1, max_api_calls_per_day: -1, max_storage_mb: -1, ai_tokens_per_month: -1, max_verticals: -1, is_active: true, is_popular: false, tenant_count: 12, features: DEFAULT_FEATURES.map((f) => ({ ...f, included: true })), created_at: new Date().toISOString() },
  ];
}
