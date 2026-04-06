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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
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
  FlaskConical,
  Plus,
  Trash2,
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

// ── A/B Testing Types ─────────────────────────────────────────────────────────
type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed'

interface Variant {
  id: string
  name: string
  description: string
  rollout: number  // 0-100 percentage
  config: Record<string, string | number | boolean>
}

interface ABExperiment {
  id: string
  name: string
  description: string
  status: ExperimentStatus
  feature: string
  tenantId?: string  // null = global
  startedAt?: string
  endedAt?: string
  variants: Variant[]
  winnerVariantId?: string
}

// ── Constants ──────────────────────────────────────────────────────────────────
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

// ── Demo experiments ──────────────────────────────────────────────────────────
const DEMO_EXPERIMENTS: ABExperiment[] = [
  {
    id: 'exp-001',
    name: 'Dashboard Layout Rollout',
    description: 'Testing new grid-based dashboard layout vs current list layout for engagement',
    status: 'running',
    feature: 'advanced_analytics',
    startedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    variants: [
      { id: 'v-control', name: 'Control (List)', description: 'Current list-based dashboard', rollout: 50, config: { layout: 'list' } },
      { id: 'v-grid', name: 'Treatment (Grid)', description: 'New grid dashboard layout', rollout: 50, config: { layout: 'grid' } },
    ],
  },
  {
    id: 'exp-002',
    name: 'AI Recommendations UX',
    description: 'Comparing inline vs sidebar placement for AI recommendation widget',
    status: 'running',
    feature: 'ai_recommendations',
    startedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    variants: [
      { id: 'v-inline', name: 'Inline', description: 'Recommendations inline in content', rollout: 33, config: { placement: 'inline' } },
      { id: 'v-sidebar', name: 'Sidebar', description: 'Recommendations in right sidebar', rollout: 33, config: { placement: 'sidebar' } },
      { id: 'v-modal', name: 'Modal', description: 'Recommendations as modal overlay', rollout: 34, config: { placement: 'modal' } },
    ],
  },
  {
    id: 'exp-003',
    name: 'Offline Sync Frequency',
    description: 'Comparing 30s vs 60s vs 2m sync intervals on battery usage',
    status: 'completed',
    feature: 'offline_mode',
    startedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    endedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    winnerVariantId: 'v-60s',
    variants: [
      { id: 'v-30s', name: '30s Interval', description: 'Sync every 30 seconds', rollout: 33, config: { syncInterval: 30 } },
      { id: 'v-60s', name: '60s Interval', description: 'Sync every 60 seconds', rollout: 34, config: { syncInterval: 60 } },
      { id: 'v-120s', name: '2m Interval', description: 'Sync every 120 seconds', rollout: 33, config: { syncInterval: 120 } },
    ],
  },
]

const STATUS_COLORS: Record<ExperimentStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  running: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
}

function totalRollout(variants: Variant[]) {
  return variants.reduce((s, v) => s + v.rollout, 0)
}

export default function FeatureFlagManager() {
  const { tenants } = useTenant()
  const [selectedTenantId, setSelectedTenantId] = useState<string>('')
  const [config, setConfig] = useState<TenantFeatureConfig | null>(null)
  const [draft, setDraft] = useState<{ tier: Tier; flags: FeatureFlags; quotas: Quotas } | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const latestTenantRef = useState<{ id: string }>({ id: '' })[0]

  // A/B Testing state
  const [experiments, setExperiments] = useState<ABExperiment[]>(DEMO_EXPERIMENTS)
  const [showNewExperiment, setShowNewExperiment] = useState(false)
  const [newExp, setNewExp] = useState<Partial<ABExperiment>>({
    name: '', description: '', feature: 'advanced_analytics', status: 'draft',
    variants: [
      { id: `v-${Date.now()}-a`, name: 'Control', description: 'Current behavior', rollout: 50, config: {} },
      { id: `v-${Date.now()}-b`, name: 'Treatment', description: 'New behavior', rollout: 50, config: {} },
    ],
  })

  const loadFlags = useCallback(async (tenantId: string) => {
    if (!tenantId) return
    latestTenantRef.id = tenantId
    setLoading(true)
    setDirty(false)
    try {
      const res = await apiClient.getFeatureFlags(tenantId)
      if (latestTenantRef.id !== tenantId) return
      if (res.success && res.data) {
        setConfig(res.data)
        setDraft({ tier: res.data.tier, flags: { ...res.data.flags }, quotas: { ...res.data.quotas } })
      } else {
        toast.error(res.error || 'Failed to load feature flags')
      }
    } catch {
      if (latestTenantRef.id !== tenantId) return
      toast.error('Could not reach the API. Is the Workers backend running?')
    } finally {
      if (latestTenantRef.id === tenantId) setLoading(false)
    }
  }, [latestTenantRef])

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
    const quotaErrors: string[] = []
    if (draft.quotas.api_requests_per_day < 0) quotaErrors.push('API Requests / Day must be ≥ 0')
    if (draft.quotas.max_users < -1) quotaErrors.push('Max Users must be ≥ -1')
    if (draft.quotas.max_storage_mb < -1) quotaErrors.push('Max Storage must be ≥ -1')
    if (draft.quotas.ai_tokens_per_month < 0) quotaErrors.push('AI Tokens / Month must be ≥ 0')
    if (quotaErrors.length > 0) { quotaErrors.forEach((e) => toast.error(e)); return }
    setSaving(true)
    try {
      const res = await apiClient.setFeatureFlags(selectedTenantId, draft)
      if (res.success) {
        toast.success('Feature flags saved to KV')
        await loadFlags(selectedTenantId)
      } else { toast.error(res.error || 'Save failed') }
    } catch { toast.error('Save failed — check API connectivity') }
    finally { setSaving(false) }
  }

  const handleResetRequest = () => setConfirmReset(true)
  const handleResetConfirm = async () => {
    setConfirmReset(false)
    if (!selectedTenantId) return
    setSaving(true)
    try {
      const res = await apiClient.resetFeatureFlags(selectedTenantId)
      if (res.success) { toast.success('Feature flags reset to tier defaults'); await loadFlags(selectedTenantId) }
      else toast.error(res.error || 'Reset failed')
    } catch { toast.error('Reset failed — check API connectivity') }
    finally { setSaving(false) }
  }

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId)

  // A/B Experiment actions
  function updateExperimentStatus(id: string, status: ExperimentStatus) {
    setExperiments((prev) => prev.map((e) => e.id === id ? {
      ...e,
      status,
      startedAt: status === 'running' && !e.startedAt ? new Date().toISOString() : e.startedAt,
      endedAt: status === 'completed' ? new Date().toISOString() : e.endedAt,
    } : e))
    toast.success(`Experiment ${status === 'running' ? 'started' : status}`)
    apiClient.logAuditEvent('UPDATE_EXPERIMENT', 'ab_test', id)
  }

  function declareWinner(experimentId: string, variantId: string) {
    setExperiments((prev) => prev.map((e) => e.id === experimentId
      ? { ...e, status: 'completed', winnerVariantId: variantId, endedAt: new Date().toISOString() }
      : e))
    toast.success('Winner declared — experiment completed')
  }

  function updateVariantRollout(expId: string, variantId: string, rollout: number) {
    setExperiments((prev) => prev.map((e) => e.id === expId ? {
      ...e,
      variants: e.variants.map((v) => v.id === variantId ? { ...v, rollout } : v),
    } : e))
  }

  function createExperiment() {
    if (!newExp.name?.trim()) { toast.error('Experiment name is required'); return }
    const rolloutTotal = totalRollout(newExp.variants || [])
    if (rolloutTotal !== 100) { toast.error(`Variant rollouts must sum to 100% (currently ${rolloutTotal}%)`); return }
    const exp: ABExperiment = {
      id: `exp-${Date.now()}`,
      name: newExp.name!,
      description: newExp.description || '',
      status: 'draft',
      feature: newExp.feature || 'advanced_analytics',
      variants: newExp.variants || [],
    }
    setExperiments((prev) => [exp, ...prev])
    setShowNewExperiment(false)
    setNewExp({
      name: '', description: '', feature: 'advanced_analytics', status: 'draft',
      variants: [
        { id: `v-${Date.now()}-a`, name: 'Control', description: '', rollout: 50, config: {} },
        { id: `v-${Date.now()}-b`, name: 'Treatment', description: '', rollout: 50, config: {} },
      ],
    })
    toast.success('Experiment created in draft state')
  }

  function addVariantToNew() {
    setNewExp((e) => ({
      ...e,
      variants: [...(e.variants || []), { id: `v-${Date.now()}`, name: `Variant ${(e.variants?.length || 0) + 1}`, description: '', rollout: 0, config: {} }],
    }))
  }

  function updateNewVariant(id: string, field: 'name' | 'description' | 'rollout', value: string | number) {
    setNewExp((e) => ({
      ...e,
      variants: (e.variants || []).map((v) => v.id === id ? { ...v, [field]: value } : v),
    }))
  }

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
            Manage subscription tiers, feature toggles, API quotas, and A/B experiments per tenant.
          </p>
        </div>
        {dirty && (
          <Badge variant="outline" className="border-amber-400 text-amber-600 bg-amber-50">
            <AlertTriangle className="h-3 w-3 mr-1" />Unsaved changes
          </Badge>
        )}
      </div>

      <Tabs defaultValue="flags">
        <TabsList>
          <TabsTrigger value="flags">
            <Flag className="h-3.5 w-3.5 mr-1.5" />Feature Flags
          </TabsTrigger>
          <TabsTrigger value="abtests">
            <FlaskConical className="h-3.5 w-3.5 mr-1.5" />A/B Experiments
          </TabsTrigger>
        </TabsList>

        {/* ── Feature Flags Tab ─────────────────────────────────────────────── */}
        <TabsContent value="flags" className="space-y-6 mt-4">
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
                    tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Config Panel */}
          {selectedTenantId && (
            <>
              {loading ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">Loading feature flags…</CardContent></Card>
              ) : draft ? (
                <>
                  {/* Status bar */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-medium">{selectedTenant?.name ?? selectedTenantId}</span>
                    {config?.is_default ? (
                      <Badge variant="outline" className="text-muted-foreground">Using tier defaults</Badge>
                    ) : (
                      <Badge variant="outline" className="border-green-400 text-green-600 bg-green-50">
                        <CheckCircle className="h-3 w-3 mr-1" />Custom config saved
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
                      <CardDescription>Changing the tier loads canonical defaults. Fine-tune individual flags below.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-3">
                        {(['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as Tier[]).map((tier) => (
                          <button key={tier} onClick={() => handleTierChange(tier)}
                            className={`flex-1 rounded-lg border-2 p-3 text-center transition-all cursor-pointer ${draft.tier === tier ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}`}>
                            <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium border mb-1 ${TIER_BADGE_COLORS[tier]}`}>{tier}</div>
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
                        Toggle individual features per tenant. Workers read these from{' '}
                        <code className="bg-muted px-1 rounded text-xs">FEATURE_FLAGS_KV</code> on every request.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {FLAG_META.map((flag, i) => (
                        <div key={flag.key}>
                          {i > 0 && <Separator className="mb-4" />}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="mt-0.5 p-1.5 rounded-md bg-muted text-muted-foreground">{flag.icon}</div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Label htmlFor={`flag-${flag.key}`} className="font-medium cursor-pointer">{flag.label}</Label>
                                  <code className="text-xs text-muted-foreground bg-muted px-1 rounded">{flag.id}</code>
                                  <span className="text-xs text-muted-foreground">{flag.tiers.join(' · ')}</span>
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
                        Set resource limits. Use <strong>-1</strong> for unlimited or <strong>0</strong> to disable AI.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {QUOTA_META.map((q) => (
                        <div key={q.key} className="space-y-1.5">
                          <Label htmlFor={`quota-${q.key}`} className="flex items-center gap-1.5 font-medium">
                            <span className="text-muted-foreground">{q.icon}</span>{q.label}
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
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button onClick={handleSave} disabled={saving || !dirty} className="min-w-[120px]">
                      <Save className="h-4 w-4 mr-2" />{saving ? 'Saving…' : 'Save to KV'}
                    </Button>
                    {confirmReset ? (
                      <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-sm text-destructive font-medium">Delete custom config?</span>
                        <Button size="sm" variant="destructive" onClick={handleResetConfirm} disabled={saving}>Confirm Reset</Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmReset(false)} disabled={saving}>Cancel</Button>
                      </div>
                    ) : (
                      <Button variant="outline" onClick={handleResetRequest} disabled={saving || config?.is_default}>
                        <RotateCcw className="h-4 w-4 mr-2" />Reset to Defaults
                      </Button>
                    )}
                    {config?.is_default && !confirmReset && (
                      <span className="text-xs text-muted-foreground">Already using tier defaults.</span>
                    )}
                  </div>
                </>
              ) : null}
            </>
          )}

          {/* KV Schema Documentation */}
          <Card>
            <CardHeader className="cursor-pointer select-none pb-3" onClick={() => setSchemaOpen((o) => !o)}>
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
                  <code className="block bg-muted rounded p-3 text-xs">tenant:{'{tenantId}'}:flags</code>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Reading from a Vertical Worker</p>
                  <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{`const config = await env.FEATURE_FLAGS_KV.get(\`tenant:\${tenantId}:flags\`, 'json')
if (config?.flags?.advanced_analytics) { /* render advanced dashboard */ }
if ((config?.quotas?.ai_tokens_per_month ?? 0) > 0) { /* allow AI features */ }`}</pre>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* ── A/B Experiments Tab ───────────────────────────────────────────── */}
        <TabsContent value="abtests" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Run controlled A/B experiments on feature flags. Define variants with rollout percentages to test new configurations safely.
              </p>
            </div>
            <Button onClick={() => setShowNewExperiment(!showNewExperiment)}>
              <Plus className="h-4 w-4 mr-2" />New Experiment
            </Button>
          </div>

          {/* New Experiment Form */}
          {showNewExperiment && (
            <Card className="border-primary/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />Create New Experiment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Experiment Name *</Label>
                    <Input placeholder="e.g. Dashboard Layout v2" value={newExp.name || ''} onChange={(e) => setNewExp((x) => ({ ...x, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Related Feature</Label>
                    <Select value={newExp.feature} onValueChange={(v) => setNewExp((x) => ({ ...x, feature: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FLAG_META.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Description</Label>
                    <Input placeholder="What are you testing and why?" value={newExp.description || ''} onChange={(e) => setNewExp((x) => ({ ...x, description: e.target.value }))} />
                  </div>
                </div>

                {/* Variants */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Variants</Label>
                    <Button variant="outline" size="sm" onClick={addVariantToNew}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Add Variant
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {(newExp.variants || []).map((v, i) => (
                      <div key={v.id} className="flex items-center gap-3 border rounded-lg p-3">
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <Input placeholder={`Variant ${i + 1} name`} value={v.name} onChange={(e) => updateNewVariant(v.id, 'name', e.target.value)} />
                          <Input placeholder="Description" value={v.description} onChange={(e) => updateNewVariant(v.id, 'description', e.target.value)} />
                          <div className="flex items-center gap-2">
                            <Input type="number" min={0} max={100} value={v.rollout} onChange={(e) => updateNewVariant(v.id, 'rollout', parseInt(e.target.value) || 0)} className="w-20" />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setNewExp((x) => ({ ...x, variants: (x.variants || []).filter((xv) => xv.id !== v.id) }))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className={`text-xs font-medium ${totalRollout(newExp.variants || []) === 100 ? 'text-green-600' : 'text-red-600'}`}>
                    Total rollout: {totalRollout(newExp.variants || [])}% (must equal 100%)
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={createExperiment}>Create Experiment</Button>
                  <Button variant="outline" onClick={() => setShowNewExperiment(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Experiment List */}
          {experiments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FlaskConical className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground">No experiments yet. Create your first A/B experiment.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {experiments.map((exp) => (
                <Card key={exp.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">{exp.name}</CardTitle>
                          <Badge className={`text-xs ${STATUS_COLORS[exp.status]}`}>{exp.status}</Badge>
                          {exp.winnerVariantId && <Badge className="text-xs bg-yellow-100 text-yellow-800">🏆 Winner declared</Badge>}
                        </div>
                        <CardDescription className="mt-0.5">{exp.description}</CardDescription>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Feature: <code className="bg-muted px-1 rounded">{exp.feature}</code></span>
                          {exp.startedAt && <span>Started {new Date(exp.startedAt).toLocaleDateString()}</span>}
                          {exp.endedAt && <span>Ended {new Date(exp.endedAt).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {exp.status === 'draft' && (
                          <Button size="sm" onClick={() => updateExperimentStatus(exp.id, 'running')}>Start</Button>
                        )}
                        {exp.status === 'running' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => updateExperimentStatus(exp.id, 'paused')}>Pause</Button>
                            <Button size="sm" variant="outline" onClick={() => updateExperimentStatus(exp.id, 'completed')}>End</Button>
                          </>
                        )}
                        {exp.status === 'paused' && (
                          <>
                            <Button size="sm" onClick={() => updateExperimentStatus(exp.id, 'running')}>Resume</Button>
                            <Button size="sm" variant="outline" onClick={() => updateExperimentStatus(exp.id, 'completed')}>End</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {exp.variants.map((variant) => {
                        const isWinner = exp.winnerVariantId === variant.id
                        return (
                          <div key={variant.id} className={`border rounded-lg p-3 ${isWinner ? 'border-yellow-300 bg-yellow-50' : ''}`}>
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{variant.name}</span>
                                {isWinner && <span className="text-xs text-yellow-700 font-semibold">🏆 Winner</span>}
                                {variant.description && <span className="text-xs text-muted-foreground">— {variant.description}</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {exp.status === 'running' && (
                                  <div className="flex items-center gap-1.5">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={variant.rollout}
                                      onChange={(e) => updateVariantRollout(exp.id, variant.id, parseInt(e.target.value) || 0)}
                                      className="w-16 h-7 text-xs text-center"
                                    />
                                    <span className="text-xs text-muted-foreground">%</span>
                                  </div>
                                )}
                                {exp.status !== 'completed' && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => declareWinner(exp.id, variant.id)}>
                                    Declare Winner
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Rollout</span>
                                <span className="font-medium">{variant.rollout}%</span>
                              </div>
                              <Progress value={variant.rollout} className="h-1.5" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Total rollout warning */}
                    {exp.status === 'running' && (() => {
                      const total = totalRollout(exp.variants)
                      return total !== 100 ? (
                        <div className="flex items-center gap-2 mt-3 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Variant rollouts sum to {total}% — adjust to reach 100%
                        </div>
                      ) : null
                    })()}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
