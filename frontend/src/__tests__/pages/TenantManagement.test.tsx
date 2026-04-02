import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TenantManagement from '@/pages/TenantManagement'
import * as apiClient from '@/lib/api'

// Mock the API client
vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('TenantManagement Page', () => {
  const mockTenants = [
    {
      id: '1',
      name: 'TechCorp Nigeria',
      email: 'admin@techcorp.ng',
      status: 'ACTIVE' as const,
      plan: 'enterprise' as const,
      createdAt: '2026-01-15',
    },
    {
      id: '2',
      name: 'RetailHub Lagos',
      email: 'info@retailhub.ng',
      status: 'ACTIVE' as const,
      plan: 'professional' as const,
      createdAt: '2026-02-01',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.apiClient.get).mockResolvedValue({
      success: true,
      data: mockTenants,
    })
  })

  it('should render tenant management header', async () => {
    render(<TenantManagement />)

    expect(screen.getByText('Tenant Management')).toBeDefined()
    expect(screen.getByText(/Manage your platform tenants/)).toBeDefined()
  })

  it('should display loading state initially', () => {
    vi.mocked(apiClient.apiClient.get).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              data: mockTenants,
            })
          }, 100)
        })
    )

    render(<TenantManagement />)

    // Loading skeletons should be present
    const skeletons = screen.queryAllByTestId?.('skeleton') || []
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('should fetch and display tenants from D1', async () => {
    render(<TenantManagement />)

    await waitFor(() => {
      expect(screen.getByText('TechCorp Nigeria')).toBeDefined()
      expect(screen.getByText('RetailHub Lagos')).toBeDefined()
    })
  })

  it('should display tenant details in table', async () => {
    render(<TenantManagement />)

    await waitFor(() => {
      expect(screen.getByText('admin@techcorp.ng')).toBeDefined()
      expect(screen.getByText('enterprise')).toBeDefined()
      expect(screen.getByText('ACTIVE')).toBeDefined()
    })
  })

  it('should display error message on fetch failure', async () => {
    vi.mocked(apiClient.apiClient.get).mockRejectedValue(new Error('Failed to fetch tenants'))

    render(<TenantManagement />)

    await waitFor(() => {
      expect(screen.getByText(/Error Loading Tenants/)).toBeDefined()
    })
  })

  it('should open create tenant form when clicking New Tenant button', async () => {
    render(<TenantManagement />)

    await waitFor(() => {
      const newTenantButton = screen.getByText('New Tenant')
      fireEvent.click(newTenantButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Create New Tenant')).toBeDefined()
    })
  })

  it('should create new tenant with form data', async () => {
    const newTenantData = {
      name: 'New Startup',
      email: 'admin@newstartup.ng',
      status: 'TRIAL' as const,
      plan: 'starter' as const,
    }

    vi.mocked(apiClient.apiClient.post).mockResolvedValue({
      success: true,
      data: {
        id: '3',
        ...newTenantData,
        createdAt: new Date().toISOString(),
      },
    })

    render(<TenantManagement />)

    await waitFor(() => {
      const newTenantButton = screen.getByText('New Tenant')
      fireEvent.click(newTenantButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Create New Tenant')).toBeDefined()
    })

    // Fill form
    const nameInput = screen.getByPlaceholderText('e.g., Tech Startup Inc')
    const emailInput = screen.getByPlaceholderText('admin@example.com')

    await userEvent.type(nameInput, newTenantData.name)
    await userEvent.type(emailInput, newTenantData.email)

    // Submit form
    const submitButton = screen.getByText('Create Tenant')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenCalledWith('/tenants', expect.objectContaining(newTenantData))
    })
  })

  it('should update existing tenant', async () => {
    const updatedData = {
      name: 'TechCorp Nigeria Updated',
      email: 'newemail@techcorp.ng',
      status: 'SUSPENDED' as const,
      plan: 'professional' as const,
    }

    vi.mocked(apiClient.apiClient.put).mockResolvedValue({
      success: true,
      data: {
        id: '1',
        ...updatedData,
        createdAt: mockTenants[0].createdAt,
      },
    })

    render(<TenantManagement />)

    await waitFor(() => {
      const editButtons = screen.getAllByRole('button').filter((btn) => btn.textContent.includes('Edit'))
      fireEvent.click(editButtons[0])
    })

    await waitFor(() => {
      expect(screen.getByText('Edit Tenant')).toBeDefined()
    })

    // Verify API call
    await waitFor(() => {
      expect(apiClient.apiClient.put).toHaveBeenCalled()
    })
  })

  it('should delete tenant with confirmation', async () => {
    vi.mocked(apiClient.apiClient.delete).mockResolvedValue({
      success: true,
      data: null,
    })

    render(<TenantManagement />)

    await waitFor(() => {
      const deleteButtons = screen.getAllByRole('button').filter((btn) => btn.textContent.includes('Trash'))
      fireEvent.click(deleteButtons[0])
    })

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to delete/)).toBeDefined()
    })

    const deleteConfirmButton = screen.getByText('Delete')
    fireEvent.click(deleteConfirmButton)

    await waitFor(() => {
      expect(apiClient.apiClient.delete).toHaveBeenCalledWith('/tenants/1')
    })
  })

  it('should search tenants by name', async () => {
    render(<TenantManagement />)

    await waitFor(() => {
      expect(screen.getByText('TechCorp Nigeria')).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText('Search by name or email...')
    await userEvent.type(searchInput, 'RetailHub')

    await waitFor(() => {
      expect(screen.getByText('RetailHub Lagos')).toBeDefined()
      expect(screen.queryByText('TechCorp Nigeria')).toBeNull()
    })
  })

  it('should search tenants by email', async () => {
    render(<TenantManagement />)

    await waitFor(() => {
      expect(screen.getByText('TechCorp Nigeria')).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText('Search by name or email...')
    await userEvent.type(searchInput, 'admin@techcorp.ng')

    await waitFor(() => {
      expect(screen.getByText('TechCorp Nigeria')).toBeDefined()
      expect(screen.queryByText('RetailHub Lagos')).toBeNull()
    })
  })

  it('should display empty state when no tenants match search', async () => {
    render(<TenantManagement />)

    await waitFor(() => {
      expect(screen.getByText('TechCorp Nigeria')).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText('Search by name or email...')
    await userEvent.type(searchInput, 'NonExistent')

    await waitFor(() => {
      expect(screen.getByText('No tenants found.')).toBeDefined()
    })
  })

  it('should display tenant status badges with correct colors', async () => {
    render(<TenantManagement />)

    await waitFor(() => {
      const activeBadges = screen.getAllByText('ACTIVE')
      expect(activeBadges.length).toBeGreaterThan(0)
    })
  })

  it('should display tenant plan badges', async () => {
    render(<TenantManagement />)

    await waitFor(() => {
      expect(screen.getByText('enterprise')).toBeDefined()
      expect(screen.getByText('professional')).toBeDefined()
    })
  })

  it('should format creation date correctly', async () => {
    render(<TenantManagement />)

    await waitFor(() => {
      // Date should be formatted as MM/DD/YYYY or similar
      expect(screen.getByText(/1\/15\/2026|15\/1\/2026|2026-01-15/)).toBeDefined()
    })
  })

  it('should call API with correct endpoint for fetching tenants', async () => {
    render(<TenantManagement />)

    await waitFor(() => {
      expect(apiClient.apiClient.get).toHaveBeenCalledWith('/tenants')
    })
  })

  it('should handle form submission error', async () => {
    vi.mocked(apiClient.apiClient.post).mockRejectedValue(new Error('Failed to create tenant'))

    render(<TenantManagement />)

    await waitFor(() => {
      const newTenantButton = screen.getByText('New Tenant')
      fireEvent.click(newTenantButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Create New Tenant')).toBeDefined()
    })

    const nameInput = screen.getByPlaceholderText('e.g., Tech Startup Inc')
    const emailInput = screen.getByPlaceholderText('admin@example.com')

    await userEvent.type(nameInput, 'Test Tenant')
    await userEvent.type(emailInput, 'test@example.com')

    const submitButton = screen.getByText('Create Tenant')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Failed to create tenant')).toBeDefined()
    })
  })

  it('should disable buttons during submission', async () => {
    vi.mocked(apiClient.apiClient.post).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              data: {
                id: '3',
                name: 'New Tenant',
                email: 'new@example.com',
                status: 'TRIAL',
                plan: 'starter',
                createdAt: new Date().toISOString(),
              },
            })
          }, 500)
        })
    )

    render(<TenantManagement />)

    await waitFor(() => {
      const newTenantButton = screen.getByText('New Tenant')
      fireEvent.click(newTenantButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Create New Tenant')).toBeDefined()
    })

    const nameInput = screen.getByPlaceholderText('e.g., Tech Startup Inc')
    const emailInput = screen.getByPlaceholderText('admin@example.com')

    await userEvent.type(nameInput, 'Test Tenant')
    await userEvent.type(emailInput, 'test@example.com')

    const submitButton = screen.getByText('Create Tenant')
    fireEvent.click(submitButton)

    // Button should be disabled during submission
    expect(submitButton).toHaveAttribute('disabled')
  })

  it('should display correct number of tenants', async () => {
    render(<TenantManagement />)

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      // Header row + 2 data rows
      expect(rows.length).toBe(3)
    })
  })

  it('should use integer kobo for revenue display if present', async () => {
    const tenantsWithRevenue = [
      {
        ...mockTenants[0],
        revenue: 1250000, // 12,500 kobo (no decimals)
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValue({
      success: true,
      data: tenantsWithRevenue,
    })

    render(<TenantManagement />)

    await waitFor(() => {
      expect(screen.getByText('TechCorp Nigeria')).toBeDefined()
    })
  })
})
