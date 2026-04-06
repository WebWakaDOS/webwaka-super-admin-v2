import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, Package, Power, PowerOff, History, GitBranch, Search, ArrowUpRight, Info } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { deleteCacheData } from '@/lib/db'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Dependency {
  moduleId: string
  minVersion: string
  required: boolean
}

interface VersionHistory {
  version: string
  releasedAt: string
  changelog: string
  breaking: boolean
}

interface Module {
  id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'beta' | 'deprecated'
  category: string
  version: string
  latestVersion?: string
  enabledTenants: number
  featureFlagKey: string
  createdAt: string
  dependencies?: Dependency[]
  versionHistory?: VersionHistory[]
  maintainer?: string
  repository?: string
}

// ── Demo fallback data ────────────────────────────────────────────────────────
const DEMO_MODULES: Module[] = [
  {
    id: 'auth', name: 'Authentication', description: 'Multi-factor auth, JWT, HttpOnly cookies, RBAC integration',
    status: 'active', category: 'Core', version: '2.4.1', latestVersion: '2.4.1',
    enabledTenants: 127, featureFlagKey: 'module_auth', createdAt: '2024-01-15',
    maintainer: 'WebWaka Core Team', repository: 'webwaka-core',
    dependencies: [],
    versionHistory: [
      { version: '2.4.1', releasedAt: '2026-03-29', changelog: 'PBKDF2 password hashing, hardened CORS', breaking: false },
      { version: '2.4.0', releasedAt: '2026-02-14', changelog: 'Added TOTP-based 2FA support', breaking: false },
      { version: '2.3.0', releasedAt: '2025-11-01', changelog: 'HttpOnly cookie migration for JWT storage', breaking: true },
    ],
  },
  {
    id: 'billing', name: 'Billing & Commissions', description: 'Nigeria-first billing in Kobo, 5-level affiliate commission engine',
    status: 'active', category: 'Core', version: '3.1.0', latestVersion: '3.2.0',
    enabledTenants: 127, featureFlagKey: 'module_billing', createdAt: '2024-01-15',
    maintainer: 'WebWaka Fintech Team',
    dependencies: [{ moduleId: 'auth', minVersion: '2.0.0', required: true }],
    versionHistory: [
      { version: '3.2.0', releasedAt: '2026-04-01', changelog: 'MRR/ARR real-time metrics, auto-refresh', breaking: false },
      { version: '3.1.0', releasedAt: '2026-02-10', changelog: 'Added churn analytics, pending invoice tracking', breaking: false },
      { version: '3.0.0', releasedAt: '2025-10-05', changelog: 'Rewrote ledger for immutability guarantees', breaking: true },
    ],
  },
  {
    id: 'commerce', name: 'Commerce Suite', description: 'POS, multi-vendor marketplace, B2B commerce, retail inventory',
    status: 'active', category: 'Verticals', version: '1.8.3', latestVersion: '1.8.3',
    enabledTenants: 89, featureFlagKey: 'module_commerce', createdAt: '2024-03-01',
    maintainer: 'WebWaka Commerce Team',
    dependencies: [
      { moduleId: 'auth', minVersion: '2.3.0', required: true },
      { moduleId: 'billing', minVersion: '3.0.0', required: true },
    ],
    versionHistory: [
      { version: '1.8.3', releasedAt: '2026-03-15', changelog: 'Fixed cart calculation rounding for Kobo', breaking: false },
      { version: '1.8.0', releasedAt: '2026-01-20', changelog: 'Multi-vendor marketplace support', breaking: false },
    ],
  },
  {
    id: 'ai-platform', name: 'AI Platform', description: 'Vendor-neutral AI routing via OpenRouter, BYOK, usage billing events',
    status: 'beta', category: 'AI', version: '0.9.2', latestVersion: '0.9.4',
    enabledTenants: 23, featureFlagKey: 'module_ai', createdAt: '2025-06-01',
    maintainer: 'WebWaka AI Team', repository: 'webwaka-ai-platform',
    dependencies: [{ moduleId: 'auth', minVersion: '2.4.0', required: true }],
    versionHistory: [
      { version: '0.9.4', releasedAt: '2026-04-02', changelog: 'Added Anthropic Claude via OpenRouter', breaking: false },
      { version: '0.9.2', releasedAt: '2026-03-10', changelog: 'BYOK (Bring Your Own Key) support', breaking: false },
      { version: '0.9.0', releasedAt: '2026-01-05', changelog: 'Initial OpenRouter integration', breaking: false },
    ],
  },
  {
    id: 'fintech', name: 'Fintech Suite', description: 'Banking, lending, wallets, USSD, agent banking, KYC/KYB',
    status: 'active', category: 'Verticals', version: '2.2.0', latestVersion: '2.2.0',
    enabledTenants: 45, featureFlagKey: 'module_fintech', createdAt: '2024-05-01',
    maintainer: 'WebWaka Fintech Team',
    dependencies: [
      { moduleId: 'auth', minVersion: '2.3.0', required: true },
      { moduleId: 'billing', minVersion: '3.0.0', required: true },
    ],
    versionHistory: [
      { version: '2.2.0', releasedAt: '2026-02-28', changelog: 'FHIR compliance, crypto wallet support', breaking: false },
    ],
  },
  {
    id: 'logistics', name: 'Logistics Suite', description: 'Parcels, delivery zones, 3PL webhooks (GIG, Kwik, Sendbox), fleet tracking',
    status: 'active', category: 'Verticals', version: '1.5.1', latestVersion: '1.6.0',
    enabledTenants: 31, featureFlagKey: 'module_logistics', createdAt: '2024-07-01',
    maintainer: 'WebWaka Logistics Team',
    dependencies: [{ moduleId: 'auth', minVersion: '2.0.0', required: true }],
    versionHistory: [
      { version: '1.6.0', releasedAt: '2026-04-01', changelog: 'Proof of Delivery (PoD) with photo upload', breaking: false },
      { version: '1.5.1', releasedAt: '2026-01-15', changelog: 'Fixed Sendbox webhook signature verification', breaking: false },
    ],
  },
  {
    id: 'offline-sync', name: 'Offline Sync Engine', description: 'IndexedDB mutation queue, background sync, conflict resolution',
    status: 'active', category: 'Core', version: '1.2.0', latestVersion: '1.2.0',
    enabledTenants: 127, featureFlagKey: 'module_offline', createdAt: '2024-02-01',
    maintainer: 'WebWaka Core Team',
    dependencies: [],
    versionHistory: [
      { version: '1.2.0', releasedAt: '2026-01-10', changelog: 'CRDT-based conflict resolution, retry backoff', breaking: false },
      { version: '1.1.0', releasedAt: '2025-09-01', changelog: 'Background sync via Service Worker', breaking: false },
    ],
  },
  {
    id: 'civic', name: 'Civic Suite', description: 'Government & NGO management, elections, fundraising, volunteers',
    status: 'inactive', category: 'Verticals', version: '0.8.0', latestVersion: '0.8.0',
    enabledTenants: 0, featureFlagKey: 'module_civic', createdAt: '2025-01-01',
    maintainer: 'WebWaka Civic Team',
    dependencies: [{ moduleId: 'auth', minVersion: '2.4.0', required: true }],
    versionHistory: [
      { version: '0.8.0', releasedAt: '2025-12-01', changelog: 'Cryptographic voting verification', breaking: false },
    ],
  },
]

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-700',
  beta: 'bg-yellow-100 text-yellow-800',
  deprecated: 'bg-red-100 text-red-800',
}

export default function ModuleRegistry() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingModuleId, setTogglingModuleId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailModule, setDetailModule] = useState<Module | null>(null)

  useEffect(() => {
    const fetchModules = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await apiClient.get('/modules')
        if (!response.success) throw new Error('Failed to fetch modules')
        const data = (response.data || []) as Module[]
        setModules(data.length > 0 ? data : DEMO_MODULES)
      } catch {
        setModules(DEMO_MODULES)
        setError('Backend offline — showing demo module registry')
      } finally {
        setLoading(false)
      }
    }
    fetchModules()
  }, [])

  const handleToggleModule = async (module: Module) => {
    if (module.status === 'deprecated') { toast.error('Cannot enable a deprecated module'); return }
    const newStatus = module.status === 'active' ? 'inactive' : 'active'

    // Dependency check: if disabling, warn about dependents
    if (newStatus === 'inactive') {
      const dependents = modules.filter((m) =>
        m.dependencies?.some((d) => d.moduleId === module.id && d.required) && m.status === 'active'
      )
      if (dependents.length > 0) {
        toast.error(`Cannot disable: ${dependents.map((d) => d.name).join(', ')} depend on this module`)
        return
      }
    }

    // If enabling, check all required dependencies are active
    if (newStatus === 'active' && module.dependencies) {
      const missing = module.dependencies
        .filter((d) => d.required && !modules.find((m) => m.id === d.moduleId && m.status === 'active'))
      if (missing.length > 0) {
        toast.error(`Missing required dependencies: ${missing.map((d) => d.moduleId).join(', ')}`)
        return
      }
    }

    try {
      setTogglingModuleId(module.id)
      await apiClient.put(`/modules/${module.id}`, { status: newStatus })
      await apiClient.post('/kv/feature-flags', { key: `module_${module.id}`, value: newStatus === 'active' ? 'true' : 'false', ttl: 3600 })
      setModules(modules.map((m) => m.id === module.id ? { ...m, status: newStatus } : m))
      deleteCacheData('modules:list').catch(() => {})
      apiClient.logAuditEvent(newStatus === 'active' ? 'ENABLE_MODULE' : 'DISABLE_MODULE', 'module', module.id)
      toast.success(`${module.name} ${newStatus === 'active' ? 'enabled' : 'disabled'}`)
    } catch {
      // Optimistic update when backend offline
      setModules(modules.map((m) => m.id === module.id ? { ...m, status: newStatus } : m))
      toast.success(`${module.name} ${newStatus === 'active' ? 'enabled' : 'disabled'}`)
    } finally {
      setTogglingModuleId(null)
    }
  }

  const categories = ['all', ...Array.from(new Set(modules.map((m) => m.category)))]
  const filteredModules = modules.filter((m) => {
    const matchSearch = !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCategory = categoryFilter === 'all' || m.category === categoryFilter
    const matchStatus = statusFilter === 'all' || m.status === statusFilter
    return matchSearch && matchCategory && matchStatus
  })

  const modulesByCategory = filteredModules.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = []
    acc[m.category].push(m)
    return acc
  }, {} as Record<string, Module[]>)

  const hasUpdate = (m: Module) => m.latestVersion && m.latestVersion !== m.version

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Module Registry</h1>
        <p className="text-muted-foreground mt-2">Manage platform modules with versioning and dependency tracking.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <Info className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : (
          <>
            {[
              { label: 'Total Modules', value: modules.length, sub: 'In registry' },
              { label: 'Active', value: modules.filter((m) => m.status === 'active').length, sub: 'Enabled globally' },
              { label: 'Beta', value: modules.filter((m) => m.status === 'beta').length, sub: 'In testing' },
              { label: 'Updates Available', value: modules.filter(hasUpdate).length, sub: 'New versions' },
            ].map(({ label, value, sub }) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{value}</div>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search modules…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => <SelectItem key={c} value={c} className="capitalize">{c === 'all' ? 'All Categories' : c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="beta">Beta</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="deprecated">Deprecated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Modules by Category */}
      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-72" /><Skeleton className="h-72" />
        </div>
      ) : Object.keys(modulesByCategory).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">No modules match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(modulesByCategory).map(([category, catModules]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />{category}
              </CardTitle>
              <CardDescription>{catModules.length} module{catModules.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {catModules.map((module) => (
                  <div key={module.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{module.name}</p>
                        <Badge className={`text-xs ${STATUS_COLORS[module.status]}`}>{module.status}</Badge>
                        {hasUpdate(module) && (
                          <Badge className="bg-blue-100 text-blue-800 text-xs gap-1">
                            <ArrowUpRight className="h-3 w-3" />v{module.latestVersion} available
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">{module.description}</p>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />v{module.version}
                        </span>
                        <span>{module.enabledTenants} tenants</span>
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{module.featureFlagKey}</span>
                        {module.dependencies && module.dependencies.length > 0 && (
                          <span className="text-yellow-600">
                            {module.dependencies.length} dep{module.dependencies.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => setDetailModule(module)}
                      >
                        <History className="h-4 w-4 mr-1" />Details
                      </Button>
                      <Button
                        variant={module.status === 'active' ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 w-24"
                        onClick={() => handleToggleModule(module)}
                        disabled={togglingModuleId === module.id || module.status === 'deprecated'}
                      >
                        {togglingModuleId === module.id ? (
                          <span className="animate-pulse">…</span>
                        ) : module.status === 'active' ? (
                          <><PowerOff className="h-3.5 w-3.5 mr-1.5" />Disable</>
                        ) : (
                          <><Power className="h-3.5 w-3.5 mr-1.5" />Enable</>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* ── Module Detail Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!detailModule} onOpenChange={(o) => !o && setDetailModule(null)}>
        {detailModule && (
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />{detailModule.name}
              </DialogTitle>
              <DialogDescription>{detailModule.description}</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="info">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1">Info</TabsTrigger>
                <TabsTrigger value="versions" className="flex-1">Version History</TabsTrigger>
                <TabsTrigger value="deps" className="flex-1">Dependencies</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Current Version</div>
                  <div className="font-mono font-semibold">v{detailModule.version}</div>
                  {detailModule.latestVersion && detailModule.latestVersion !== detailModule.version && (
                    <>
                      <div className="text-muted-foreground">Latest Available</div>
                      <div className="font-mono text-blue-600 font-semibold">v{detailModule.latestVersion} ↑</div>
                    </>
                  )}
                  <div className="text-muted-foreground">Status</div>
                  <div><Badge className={STATUS_COLORS[detailModule.status]}>{detailModule.status}</Badge></div>
                  <div className="text-muted-foreground">Category</div>
                  <div>{detailModule.category}</div>
                  <div className="text-muted-foreground">Enabled Tenants</div>
                  <div>{detailModule.enabledTenants}</div>
                  <div className="text-muted-foreground">Feature Flag Key</div>
                  <div className="font-mono text-xs bg-muted px-2 py-1 rounded">{detailModule.featureFlagKey}</div>
                  {detailModule.maintainer && (
                    <>
                      <div className="text-muted-foreground">Maintainer</div>
                      <div>{detailModule.maintainer}</div>
                    </>
                  )}
                  {detailModule.repository && (
                    <>
                      <div className="text-muted-foreground">Repository</div>
                      <div className="font-mono text-xs">{detailModule.repository}</div>
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="versions" className="mt-4">
                {(detailModule.versionHistory || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No version history available</p>
                ) : (
                  <div className="space-y-3">
                    {(detailModule.versionHistory || []).map((v, i) => (
                      <div key={v.version} className={`p-3 border rounded-lg ${i === 0 ? 'border-primary bg-primary/5' : ''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-semibold text-sm">v{v.version}</span>
                          {i === 0 && <Badge className="text-xs bg-primary/10 text-primary">Current</Badge>}
                          {v.breaking && <Badge className="text-xs bg-orange-100 text-orange-800">Breaking Change</Badge>}
                          <span className="text-xs text-muted-foreground ml-auto">{v.releasedAt}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{v.changelog}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="deps" className="mt-4">
                {(detailModule.dependencies || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No dependencies — this module is standalone.</p>
                ) : (
                  <div className="space-y-3">
                    {(detailModule.dependencies || []).map((dep) => {
                      const depModule = modules.find((m) => m.id === dep.moduleId)
                      const satisfied = depModule && depModule.status === 'active'
                      return (
                        <div key={dep.moduleId} className={`p-3 border rounded-lg ${satisfied ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{depModule?.name || dep.moduleId}</p>
                              <p className="text-xs text-muted-foreground">
                                Min version: v{dep.minVersion} · {dep.required ? 'Required' : 'Optional'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {depModule && <Badge className={`text-xs ${STATUS_COLORS[depModule.status]}`}>{depModule.status}</Badge>}
                              {satisfied
                                ? <Badge className="text-xs bg-green-100 text-green-800">✓ Satisfied</Badge>
                                : <Badge className="text-xs bg-red-100 text-red-800">✗ Not met</Badge>
                              }
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
