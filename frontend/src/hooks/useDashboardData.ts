import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'

export interface DashboardMetrics {
  totalRevenue: number
  totalCommissions: number
  activeModules: number
  platformHealth: number
  activeTenantsCount: number
  suspendedTenantsCount: number
  provisioningTenantsCount: number
}

export interface RevenueData {
  month: string
  revenue: number
  commission: number
}

export interface TenantDistribution {
  name: string
  value: number
  color: string
}

export interface ActivityData {
  time: string
  transactions: number
  signups: number
}

export interface RecentActivity {
  event: string
  tenant: string
  time: string
}

export function useDashboardData() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [tenantDistribution, setTenantDistribution] = useState<TenantDistribution[]>([])
  const [activityData, setActivityData] = useState<ActivityData[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch billing summary for metrics and revenue data
        const billingResponse = await apiClient.get('/billing/summary')
        if (!billingResponse.success) {
          throw new Error('Failed to fetch billing summary')
        }

        const billingData = billingResponse.data
        
        // Fetch tenants for distribution
        const tenantsResponse = await apiClient.get('/tenants')
        if (!tenantsResponse.success) {
          throw new Error('Failed to fetch tenants')
        }

        const tenants = tenantsResponse.data || []
        const activeTenants = tenants.filter((t: any) => t.status === 'active').length
        const suspendedTenants = tenants.filter((t: any) => t.status === 'suspended').length
        const provisioningTenants = tenants.filter((t: any) => t.status === 'provisioning').length

        // Fetch modules for active modules count
        const modulesResponse = await apiClient.get('/modules')
        if (!modulesResponse.success) {
          throw new Error('Failed to fetch modules')
        }

        const modules = modulesResponse.data || []
        const activeModulesCount = modules.filter((m: any) => m.status === 'active').length

        // Fetch health metrics
        const healthResponse = await apiClient.get('/health/metrics')
        if (!healthResponse.success) {
          throw new Error('Failed to fetch health metrics')
        }

        const healthMetrics = healthResponse.data
        const platformHealthPercentage = healthMetrics?.uptime || 99.8

        // Set metrics
        setMetrics({
          totalRevenue: billingData?.totalRevenue || 0,
          totalCommissions: billingData?.totalCommissions || 0,
          activeModules: activeModulesCount,
          platformHealth: platformHealthPercentage,
          activeTenantsCount: activeTenants,
          suspendedTenantsCount: suspendedTenants,
          provisioningTenantsCount: provisioningTenants,
        })

        // Set revenue data (6 months aggregation)
        const revenueDataFormatted: RevenueData[] = billingData?.monthlyData || [
          { month: 'Jan', revenue: 0, commission: 0 },
          { month: 'Feb', revenue: 0, commission: 0 },
          { month: 'Mar', revenue: 0, commission: 0 },
          { month: 'Apr', revenue: 0, commission: 0 },
          { month: 'May', revenue: 0, commission: 0 },
          { month: 'Jun', revenue: 0, commission: 0 },
        ]
        setRevenueData(revenueDataFormatted)

        // Set tenant distribution
        const distribution: TenantDistribution[] = [
          { name: 'Active', value: activeTenants, color: '#10B981' },
          { name: 'Suspended', value: suspendedTenants, color: '#EF4444' },
          { name: 'Provisioning', value: provisioningTenants, color: '#F59E0B' },
        ]
        setTenantDistribution(distribution)

        // Set activity data (hourly aggregation)
        const activityDataFormatted: ActivityData[] = healthMetrics?.hourlyData || [
          { time: '00:00', transactions: 0, signups: 0 },
          { time: '04:00', transactions: 0, signups: 0 },
          { time: '08:00', transactions: 0, signups: 0 },
          { time: '12:00', transactions: 0, signups: 0 },
          { time: '16:00', transactions: 0, signups: 0 },
          { time: '20:00', transactions: 0, signups: 0 },
        ]
        setActivityData(activityDataFormatted)

        // Set recent activity (latest 4 events)
        const recentActivityFormatted: RecentActivity[] = billingData?.recentEvents || [
          { event: 'No recent activity', tenant: 'System', time: 'N/A' },
        ]
        setRecentActivity(recentActivityFormatted)

        setLoading(false)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dashboard data'
        setError(errorMessage)
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  return {
    metrics,
    revenueData,
    tenantDistribution,
    activityData,
    recentActivity,
    loading,
    error,
  }
}
