import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ModuleRegistry from '@/pages/ModuleRegistry'
import * as apiClient from '@/lib/api'

// Mock apiClient
vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('ModuleRegistry Page - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch and display modules from D1', async () => {
    const mockModules = [
      {
        id: 'com-1',
        name: 'Commerce Core',
        description: 'Core e-commerce functionality',
        status: 'active',
        category: 'Commerce',
        version: '1.0.0',
        enabledTenants: 45,
        featureFlagKey: 'module_com_1',
        createdAt: '2026-03-10T10:00:00Z',
      },
      {
        id: 'fin-1',
        name: 'Fintech Core',
        description: 'Banking and payments',
        status: 'beta',
        category: 'Finance',
        version: '2.0.0',
        enabledTenants: 12,
        featureFlagKey: 'module_fin_1',
        createdAt: '2026-03-14T10:00:00Z',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockModules,
    })

    render(<ModuleRegistry />)

    await waitFor(() => {
      expect(screen.getByText('Commerce Core')).toBeInTheDocument()
      expect(screen.getByText('Fintech Core')).toBeInTheDocument()
    })

    expect(apiClient.apiClient.get).toHaveBeenCalledWith('/modules')
  })

  it('should display module statistics', async () => {
    const mockModules = [
      {
        id: 'com-1',
        name: 'Commerce Core',
        description: 'Core e-commerce functionality',
        status: 'active',
        category: 'Commerce',
        version: '1.0.0',
        enabledTenants: 45,
        featureFlagKey: 'module_com_1',
        createdAt: '2026-03-10T10:00:00Z',
      },
      {
        id: 'fin-1',
        name: 'Fintech Core',
        description: 'Banking and payments',
        status: 'beta',
        category: 'Finance',
        version: '2.0.0',
        enabledTenants: 12,
        featureFlagKey: 'module_fin_1',
        createdAt: '2026-03-14T10:00:00Z',
      },
      {
        id: 'edu-1',
        name: 'Education',
        description: 'School management',
        status: 'active',
        category: 'Education',
        version: '1.1.0',
        enabledTenants: 35,
        featureFlagKey: 'module_edu_1',
        createdAt: '2026-03-11T10:00:00Z',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockModules,
    })

    render(<ModuleRegistry />)

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument() // Total modules
      expect(screen.getByText('2')).toBeInTheDocument() // Active modules
      expect(screen.getByText('1')).toBeInTheDocument() // Beta modules
    })
  })

  it('should group modules by category', async () => {
    const mockModules = [
      {
        id: 'com-1',
        name: 'Commerce Core',
        description: 'Core e-commerce functionality',
        status: 'active',
        category: 'Commerce',
        version: '1.0.0',
        enabledTenants: 45,
        featureFlagKey: 'module_com_1',
        createdAt: '2026-03-10T10:00:00Z',
      },
      {
        id: 'com-2',
        name: 'Commerce Plus',
        description: 'Advanced commerce features',
        status: 'active',
        category: 'Commerce',
        version: '1.2.0',
        enabledTenants: 30,
        featureFlagKey: 'module_com_2',
        createdAt: '2026-03-12T10:00:00Z',
      },
      {
        id: 'fin-1',
        name: 'Fintech Core',
        description: 'Banking and payments',
        status: 'beta',
        category: 'Finance',
        version: '2.0.0',
        enabledTenants: 12,
        featureFlagKey: 'module_fin_1',
        createdAt: '2026-03-14T10:00:00Z',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockModules,
    })

    render(<ModuleRegistry />)

    await waitFor(() => {
      expect(screen.getByText('Commerce')).toBeInTheDocument()
      expect(screen.getByText('Finance')).toBeInTheDocument()
    })
  })

  it('should toggle module status and update D1 + KV', async () => {
    const mockModules = [
      {
        id: 'com-1',
        name: 'Commerce Core',
        description: 'Core e-commerce functionality',
        status: 'active',
        category: 'Commerce',
        version: '1.0.0',
        enabledTenants: 45,
        featureFlagKey: 'module_com_1',
        createdAt: '2026-03-10T10:00:00Z',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockModules,
    })

    vi.mocked(apiClient.apiClient.put).mockResolvedValueOnce({
      success: true,
    })

    vi.mocked(apiClient.apiClient.post).mockResolvedValueOnce({
      success: true,
    })

    render(<ModuleRegistry />)

    await waitFor(() => {
      expect(screen.getByText('Commerce Core')).toBeInTheDocument()
    })

    // Click disable button
    const disableButton = screen.getByText('Disable')
    fireEvent.click(disableButton)

    await waitFor(() => {
      // Should call PUT to update D1
      expect(apiClient.apiClient.put).toHaveBeenCalledWith('/modules/com-1', {
        status: 'inactive',
      })

      // Should call POST to update KV feature flag
      expect(apiClient.apiClient.post).toHaveBeenCalledWith('/kv/feature-flags', {
        key: 'module_com_1',
        value: 'false',
        ttl: 3600,
      })
    })
  })

  it('should display error when module fetch fails', async () => {
    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: false,
      error: 'Failed to fetch modules',
    })

    render(<ModuleRegistry />)

    await waitFor(() => {
      expect(screen.getByText(/Error Loading Modules/)).toBeInTheDocument()
    })
  })

  it('should display module status badges', async () => {
    const mockModules = [
      {
        id: 'com-1',
        name: 'Commerce Core',
        description: 'Core e-commerce functionality',
        status: 'active',
        category: 'Commerce',
        version: '1.0.0',
        enabledTenants: 45,
        featureFlagKey: 'module_com_1',
        createdAt: '2026-03-10T10:00:00Z',
      },
      {
        id: 'fin-1',
        name: 'Fintech Core',
        description: 'Banking and payments',
        status: 'beta',
        category: 'Finance',
        version: '2.0.0',
        enabledTenants: 12,
        featureFlagKey: 'module_fin_1',
        createdAt: '2026-03-14T10:00:00Z',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockModules,
    })

    render(<ModuleRegistry />)

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument()
      expect(screen.getByText('beta')).toBeInTheDocument()
    })
  })

  it('should display feature flag keys', async () => {
    const mockModules = [
      {
        id: 'com-1',
        name: 'Commerce Core',
        description: 'Core e-commerce functionality',
        status: 'active',
        category: 'Commerce',
        version: '1.0.0',
        enabledTenants: 45,
        featureFlagKey: 'module_com_1',
        createdAt: '2026-03-10T10:00:00Z',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockModules,
    })

    render(<ModuleRegistry />)

    await waitFor(() => {
      expect(screen.getByText('module_com_1')).toBeInTheDocument()
    })
  })

  it('should handle empty modules list', async () => {
    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: [],
    })

    render(<ModuleRegistry />)

    await waitFor(() => {
      expect(screen.getByText(/No modules found/)).toBeInTheDocument()
    })
  })

  it('should display module version and tenant count', async () => {
    const mockModules = [
      {
        id: 'com-1',
        name: 'Commerce Core',
        description: 'Core e-commerce functionality',
        status: 'active',
        category: 'Commerce',
        version: '1.0.0',
        enabledTenants: 45,
        featureFlagKey: 'module_com_1',
        createdAt: '2026-03-10T10:00:00Z',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockModules,
    })

    render(<ModuleRegistry />)

    await waitFor(() => {
      expect(screen.getByText('v1.0.0')).toBeInTheDocument()
      expect(screen.getByText('45 tenants')).toBeInTheDocument()
    })
  })

  it('should sync D1 and KV on module toggle', async () => {
    const mockModules = [
      {
        id: 'fin-1',
        name: 'Fintech Core',
        description: 'Banking and payments',
        status: 'inactive',
        category: 'Finance',
        version: '2.0.0',
        enabledTenants: 12,
        featureFlagKey: 'module_fin_1',
        createdAt: '2026-03-14T10:00:00Z',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockModules,
    })

    vi.mocked(apiClient.apiClient.put).mockResolvedValueOnce({
      success: true,
    })

    vi.mocked(apiClient.apiClient.post).mockResolvedValueOnce({
      success: true,
    })

    render(<ModuleRegistry />)

    await waitFor(() => {
      expect(screen.getByText('Fintech Core')).toBeInTheDocument()
    })

    // Click enable button
    const enableButton = screen.getByText('Enable')
    fireEvent.click(enableButton)

    await waitFor(() => {
      // Verify both D1 and KV are updated
      expect(apiClient.apiClient.put).toHaveBeenCalled()
      expect(apiClient.apiClient.post).toHaveBeenCalled()

      // Verify KV flag is set to 'true' when enabling
      expect(apiClient.apiClient.post).toHaveBeenCalledWith('/kv/feature-flags', {
        key: 'module_fin_1',
        value: 'true',
        ttl: 3600,
      })
    })
  })
})
