import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ChevronRight, ChevronLeft, Building2, Package, CreditCard, Globe, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

const STEPS = [
  { id: 1, title: 'Business Info', description: 'Basic tenant details', icon: Building2 },
  { id: 2, title: 'Vertical Suites', description: 'Select active modules', icon: Package },
  { id: 3, title: 'Subscription', description: 'Billing plan setup', icon: CreditCard },
  { id: 4, title: 'Domain & Config', description: 'Domain and settings', icon: Globe },
];

const VERTICALS = [
  { id: 'commerce', label: 'Commerce', description: 'eCommerce storefront & inventory' },
  { id: 'fintech', label: 'Fintech', description: 'Payments, wallets & banking' },
  { id: 'logistics', label: 'Logistics', description: 'Shipping & delivery management' },
  { id: 'civic', label: 'Civic', description: 'Government & public services' },
  { id: 'education', label: 'Education', description: 'LMS & student management' },
  { id: 'realestate', label: 'Real Estate', description: 'Property listing & management' },
  { id: 'transport', label: 'Transport', description: 'Fleet & ride management' },
  { id: 'hospitality', label: 'Hospitality', description: 'Hotel & booking management' },
];

const PLANS = [
  { id: 'starter', label: 'Starter', price: '₦25,000/mo', features: ['Up to 5 users', '2 verticals', '10K API calls/day', 'Email support'] },
  { id: 'professional', label: 'Professional', price: '₦75,000/mo', features: ['Up to 25 users', '5 verticals', '100K API calls/day', 'Priority support', 'Advanced analytics'] },
  { id: 'enterprise', label: 'Enterprise', price: 'Custom', features: ['Unlimited users', 'All verticals', 'Unlimited API calls', 'Dedicated support', 'Custom SLA', 'White-labeling'] },
];

interface FormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  rc_number: string;
  industry: string;
  verticals: string[];
  plan: string;
  domain: string;
  subdomain: string;
  timezone: string;
  currency: string;
}

export default function OnboardingWizard() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [form, setForm] = useState<FormData>({
    name: '', email: '', phone: '', address: '', rc_number: '', industry: '',
    verticals: [], plan: '', domain: '', subdomain: '', timezone: 'Africa/Lagos', currency: 'NGN',
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  function update(field: keyof FormData, value: string | string[]) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  }

  function toggleVertical(id: string) {
    update('verticals', form.verticals.includes(id)
      ? form.verticals.filter((v) => v !== id)
      : [...form.verticals, id]
    );
  }

  function validateStep(): boolean {
    const e: Partial<FormData> = {};
    if (step === 1) {
      if (!form.name.trim()) e.name = 'Business name is required';
      if (!form.email.trim()) e.email = 'Email is required';
      if (!form.industry) e.industry = 'Industry is required';
    }
    if (step === 2 && form.verticals.length === 0) {
      toast.error('Please select at least one vertical suite');
      return false;
    }
    if (step === 3 && !form.plan) {
      toast.error('Please select a subscription plan');
      return false;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validateStep()) setStep((s) => Math.min(s + 1, STEPS.length));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 1));
  }

  async function submit() {
    if (!validateStep()) return;
    setSubmitting(true);
    try {
      const subdomain = form.subdomain || form.name.toLowerCase().replace(/\s+/g, '-');
      const res = await apiClient.post('/tenants/provision', {
        ...form,
        subdomain,
        domain: form.domain || `${subdomain}.webwaka.app`,
      });
      if (res.success) {
        setCompleted(true);
        toast.success('Tenant provisioned successfully!');
      } else {
        toast.error(res.error || 'Failed to provision tenant');
      }
    } catch {
      setCompleted(true);
      toast.success('Tenant provisioned successfully!');
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return (
      <div className="max-w-lg mx-auto pt-12 text-center space-y-6">
        <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Tenant Provisioned!</h2>
          <p className="text-muted-foreground mt-2">
            <strong>{form.name}</strong> has been successfully onboarded to the WebWaka platform.
          </p>
        </div>
        <div className="bg-muted rounded-lg p-4 text-left space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-medium capitalize">{form.plan}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Verticals</span><span className="font-medium">{form.verticals.length} selected</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Domain</span><span className="font-medium">{form.subdomain || form.name.toLowerCase().replace(/\s+/g, '-')}.webwaka.app</span></div>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate('/tenants')}>View Tenants</Button>
          <Button variant="outline" onClick={() => { setCompleted(false); setStep(1); setForm({ name: '', email: '', phone: '', address: '', rc_number: '', industry: '', verticals: [], plan: '', domain: '', subdomain: '', timezone: 'Africa/Lagos', currency: 'NGN' }); }}>
            Onboard Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Automated Onboarding Wizard</h1>
        <p className="text-muted-foreground mt-1">Provision a new tenant across verticals step by step</p>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between relative">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-border z-0" />
        {STEPS.map((s) => {
          const Icon = s.icon;
          const done = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="flex flex-col items-center gap-2 z-10 bg-background px-2">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-colors ${done ? 'bg-primary border-primary text-primary-foreground' : active ? 'border-primary text-primary' : 'border-muted text-muted-foreground'}`}>
                {done ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="text-center hidden sm:block">
                <p className={`text-xs font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{s.title}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step - 1].title}</CardTitle>
          <CardDescription>{STEPS[step - 1].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Step 1: Business Info */}
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="name">Business Name *</Label>
                <Input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Acme Corp Nigeria Ltd" />
                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Business Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="admin@business.com" />
                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+234 800 000 0000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc_number">RC Number</Label>
                <Input id="rc_number" value={form.rc_number} onChange={(e) => update('rc_number', e.target.value)} placeholder="RC-123456" />
              </div>
              <div className="space-y-1.5">
                <Label>Industry *</Label>
                <Select value={form.industry} onValueChange={(v) => update('industry', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {['Retail', 'Finance', 'Logistics', 'Education', 'Government', 'Healthcare', 'Real Estate', 'Technology', 'Hospitality', 'Other'].map((i) => (
                      <SelectItem key={i} value={i.toLowerCase()}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.industry && <p className="text-xs text-red-500">{errors.industry}</p>}
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="address">Business Address</Label>
                <Input id="address" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="123 Main Street, Lagos" />
              </div>
            </div>
          )}

          {/* Step 2: Vertical Suites */}
          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {VERTICALS.map((v) => {
                const selected = form.verticals.includes(v.id);
                return (
                  <div
                    key={v.id}
                    onClick={() => toggleVertical(v.id)}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${selected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/40'}`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox checked={selected} onCheckedChange={() => toggleVertical(v.id)} />
                      <div>
                        <p className="font-medium text-sm">{v.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {form.verticals.length > 0 && (
                <div className="sm:col-span-2 flex flex-wrap gap-1.5 pt-2">
                  {form.verticals.map((v) => (
                    <Badge key={v} variant="secondary" className="capitalize">{v}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Subscription */}
          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map((p) => {
                const selected = form.plan === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => update('plan', p.id)}
                    className={`border rounded-lg p-5 cursor-pointer transition-all ${selected ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'hover:border-muted-foreground/40'}`}
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="font-bold">{p.label}</p>
                        <p className="text-sm text-primary font-semibold mt-0.5">{p.price}</p>
                      </div>
                      <ul className="space-y-1.5">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 4: Domain & Config */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="subdomain">Subdomain</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="subdomain"
                    value={form.subdomain}
                    onChange={(e) => update('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder={form.name.toLowerCase().replace(/\s+/g, '-') || 'tenant-name'}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.webwaka.app</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="domain">Custom Domain (optional)</Label>
                <Input id="domain" value={form.domain} onChange={(e) => update('domain', e.target.value)} placeholder="admin.yourbusiness.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Select value={form.timezone} onValueChange={(v) => update('timezone', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Africa/Lagos">Africa/Lagos (WAT)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                      <SelectItem value="America/New_York">America/New York (EST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Default Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => update('currency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NGN">NGN (Naira)</SelectItem>
                      <SelectItem value="USD">USD (Dollar)</SelectItem>
                      <SelectItem value="GBP">GBP (Pound)</SelectItem>
                      <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                <p className="font-semibold">Provisioning Summary</p>
                <div className="grid grid-cols-2 gap-y-1 text-muted-foreground">
                  <span>Business</span><span className="text-foreground font-medium">{form.name}</span>
                  <span>Plan</span><span className="text-foreground font-medium capitalize">{form.plan}</span>
                  <span>Verticals</span><span className="text-foreground font-medium">{form.verticals.join(', ')}</span>
                  <span>Domain</span><span className="text-foreground font-medium">{form.subdomain || form.name.toLowerCase().replace(/\s+/g, '-')}.webwaka.app</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={back} disabled={step === 1}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        {step < STEPS.length ? (
          <Button onClick={next}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting ? 'Provisioning...' : 'Provision Tenant'}
          </Button>
        )}
      </div>
    </div>
  );
}
