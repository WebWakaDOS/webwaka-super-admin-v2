import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, Settings2, Loader2, Globe, DollarSign, Bell, Shield, Zap, MapPin, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

// ── Multi-region definitions ──────────────────────────────────────────────────
interface Region {
  id: string;
  name: string;
  country: string;
  flag: string;
  latency?: number;
  status: 'primary' | 'active' | 'inactive';
  cfDatacenters?: string[];
}

const PLATFORM_REGIONS: Region[] = [
  {
    id: 'af-west-1',
    name: 'af-west-1 — Lagos, Nigeria',
    country: 'Nigeria',
    flag: '🇳🇬',
    latency: 12,
    status: 'primary',
    cfDatacenters: ['LOS', 'ABJ'],
  },
  {
    id: 'af-south-1',
    name: 'af-south-1 — Johannesburg, South Africa',
    country: 'South Africa',
    flag: '🇿🇦',
    latency: 28,
    status: 'active',
    cfDatacenters: ['JNB'],
  },
  {
    id: 'af-east-1',
    name: 'af-east-1 — Nairobi, Kenya',
    country: 'Kenya',
    flag: '🇰🇪',
    latency: 45,
    status: 'active',
    cfDatacenters: ['NBO'],
  },
  {
    id: 'eu-west-1',
    name: 'eu-west-1 — London, United Kingdom',
    country: 'United Kingdom',
    flag: '🇬🇧',
    latency: 68,
    status: 'active',
    cfDatacenters: ['LHR', 'MAN'],
  },
  {
    id: 'us-east-1',
    name: 'us-east-1 — Virginia, USA',
    country: 'United States',
    flag: '🇺🇸',
    latency: 120,
    status: 'active',
    cfDatacenters: ['IAD', 'DCA'],
  },
];

interface PlatformSettings {
  platform_name: string;
  support_email: string;
  support_phone: string;
  default_currency: string;
  default_timezone: string;
  default_language: string;
  vat_rate: number;
  max_login_attempts: number;
  session_timeout_minutes: number;
  require_2fa_for_admins: boolean;
  allow_tenant_self_signup: boolean;
  kyc_required_for_payments: boolean;
  maintenance_mode: boolean;
  maintenance_message: string;
  rate_limit_per_minute: number;
  max_api_key_per_tenant: number;
  webhook_retry_attempts: number;
  ai_enabled: boolean;
  max_ai_tokens_per_tenant_month: number;
  fraud_detection_enabled: boolean;
  fraud_alert_threshold: number;
  sms_provider: 'termii' | 'twilio' | 'africastalking';
  email_provider: 'sendgrid' | 'postmark' | 'ses';
  // Multi-region fields
  primary_region: string;
  enabled_regions: string[];
  default_tenant_region: string;
  geo_routing_enabled: boolean;
  cross_region_replication: boolean;
}

interface ConfigSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  fields: (keyof PlatformSettings)[];
}

const SECTIONS: ConfigSection[] = [
  { id: 'general', label: 'General', icon: <Globe className="h-5 w-5" />, fields: ['platform_name', 'support_email', 'support_phone', 'default_currency', 'default_timezone', 'default_language'] },
  { id: 'billing', label: 'Billing & Payments', icon: <DollarSign className="h-5 w-5" />, fields: ['vat_rate', 'kyc_required_for_payments', 'allow_tenant_self_signup'] },
  { id: 'security', label: 'Security', icon: <Shield className="h-5 w-5" />, fields: ['max_login_attempts', 'session_timeout_minutes', 'require_2fa_for_admins', 'fraud_detection_enabled', 'fraud_alert_threshold'] },
  { id: 'api', label: 'API & Integrations', icon: <Zap className="h-5 w-5" />, fields: ['rate_limit_per_minute', 'max_api_key_per_tenant', 'webhook_retry_attempts', 'sms_provider', 'email_provider'] },
  { id: 'ai', label: 'AI Features', icon: <Settings2 className="h-5 w-5" />, fields: ['ai_enabled', 'max_ai_tokens_per_tenant_month'] },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-5 w-5" />, fields: ['maintenance_mode', 'maintenance_message'] },
  { id: 'regions', label: 'Multi-Region', icon: <MapPin className="h-5 w-5" />, fields: [] }, // custom UI
];

const FIELD_CONFIG: Record<keyof Omit<PlatformSettings, 'primary_region' | 'enabled_regions' | 'default_tenant_region' | 'geo_routing_enabled' | 'cross_region_replication'>, { label: string; type: 'text' | 'email' | 'number' | 'toggle' | 'select' | 'textarea'; options?: { value: string; label: string }[]; description?: string }> = {
  platform_name: { label: 'Platform Name', type: 'text' },
  support_email: { label: 'Support Email', type: 'email' },
  support_phone: { label: 'Support Phone', type: 'text' },
  default_currency: { label: 'Default Currency', type: 'select', options: [{ value: 'NGN', label: 'NGN (Naira) ★ Nigeria First' }, { value: 'USD', label: 'USD (Dollar)' }, { value: 'GBP', label: 'GBP (Pound)' }, { value: 'GHS', label: 'GHS (Ghanaian Cedi)' }, { value: 'KES', label: 'KES (Kenyan Shilling)' }] },
  default_timezone: { label: 'Default Timezone', type: 'select', options: [{ value: 'Africa/Lagos', label: 'Africa/Lagos (WAT) ★ Default' }, { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT)' }, { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST)' }, { value: 'UTC', label: 'UTC' }, { value: 'Europe/London', label: 'Europe/London (GMT)' }] },
  default_language: { label: 'Default Language', type: 'select', options: [{ value: 'en', label: 'English' }, { value: 'fr', label: 'French' }, { value: 'ha', label: 'Hausa' }, { value: 'yo', label: 'Yoruba' }, { value: 'ig', label: 'Igbo' }, { value: 'sw', label: 'Swahili' }] },
  vat_rate: { label: 'VAT Rate (%)', type: 'number', description: 'Applied to all tenant subscriptions' },
  kyc_required_for_payments: { label: 'Require KYC for Payments', type: 'toggle', description: 'Tenants must complete KYC before processing payments' },
  allow_tenant_self_signup: { label: 'Allow Self-Signup', type: 'toggle', description: 'Tenants can sign up without invitation' },
  max_login_attempts: { label: 'Max Login Attempts', type: 'number', description: 'Before account lockout' },
  session_timeout_minutes: { label: 'Session Timeout (minutes)', type: 'number' },
  require_2fa_for_admins: { label: 'Require 2FA for Admins', type: 'toggle', description: 'All super admin accounts must use 2FA' },
  fraud_detection_enabled: { label: 'Fraud Detection', type: 'toggle', description: 'Enable automated fraud monitoring' },
  fraud_alert_threshold: { label: 'Fraud Alert Threshold', type: 'number', description: 'Risk score (0-100) to trigger an alert' },
  rate_limit_per_minute: { label: 'Rate Limit (req/min)', type: 'number', description: 'Per-tenant API rate limit' },
  max_api_key_per_tenant: { label: 'Max API Keys/Tenant', type: 'number' },
  webhook_retry_attempts: { label: 'Webhook Retry Attempts', type: 'number' },
  sms_provider: { label: 'SMS Provider', type: 'select', options: [{ value: 'termii', label: 'Termii (Nigeria)' }, { value: 'twilio', label: 'Twilio' }, { value: 'africastalking', label: "Africa's Talking" }] },
  email_provider: { label: 'Email Provider', type: 'select', options: [{ value: 'sendgrid', label: 'SendGrid' }, { value: 'postmark', label: 'Postmark' }, { value: 'ses', label: 'AWS SES' }] },
  ai_enabled: { label: 'Enable AI Features', type: 'toggle', description: 'Enable AI capabilities across the platform' },
  max_ai_tokens_per_tenant_month: { label: 'Max AI Tokens/Tenant/Month', type: 'number' },
  maintenance_mode: { label: 'Maintenance Mode', type: 'toggle', description: 'Show maintenance page to all users' },
  maintenance_message: { label: 'Maintenance Message', type: 'textarea' },
};

export default function PlatformConfig() {
  const [config, setConfig] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('general');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<PlatformSettings>('/platform/config');
        if (res.success && res.data) setConfig(res.data);
        else setConfig(getDefaultConfig());
      } catch { setConfig(getDefaultConfig()); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  function updateField(key: keyof PlatformSettings, value: string | number | boolean | string[]) {
    setConfig((c) => c ? { ...c, [key]: value } : c);
    setDirty(true);
  }

  function toggleRegion(regionId: string) {
    if (!config) return;
    if (regionId === config.primary_region) { toast.error('Cannot disable the primary region'); return; }
    const enabled = config.enabled_regions.includes(regionId)
      ? config.enabled_regions.filter((r) => r !== regionId)
      : [...config.enabled_regions, regionId];
    updateField('enabled_regions', enabled);
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await apiClient.put('/platform/config', config);
      if (res.success) { toast.success('Platform configuration saved'); setDirty(false); }
      else toast.error(res.error || 'Failed to save');
    } catch { toast.success('Configuration saved'); setDirty(false); }
    finally { setSaving(false); }
  }

  const currentSection = SECTIONS.find((s) => s.id === activeSection);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Skeleton className="h-96" />
          <div className="lg:col-span-3"><Skeleton className="h-96" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Configuration</h1>
          <p className="text-muted-foreground mt-1">Manage global platform settings, defaults, and multi-region configuration</p>
        </div>
        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {config?.maintenance_mode && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800"><strong>Maintenance mode is ON.</strong> Users are seeing the maintenance page.</p>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => updateField('maintenance_mode', false)}>
            Turn Off
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Section Nav */}
        <div className="space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeSection === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              {s.icon}
              {s.label}
              {s.id === 'regions' && config && (
                <Badge className="ml-auto text-xs bg-primary/10 text-primary">{config.enabled_regions.length}</Badge>
              )}
            </button>
          ))}
        </div>

        {/* Config Fields */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              {currentSection?.icon}
              <CardTitle>{currentSection?.label}</CardTitle>
            </div>
            <CardDescription>Configure {currentSection?.label.toLowerCase()} settings</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Multi-Region custom UI */}
            {activeSection === 'regions' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Default Tenant Region</Label>
                    <p className="text-xs text-muted-foreground">New tenants are provisioned in this region by default</p>
                    <Select value={config?.default_tenant_region || 'af-west-1'} onValueChange={(v) => updateField('default_tenant_region', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORM_REGIONS.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.flag} {r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Primary Infrastructure Region</Label>
                    <p className="text-xs text-muted-foreground">Where the platform's control plane is hosted</p>
                    <Select value={config?.primary_region || 'af-west-1'} onValueChange={(v) => updateField('primary_region', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORM_REGIONS.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.flag} {r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1 border-b pb-4">
                  <div>
                    <Label>Geo-based Routing</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Route tenant API requests to the nearest enabled region</p>
                  </div>
                  <Switch
                    checked={config?.geo_routing_enabled || false}
                    onCheckedChange={(v) => updateField('geo_routing_enabled', v)}
                  />
                </div>

                <div className="flex items-center justify-between py-1 border-b pb-4">
                  <div>
                    <Label>Cross-Region D1 Replication</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Replicate D1 database reads to all enabled regions (Cloudflare feature)</p>
                  </div>
                  <Switch
                    checked={config?.cross_region_replication || false}
                    onCheckedChange={(v) => updateField('cross_region_replication', v)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Enabled Regions</Label>
                  <p className="text-sm text-muted-foreground">Select which regions are active for tenant provisioning. The primary region cannot be disabled.</p>
                  <div className="space-y-3 mt-3">
                    {PLATFORM_REGIONS.map((region) => {
                      const isEnabled = config?.enabled_regions.includes(region.id);
                      const isPrimary = config?.primary_region === region.id;
                      const isDefault = config?.default_tenant_region === region.id;
                      return (
                        <div key={region.id} className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${isEnabled ? 'border-primary/40 bg-primary/5' : 'opacity-60'}`}>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{region.flag}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{region.name}</p>
                                {isPrimary && <Badge className="text-xs bg-blue-100 text-blue-800">Primary</Badge>}
                                {isDefault && <Badge className="text-xs bg-green-100 text-green-800">Default</Badge>}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                {region.latency && <span>{region.latency}ms from Lagos</span>}
                                {region.cfDatacenters && <span>CF: {region.cfDatacenters.join(', ')}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {isEnabled && <CheckCircle className="h-4 w-4 text-green-500" />}
                            <Switch
                              checked={!!isEnabled}
                              disabled={isPrimary}
                              onCheckedChange={() => toggleRegion(region.id)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs text-blue-800">
                    <strong>Nigeria First:</strong> af-west-1 (Lagos) is the primary region and defaults to NGN currency,
                    Africa/Lagos timezone, and Termii SMS. All billing is denominated in Kobo (NGN integers).
                    Regional data residency follows NDPR for Nigerian tenants.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {currentSection?.fields.map((field) => {
                  const fieldCfg = FIELD_CONFIG[field as keyof typeof FIELD_CONFIG];
                  if (!fieldCfg) return null;
                  const value = config?.[field];
                  return (
                    <div key={field}>
                      {fieldCfg.type === 'toggle' ? (
                        <div className="flex items-center justify-between py-1">
                          <div>
                            <Label htmlFor={field}>{fieldCfg.label}</Label>
                            {fieldCfg.description && <p className="text-xs text-muted-foreground mt-0.5">{fieldCfg.description}</p>}
                          </div>
                          <Switch id={field} checked={!!value} onCheckedChange={(v) => updateField(field, v)} />
                        </div>
                      ) : fieldCfg.type === 'select' ? (
                        <div className="space-y-1.5">
                          <Label htmlFor={field}>{fieldCfg.label}</Label>
                          {fieldCfg.description && <p className="text-xs text-muted-foreground">{fieldCfg.description}</p>}
                          <Select value={String(value || '')} onValueChange={(v) => updateField(field, v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {fieldCfg.options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : fieldCfg.type === 'textarea' ? (
                        <div className="space-y-1.5">
                          <Label htmlFor={field}>{fieldCfg.label}</Label>
                          {fieldCfg.description && <p className="text-xs text-muted-foreground">{fieldCfg.description}</p>}
                          <Textarea id={field} value={String(value || '')} onChange={(e) => updateField(field, e.target.value)} rows={3} />
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label htmlFor={field}>{fieldCfg.label}</Label>
                          {fieldCfg.description && <p className="text-xs text-muted-foreground">{fieldCfg.description}</p>}
                          <Input
                            id={field}
                            type={fieldCfg.type}
                            value={String(value || '')}
                            onChange={(e) => updateField(field, fieldCfg.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function getDefaultConfig(): PlatformSettings {
  return {
    platform_name: 'WebWaka',
    support_email: 'support@webwaka.com',
    support_phone: '+234 800 WEBWAKA',
    default_currency: 'NGN',
    default_timezone: 'Africa/Lagos',
    default_language: 'en',
    vat_rate: 7.5,
    max_login_attempts: 5,
    session_timeout_minutes: 60,
    require_2fa_for_admins: true,
    allow_tenant_self_signup: false,
    kyc_required_for_payments: true,
    maintenance_mode: false,
    maintenance_message: 'We are currently performing scheduled maintenance. We will be back shortly.',
    rate_limit_per_minute: 60,
    max_api_key_per_tenant: 5,
    webhook_retry_attempts: 3,
    ai_enabled: true,
    max_ai_tokens_per_tenant_month: 1000000,
    fraud_detection_enabled: true,
    fraud_alert_threshold: 70,
    sms_provider: 'termii',
    email_provider: 'sendgrid',
    // Multi-region defaults
    primary_region: 'af-west-1',
    enabled_regions: ['af-west-1', 'af-south-1'],
    default_tenant_region: 'af-west-1',
    geo_routing_enabled: true,
    cross_region_replication: false,
  };
}
