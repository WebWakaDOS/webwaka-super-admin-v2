import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import { useTenant } from '@/contexts/TenantContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  Flag,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Zap,
  Users,
  HardDrive,
  Activity,
  BarChart3,
  Brain,
  Globe,
  Wifi,
  Info,
} from 'lucide-react'

type Tier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'

interface FeatureFlags {
  advanced_analytics: boolean
  ai_recommendations: boolean
  multi_currency: boolean
  offline_mode: boolean
}

interface Quotas {
  api_requests_per_day: number
  max_users: number
  max_storage_mb: number
  ai_tokens_per_month: number
}

interface TenantFeatureConfig {
  tenant_id: string
  tier: Tier
  flags: FeatureFlags
  quotas: Quotas
  updated_at?: string
  updated_by?: string
  is_default: boolean
}

const TIER_BADGE_COLORS: Record<Tier, string> = {
  STARTER: 'bg-slate-100 text-slate-700 border-slate-200',
  PROFESSIONAL: 'bg-blue-100 text-blue-700 border-blue-200',
  ENTERPRISE: 'bg-purple-100 text-purple-700 border-purple-200',
}

const TIER_DEFAULTS: Record<Tier, { flags: FeatureFlags; quotas: Quotas }> = {
  STARTER: {
    flags: { advanced_analytics: false, ai_recommendations: false, multi_currency: false, offline_mode: true },
    quotas: { api_requests_per_day: 1000, max_users: 10, max_storage_mb: 5120, ai_tokens_per_month: 0 },
  },
  PROFESSIONAL: {
    flags: { advanced_analytics: true, ai_recommendations: true, multi_currency: false, offline_mode: true },
    quotas: { api_requests_per_day: 10000, max_users: 100, max_storage_mb: 51200, ai_tokens_per_month: 500000 },
  },
  ENTERPRISE: {
    flags: { advanced_analytics: true, ai_recommendations: true, multi_currency: true, offline_mode: true },
    quotas: { api_requests_per_day: 100000, max_users: -1, max_storage_mb: -1, ai_tokens_per_month: 1000000 },
  },
}

const FLAG_META: { key: keyof FeatureFlags; id: string; label: string; description: string; tiers: Tier[]; icon: React.ReactNode }[] = [
  {
    key: 'advanced_analytics',
    id: 'ff-001',
    label: 'Advanced Analytics Dashboard',
    description: 'Real-time metrics, custom reports, predictive analytics, and data exports (CSV / PDF / Excel).',
    tiers: ['PROFESSIONAL', 'ENTERPRISE'],
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    key: 'ai_recommendations',
    id: 'ff-002',
    label: 'AI-Powered Recommendations',
    description: 'ML-based product, route, course, and property recommendations with A/B testing framework.',
    tiers: ['PROFESSIONAL', 'ENTERPRISE'],
    icon: <Brain className="h-4 w-4" />,
  },
  {
    key: 'multi_currency',
    id: 'ff-003',
    label: 'Multi-Currency Support',
    description: 'Accept NGN, USD, GHS, KES, and other African currencies with automatic exchange-rate conversion.',
    tiers: ['ENTERPRISE'],
    icon: <Globe className="h-4 w-4" />,
  },
  {
    key: 'offline_mode',
    id: 'ff-004',
    label: 'Offline-First Mode',
    description: 'Progressive offline data caching and sync — operations queue while offline, auto-syncs on reconnect.',
    tiers: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
    icon: <Wifi className="h-4 w-4" />,
  },
]

const QUOTA_META: { key: keyof Quotas; label: string; description: string; icon: React.ReactNode; unit: string; unlimitedValue?: number }[] = [
  {
    key: 'api_requests_per_day',
    label: 'API Requests / Day',
    description: 'Maximum API calls the tenant may make per calendar day.',
    icon: <Activity className="h-4 w-4" />,
    unit: 'requests',
  },
  {
    key: 'max_users',
    label: 'Max Users',
    description: 'Maximum number of active user seats. Set to -1 for unlimited.',
    icon: <Users className="h-4 w-4" />,
    unit: 'seats',
    unlimitedValue: -1,
  },
  {
    key: 'max_storage_mb',
    label: 'Max Storage',
    description: 'Storage cap in MiB. Set to -1 for unlimited.',
    icon: <HardDrive className="h-4 w-4" />,
    unit: 'MiB',
    unlimitedValue: -1,
  },
  {
    key: 'ai_tokens_per_month',
    label: 'AI Tokens / Month',
    description: 'Monthly AI token budget across all LLM calls. Set to 0 to disable AI features.',
    icon: <Zap className="h-4 w-4" />,
    unit: 'tokens',
  },
]

export default function FeatureFlagManager() {
  const { tenants } = useTenant()
  const [selectedTenantId, setSelectedTenantId] = useState<string>('')
  const [config, setConfig] = useState<TenantFeatureConfig | null>(null)
  const [draft, setDraft] = useState<{ tier: Tier; flags: FeatureFlags; quotas: Quotas } | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [dirty, setDirty] = useState(false)

  const loadFlags = useCallback(async (tenantId: string) => {
    if (!tenantId) return
    setLoading(true)
    setDirty(false)
    try {
      const res = await apiClient.getFeatureFlags(tenantId)
      if (res.success && res.data) {
        setConfig(res.data)
        setDraft({ tier: res.data.tier, flags: { ...res.data.flags }, quotas: { ...res.data.quotas } })
      } else {
        toast.error(res.error || 'Failed to load feature flags')
      }
    } catch {
      toast.error('Could not reach the API. Is the Workers backend running?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedTenantId) loadFlags(selectedTenantId)
  }, [selectedTenantId, loadFlags])

  const handleTierChange = (tier: Tier) => {
    if (!draft) return
    const defaults = TIER_DEFAULTS[tier]
    setDraft({ tier, flags: { ...defaults.flags }, quotas: { ...defaults.quotas } })
    setDirty(true)
  }

  const handleFlagToggle = (key: keyof FeatureFlags, value: boolean) => {
    if (!draft) return
    setDraft((d) => d ? { ...d, flags: { ...d.flags, [key]: value } } : d)
    setDirty(true)
  }

  const handleQuotaChange = (key: keyof Quotas, raw: string) => {
    if (!draft) return
    const val = raw === '' ? 0 : parseInt(raw, 10)
    if (isNaN(val)) return
    setDraft((d) => d ? { ...d, quotas: { ...d.quotas, [key]: val } } : d)
    setDirty(true)
  }

  const handleSave = async () => {
    if (!draft || !selectedTenantId) return
    setSaving(true)
    try {
      const res = await apiClient.setFeatureFlags(selectedTenantId, draft)
      if (res.success) {
        toast.success('Feature flags saved to KV')
        await loadFlags(selectedTenantId)
      } else {
        toast.error(res.error || 'Save failed')
      }
    } catch {
      toast.error('Save failed — check API connectivity')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!selectedTenantId) return
    setSaving(true)
    try {
      const res = await apiClient.resetFeatureFlags(selectedTenantId)
      if (res.success) {
        toast.success('Reset to tier defaults')
        await loadFlags(selectedTenantId)
      } else {
        toast.error(res.error || 'Reset failed')
      }
    } catch {
      toast.error('Reset failed — check API connectivity')
    } finally {
      setSaving(false)
    }
  }

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Flag className="h-6 w-6 text-primary" />
            Feature Flag Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage subscription tiers, feature toggles, and API quotas per tenant. Writes to{' '}
            <code className="bg-muted px-1 rounded text-xs">FEATURE_FLAGS_KV</code>.
          </p>
        </div>
        {dirty && (
          <Badge variant="outline" className="border-amber-400 text-amber-600 bg-amber-50">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Unsaved changes
          </Badge>
        )}
      </div>

      {/* Tenant Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Tenant</CardTitle>
          <CardDescription>Choose a tenant to view and edit its feature configuration.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Select a tenant…" />
            </SelectTrigger>
            <SelectContent>
              {tenants.length === 0 ? (
                <SelectItem value="__none" disabled>No tenants available</SelectItem>
              ) : (
                tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Config Panel */}
      {selectedTenantId && (
        <>
          {loading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Loading feature flags…
              </CardContent>
            </Card>
          ) : draft ? (
            <>
              {/* Status bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium">{selectedTenant?.name ?? selectedTenantId}</span>
                {config?.is_default ? (
                  <Badge variant="outline" className="text-muted-foreground">Using tier defaults</Badge>
                ) : (
                  <Badge variant="outline" className="border-green-400 text-green-600 bg-green-50">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Custom config saved
                  </Badge>
                )}
                {config?.updated_at && (
                  <span className="text-xs text-muted-foreground">
                    Last updated {new Date(config.updated_at).toLocaleString()} by {config.updated_by}
                  </span>
                )}
              </div>

              {/* Tier Selector */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Subscription Tier</CardTitle>
                  <CardDescription>
                    Changing the tier loads the canonical defaults for that tier. You can then fine-tune individual flags below.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    {(['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as Tier[]).map((tier) => (
                      <button
                        key={tier}
                        onClick={() => handleTierChange(tier)}
                        className={`flex-1 rounded-lg border-2 p-3 text-center transition-all cursor-pointer ${
                          draft.tier === tier
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/40'
                        }`}
                      >
                        <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium border mb-1 ${TIER_BADGE_COLORS[tier]}`}>
                          {tier}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tier === 'STARTER' && 'Up to 10 users'}
                          {tier === 'PROFESSIONAL' && 'Up to 100 users'}
                          {tier === 'ENTERPRISE' && 'Unlimited users'}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Feature Flags */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Feature Flags</CardTitle>
                  <CardDescription>
                    Toggle individual features per tenant. Downstream vertical workers read these from{' '}
                    <code className="bg-muted px-1 rounded text-xs">FEATURE_FLAGS_KV</code> on every request.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {FLAG_META.map((flag, i) => (
                    <div key={flag.key}>
                      {i > 0 && <Separator className="mb-4" />}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-0.5 p-1.5 rounded-md bg-muted text-muted-foreground">
                            {flag.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`flag-${flag.key}`} className="font-medium cursor-pointer">
                                {flag.label}
                              </Label>
                              <code className="text-xs text-muted-foreground bg-muted px-1 rounded">{flag.id}</code>
                              <span className="text-xs text-muted-foreground">
                                {flag.tiers.join(' · ')}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
                          </div>
                        </div>
                        <Switch
                          id={`flag-${flag.key}`}
                          checked={draft.flags[flag.key]}
                          onCheckedChange={(v) => handleFlagToggle(flag.key, v)}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Quotas */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">API Quotas</CardTitle>
                  <CardDescription>
                    Set resource limits. Use <strong>-1</strong> for unlimited (user seats, storage) or <strong>0</strong> to disable (AI tokens).
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {QUOTA_META.map((q) => (
                    <div key={q.key} className="space-y-1.5">
                      <Label htmlFor={`quota-${q.key}`} className="flex items-center gap-1.5 font-medium">
                        <span className="text-muted-foreground">{q.icon}</span>
                        {q.label}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`quota-${q.key}`}
                          type="number"
                          value={draft.quotas[q.key]}
                          onChange={(e) => handleQuotaChange(q.key, e.target.value)}
                          className="w-full"
                          min={q.unlimitedValue ?? 0}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{q.unit}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{q.description}</p>
                      {q.unlimitedValue !== undefined && draft.quotas[q.key] === q.unlimitedValue && (
                        <p className="text-xs text-green-600 font-medium">∞ Unlimited</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Action bar */}
              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving || !dirty} className="min-w-[120px]">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving…' : 'Save to KV'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={saving || config?.is_default}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </Button>
                {config?.is_default && (
                  <span className="text-xs text-muted-foreground">Already using tier defaults.</span>
                )}
              </div>
            </>
          ) : null}
        </>
      )}

      {/* KV Schema Documentation */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none pb-3"
          onClick={() => setSchemaOpen((o) => !o)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">KV Schema — Downstream Integration Guide</CardTitle>
            </div>
            {schemaOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
          <CardDescription>How vertical workers should consume feature flags from KV.</CardDescription>
        </CardHeader>
        {schemaOpen && (
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">KV Key Format</p>
              <code className="block bg-muted rounded p-3 text-xs">ff:{'{tenantId}'}</code>
              <p className="text-xs text-muted-foreground mt-1">
                One key per tenant. All flags and quotas for that tenant are stored in a single JSON value.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Reading from a Vertical Worker</p>
              <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{`// workers/src/index.ts (any vertical suite)
const config = await env.FEATURE_FLAGS_KV.get(\`ff:\${tenantId}\`, 'json')

if (config?.flags?.advanced_analytics) {
  // render advanced dashboard
}
if ((config?.quotas?.ai_tokens_per_month ?? 0) > 0) {
  // allow AI features
}`}</pre>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">JSON Schema</p>
              <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{`{
  "tenant_id": "string",          // tenant identifier
  "tier": "STARTER | PROFESSIONAL | ENTERPRISE",
  "flags": {
    "advanced_analytics": boolean,  // ff-001
    "ai_recommendations": boolean,  // ff-002
    "multi_currency":     boolean,  // ff-003
    "offline_mode":       boolean   // ff-004
  },
  "quotas": {
    "api_requests_per_day":  number,  // -1 = unlimited
    "max_users":             number,  // -1 = unlimited
    "max_storage_mb":        number,  // -1 = unlimited
    "ai_tokens_per_month":   number   //  0 = AI disabled
  },
  "updated_at": "ISO 8601",     // last write timestamp
  "updated_by": "string"        // admin email
}`}</pre>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-700">
                <strong>Fallback contract:</strong> If no KV record exists for a tenant, vertical workers must fall back to
                the tier-based defaults (STARTER = most restrictive). Never gate features on the absence of a KV key.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
