import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Toggle2, Package } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

interface Module {
  id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'beta'
  category: string
  version: string
  enabledTenants: number
  featureFlagKey: string
  createdAt: string
}

export default function ModuleRegistry() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingModuleId, setTogglingModuleId] = useState<string | null>(null)

  useEffect(() => {
    const fetchModules = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch modules from D1
        const response = await apiClient.get('/modules')
        if (!response.success) {
          throw new Error('Failed to fetch modules')
        }

        const modulesData = response.data || []
        setModules(modulesData)
        setLoading(false)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch modules'
        setError(errorMessage)
        setLoading(false)
        toast.error(errorMessage)
      }
    }

    fetchModules()
  }, [])

  const handleToggleModule = async (module: Module) => {
    try {
      setTogglingModuleId(module.id)

      const newStatus = module.status === 'active' ? 'inactive' : 'active'

      // Update module status in D1
      const response = await apiClient.put(`/modules/${module.id}`, {
        status: newStatus,
      })

      if (!response.success) {
        throw new Error('Failed to update module status')
      }

      // Update KV feature flag
      const featureFlagKey = `module_${module.id}`
      const flagResponse = await apiClient.post('/kv/feature-flags', {
        key: featureFlagKey,
        value: newStatus === 'active' ? 'true' : 'false',
        ttl: 3600, // 1 hour TTL
      })

      if (!flagResponse.success) {
        throw new Error('Failed to update feature flag')
      }

      // Update local state
      setModules(
        modules.map((m) =>
          m.id === module.id
            ? {
                ...m,
                status: newStatus,
              }
            : m
        )
      )

      toast.success(`Module ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update module'
      toast.error(errorMessage)
    } finally {
      setTogglingModuleId(null)
    }
  }

  if (error && modules.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Module Registry</h1>
          <p className="text-muted-foreground mt-2">Manage platform modules and feature flags.</p>
        </div>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">Error Loading Modules</p>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Group modules by category
  const modulesByCategory = modules.reduce(
    (acc, module) => {
      if (!acc[module.category]) {
        acc[module.category] = []
      }
      acc[module.category].push(module)
      return acc
    },
    {} as Record<string, Module[]>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Module Registry</h1>
        <p className="text-muted-foreground mt-2">Manage platform modules and feature flags.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Modules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{modules.length}</div>
                <p className="text-xs text-muted-foreground">Platform modules</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Modules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{modules.filter((m) => m.status === 'active').length}</div>
                <p className="text-xs text-muted-foreground">Currently enabled</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Beta Modules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{modules.filter((m) => m.status === 'beta').length}</div>
                <p className="text-xs text-muted-foreground">In testing</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Modules by Category */}
      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : Object.keys(modulesByCategory).length > 0 ? (
        Object.entries(modulesByCategory).map(([category, categoryModules]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {category}
              </CardTitle>
              <CardDescription>{categoryModules.length} modules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categoryModules.map((module) => (
                  <div
                    key={module.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{module.name}</p>
                      <p className="text-sm text-muted-foreground">{module.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>v{module.version}</span>
                        <span>{module.enabledTenants} tenants</span>
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                          {module.featureFlagKey}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                          module.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : module.status === 'beta'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {module.status}
                      </span>

                      <Button
                        variant={module.status === 'active' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleModule(module)}
                        disabled={togglingModuleId === module.id}
                      >
                        <Toggle2 className="h-4 w-4 mr-2" />
                        {module.status === 'active' ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground">No modules found.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feature Flags Info */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
          <CardDescription>Module status is synchronized with KV feature flags</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Each module has a corresponding feature flag stored in KV namespace with a 1-hour TTL. When you enable or
              disable a module, both the D1 database and KV namespace are updated to ensure consistency across the
              platform.
            </p>
            <p className="text-muted-foreground">
              Feature flag keys follow the pattern: <code className="bg-muted px-2 py-1 rounded">module_&lt;id&gt;</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Mock modules for reference
const MOCK_MODULES: Module[] = [
  ]
