import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, CheckCircle2, AlertTriangle, Activity } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

interface ServiceStatus {
  id: string
  name: string
  status: 'healthy' | 'degraded' | 'down'
  uptime: number
  responseTime: number
  lastChecked: string
  region: string
  dependencies: string[]
}

interface HealthMetrics {
  overallStatus: 'healthy' | 'degraded' | 'down'
  uptime: number
  averageResponseTime: number
  totalRequests: number
  errorRate: number
  activeConnections: number
  lastUpdated: string
}

export default function Health() {
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch health status from D1
        const healthResponse = await apiClient.get('/health')
        if (!healthResponse.success) {
          throw new Error('Failed to fetch health status')
        }

        const healthData = healthResponse.data || {}
        setServices(healthData.services || [])
        setMetrics(healthData.metrics || null)
        setLoading(false)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch health data'
        setError(errorMessage)
        setLoading(false)
        toast.error(errorMessage)
      }
    }

    fetchHealthData()

    // Refresh health data every 30 seconds
    const interval = setInterval(fetchHealthData, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'down':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      default:
        return <Activity className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800'
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800'
      case 'down':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (error && !metrics) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Health</h1>
          <p className="text-muted-foreground mt-2">Real-time platform status and metrics.</p>
        </div>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">Error Loading Health Data</p>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Health</h1>
        <p className="text-muted-foreground mt-2">Real-time platform status and metrics.</p>
      </div>

      {/* Overall Status */}
      {loading ? (
        <Skeleton className="h-32" />
      ) : metrics ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(metrics.overallStatus)}
              Overall Status
            </CardTitle>
            <CardDescription>Last updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-2xl font-bold capitalize">{metrics.overallStatus}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Uptime</p>
                <p className="text-2xl font-bold">{metrics.uptime.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">{metrics.averageResponseTime}ms</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{metrics.totalRequests.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Error Rate</p>
                <p className="text-2xl font-bold">{metrics.errorRate.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Connections</p>
                <p className="text-2xl font-bold">{metrics.activeConnections.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Service Status */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4">Service Status</h2>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : services.length > 0 ? (
          <div className="space-y-4">
            {services.map((service) => (
              <Card key={service.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      {getStatusIcon(service.status)}
                      <div className="flex-1">
                        <p className="font-semibold">{service.name}</p>
                        <p className="text-sm text-muted-foreground">{service.region}</p>
                        <div className="flex items-center gap-4 mt-3 text-sm">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(service.status)}`}>
                            {service.status}
                          </span>
                          <span className="text-muted-foreground">Uptime: {service.uptime.toFixed(2)}%</span>
                          <span className="text-muted-foreground">Response: {service.responseTime}ms</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Last checked</p>
                      <p>{new Date(service.lastChecked).toLocaleTimeString()}</p>
                    </div>
                  </div>

                  {service.dependencies.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-semibold mb-2">Dependencies:</p>
                      <div className="flex flex-wrap gap-2">
                        {service.dependencies.map((dep, idx) => (
                          <span key={idx} className="inline-block px-2 py-1 bg-muted rounded text-xs">
                            {dep}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <p className="text-muted-foreground">No services found.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Health Check Info */}
      <Card>
        <CardHeader>
          <CardTitle>Health Check Information</CardTitle>
          <CardDescription>Platform health is monitored continuously</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Health data is fetched from the D1 health table and updated every 30 seconds. Each service is monitored
              for uptime, response time, and error rates.
            </p>
            <p className="text-muted-foreground">
              Overall platform status is determined by the status of all critical services. If any critical service is
              down, the overall status will be marked as down.
            </p>
            <p className="text-muted-foreground">
              Status Definitions:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><span className="font-semibold">Healthy:</span> All metrics within normal ranges</li>
              <li><span className="font-semibold">Degraded:</span> Some metrics elevated but service operational</li>
              <li><span className="font-semibold">Down:</span> Service unavailable or critical issues detected</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
