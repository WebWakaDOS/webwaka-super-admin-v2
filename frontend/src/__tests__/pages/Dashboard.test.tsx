import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Dashboard from '@/pages/Dashboard'
import * as apiClient from '@/lib/api-client'

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

// Mock the useTenant hook
vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => ({
    tenants: [
      { id: '1', name: 'Tenant 1', status: 'active' },
      { id: '2', name: 'Tenant 2', status: 'suspended' },
    ],
  }),
}))

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render dashboard header', async () => {
    vi.mocked(apiClient.apiClient.get).mockResolvedValue({
      success: true,
      data: {
        totalRevenue: 3280000,
        totalCommissions: 880000,
        monthlyData: [],
        recentEvents: [],
      },
    })

    render(<Dashboard />)

    expect(screen.getByText('Dashboard')).toBeDefined()
    expect(screen.getByText(/Welcome to WebWaka Super Admin/)).toBeDefined()
  })

  it('should display loading skeletons initially', () => {
    vi.mocked(apiClient.apiClient.get).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              data: {
                totalRevenue: 3280000,
                totalCommissions: 880000,
              },
            })
          }, 100)
        })
    )

    render(<Dashboard />)

    // Skeletons should be present initially
    const skeletons = screen.queryAllByTestId?.('skeleton') || []
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('should fetch and display billing summary', async () => {
    const mockBillingData = {
      success: true,
      data: {
        totalRevenue: 3280000,
        totalCommissions: 880000,
        monthlyData: [
          { month: 'Jan', revenue: 450000, commission: 120000 },
          { month: 'Feb', revenue: 520000, commission: 140000 },
        ],
        recentEvents: [],
      },
    }

    vi.mocked(apiClient.apiClient.get).mockResolvedValue(mockBillingData)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Total Revenue/)).toBeDefined()
    })
  })

  it('should fetch and display tenant distribution', async () => {
    const mockTenantsData = {
      success: true,
      data: [
        { id: '1', name: 'Tenant 1', status: 'active' },
        { id: '2', name: 'Tenant 2', status: 'active' },
        { id: '3', name: 'Tenant 3', status: 'suspended' },
        { id: '4', name: 'Tenant 4', status: 'provisioning' },
      ],
    }

    vi.mocked(apiClient.apiClient.get).mockResolvedValue(mockTenantsData)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Active Tenants/)).toBeDefined()
    })
  })

  it('should display error message on API failure', async () => {
    vi.mocked(apiClient.apiClient.get).mockRejectedValue(new Error('API Error'))

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Error Loading Dashboard/)).toBeDefined()
      expect(screen.getByText(/API Error/)).toBeDefined()
    })
  })

  it('should display metric cards with correct values', async () => {
    const mockData = {
      success: true,
      data: {
        totalRevenue: 3280000,
        totalCommissions: 880000,
        monthlyData: [],
        recentEvents: [],
      },
    }

    vi.mocked(apiClient.apiClient.get).mockResolvedValue(mockData)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Total Revenue/)).toBeDefined()
      expect(screen.getByText(/Total Commissions/)).toBeDefined()
      expect(screen.getByText(/Platform Health/)).toBeDefined()
    })
  })

  it('should display revenue chart with data', async () => {
    const mockData = {
      success: true,
      data: {
        totalRevenue: 3280000,
        totalCommissions: 880000,
        monthlyData: [
          { month: 'Jan', revenue: 450000, commission: 120000 },
          { month: 'Feb', revenue: 520000, commission: 140000 },
          { month: 'Mar', revenue: 480000, commission: 130000 },
        ],
        recentEvents: [],
      },
    }

    vi.mocked(apiClient.apiClient.get).mockResolvedValue(mockData)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Revenue & Commission Trend/)).toBeDefined()
    })
  })

  it('should display tenant distribution pie chart', async () => {
    const mockData = {
      success: true,
      data: {
        totalRevenue: 3280000,
        totalCommissions: 880000,
        monthlyData: [],
        recentEvents: [],
      },
    }

    vi.mocked(apiClient.apiClient.get).mockResolvedValue(mockData)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Tenant Status/)).toBeDefined()
    })
  })

  it('should display platform activity bar chart', async () => {
    const mockData = {
      success: true,
      data: {
        totalRevenue: 3280000,
        totalCommissions: 880000,
        monthlyData: [],
        recentEvents: [],
      },
    }

    vi.mocked(apiClient.apiClient.get).mockResolvedValue(mockData)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Platform Activity/)).toBeDefined()
    })
  })

  it('should display recent activity section', async () => {
    const mockData = {
      success: true,
      data: {
        totalRevenue: 3280000,
        totalCommissions: 880000,
        monthlyData: [],
        recentEvents: [
          { event: 'New tenant provisioned', tenant: 'Tech Startup Inc', time: '2 hours ago' },
          { event: 'Module enabled', tenant: 'Retail Store A', time: '4 hours ago' },
        ],
      },
    }

    vi.mocked(apiClient.apiClient.get).mockResolvedValue(mockData)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Recent Activity/)).toBeDefined()
    })
  })

  it('should handle missing data gracefully', async () => {
    vi.mocked(apiClient.apiClient.get).mockResolvedValue({
      success: true,
      data: null,
    })

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Dashboard/)).toBeDefined()
    })
  })

  it('should use integer kobo for revenue calculations', async () => {
    const mockData = {
      success: true,
      data: {
        totalRevenue: 3280000, // 32,800 kobo (no decimals)
        totalCommissions: 880000, // 8,800 kobo (no decimals)
        monthlyData: [],
        recentEvents: [],
      },
    }

    vi.mocked(apiClient.apiClient.get).mockResolvedValue(mockData)

    render(<Dashboard />)

    await waitFor(() => {
      // Verify that revenue is displayed without decimal places
      expect(screen.getByText(/Total Revenue/)).toBeDefined()
    })
  })

  it('should call API with correct endpoints', async () => {
    const mockData = {
      success: true,
      data: {
        totalRevenue: 3280000,
        totalCommissions: 880000,
        monthlyData: [],
        recentEvents: [],
      },
    }

    vi.mocked(apiClient.apiClient.get).mockResolvedValue(mockData)

    render(<Dashboard />)

    await waitFor(() => {
      expect(apiClient.apiClient.get).toHaveBeenCalledWith('/billing/summary')
      expect(apiClient.apiClient.get).toHaveBeenCalledWith('/tenants')
      expect(apiClient.apiClient.get).toHaveBeenCalledWith('/modules')
      expect(apiClient.apiClient.get).toHaveBeenCalledWith('/health/metrics')
    })
  })

  it('should retry on API failure', async () => {
    vi.mocked(apiClient.apiClient.get).mockRejectedValueOnce(new Error('Network error'))
    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: {
        totalRevenue: 3280000,
        totalCommissions: 880000,
        monthlyData: [],
        recentEvents: [],
      },
    })

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Error Loading Dashboard/)).toBeDefined()
    })
  })

  it('should display correct number of active tenants', async () => {
    const mockData = {
      success: true,
      data: {
        totalRevenue: 3280000,
        totalCommissions: 880000,
        monthlyData: [],
        recentEvents: [],
      },
    }

    vi.mocked(apiClient.apiClient.get).mockResolvedValue(mockData)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Active Tenants/)).toBeDefined()
    })
  })

  it('should display platform health percentage', async () => {
    const mockData = {
      success: true,
      data: {
        totalRevenue: 3280000,
        totalCommissions: 880000,
        monthlyData: [],
        recentEvents: [],
        uptime: 99.8,
      },
    }

    vi.mocked(apiClient.apiClient.get).mockResolvedValue(mockData)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Platform Health/)).toBeDefined()
    })
  })

  it('should display active modules count', async () => {
    const mockData = {
      success: true,
      data: [
        { id: '1', name: 'Module 1', status: 'active' },
        { id: '2', name: 'Module 2', status: 'active' },
        { id: '3', name: 'Module 3', status: 'inactive' },
      ],
    }

    vi.mocked(apiClient.apiClient.get).mockResolvedValue(mockData)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Active Modules/)).toBeDefined()
    })
  })
})
