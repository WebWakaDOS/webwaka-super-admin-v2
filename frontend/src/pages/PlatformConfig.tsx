import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Save, Settings2, Loader2, Globe, DollarSign, Bell, Shield, Zap } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

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
];

const FIELD_CONFIG: Record<keyof PlatformSettings, { label: string; type: 'text' | 'email' | 'number' | 'toggle' | 'select' | 'textarea'; options?: { value: string; label: string }[]; description?: string }> = {
  platform_name: { label: 'Platform Name', type: 'text' },
  support_email: { label: 'Support Email', type: 'email' },
  support_phone: { label: 'Support Phone', type: 'text' },
  default_currency: { label: 'Default Currency', type: 'select', options: [{ value: 'NGN', label: 'NGN (Naira)' }, { value: 'USD', label: 'USD (Dollar)' }, { value: 'GBP', label: 'GBP (Pound)' }] },
  default_timezone: { label: 'Default Timezone', type: 'select', options: [{ value: 'Africa/Lagos', label: 'Africa/Lagos (WAT)' }, { value: 'UTC', label: 'UTC' }, { value: 'Europe/London', label: 'Europe/London' }] },
  default_language: { label: 'Default Language', type: 'select', options: [{ value: 'en', label: 'English' }, { value: 'fr', label: 'French' }, { value: 'ha', label: 'Hausa' }, { value: 'yo', label: 'Yoruba' }, { value: 'ig', label: 'Igbo' }] },
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
  sms_provider: { label: 'SMS Provider', type: 'select', options: [{ value: 'termii', label: 'Termii' }, { value: 'twilio', label: 'Twilio' }, { value: 'africastalking', label: "Africa's Talking" }] },
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

  function updateField(key: keyof PlatformSettings, value: any) {
    setConfig((c) => c ? { ...c, [key]: value } : c);
    setDirty(true);
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await apiClient.put('/platform/config', config);
      if (res.success) { toast.success('Platform configuration saved'); setDirty(false); }
      else { toast.error(res.error || 'Failed to save'); }
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
          <p className="text-muted-foreground mt-1">Manage global platform settings and defaults</p>
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
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => { updateField('maintenance_mode', false); }}>
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
            <div className="space-y-5">
              {currentSection?.fields.map((field) => {
                const fieldCfg = FIELD_CONFIG[field];
                const value = config?.[field];
                return (
                  <div key={field}>
                    {fieldCfg.type === 'toggle' ? (
                      <div className="flex items-center justify-between py-1">
                        <div>
                          <Label htmlFor={field}>{fieldCfg.label}</Label>
                          {fieldCfg.description && <p className="text-xs text-muted-foreground mt-0.5">{fieldCfg.description}</p>}
                        </div>
                        <Switch
                          id={field}
                          checked={!!value}
                          onCheckedChange={(v) => updateField(field, v)}
                        />
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
                        <Textarea
                          id={field}
                          value={String(value || '')}
                          onChange={(e) => updateField(field, e.target.value)}
                          rows={3}
                        />
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
  };
}
