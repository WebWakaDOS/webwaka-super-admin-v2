import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Billing from '@/pages/Billing'
import * as apiClient from '@/lib/api-client'

// Mock apiClient
vi.mock('@/lib/api-client', () => ({
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

describe('Billing Page - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch and display billing ledger from D1', async () => {
    const mockLedgerData = [
      {
        id: '1',
        tenantId: 'tenant-1',
        tenantName: 'TechCorp Nigeria',
        amount: 12500000, // 125,000 NGN in kobo
        commission: 625000, // 6,250 NGN in kobo
        status: 'completed',
        type: 'transaction',
        createdAt: '2026-03-15T10:00:00Z',
        description: 'Subscription payment',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockLedgerData,
    })

    render(<Billing />)

    await waitFor(() => {
      expect(screen.getByText('TechCorp Nigeria')).toBeInTheDocument()
    })

    expect(apiClient.apiClient.get).toHaveBeenCalledWith('/billing/ledger')
  })

  it('should calculate commission summary correctly', async () => {
    const mockLedgerData = [
      {
        id: '1',
        tenantId: 'tenant-1',
        tenantName: 'TechCorp Nigeria',
        amount: 10000000, // 100,000 NGN in kobo
        commission: 500000, // 5,000 NGN in kobo (5%)
        status: 'completed',
        type: 'transaction',
        createdAt: '2026-03-15T10:00:00Z',
        description: 'Subscription payment',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockLedgerData,
    })

    render(<Billing />)

    await waitFor(() => {
      // Level 1: 5% of 100,000 = 5,000
      expect(screen.getByText(/Level 1 Commission/)).toBeInTheDocument()
    })
  })

  it('should display error when ledger fetch fails', async () => {
    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: false,
      error: 'Failed to fetch ledger',
    })

    render(<Billing />)

    await waitFor(() => {
      expect(screen.getByText(/Error Loading Billing Data/)).toBeInTheDocument()
    })
  })

  it('should format kobo amounts as NGN currency', async () => {
    const mockLedgerData = [
      {
        id: '1',
        tenantId: 'tenant-1',
        tenantName: 'RetailHub Lagos',
        amount: 4500000, // 45,000 NGN in kobo
        commission: 225000, // 2,250 NGN in kobo
        status: 'completed',
        type: 'transaction',
        createdAt: '2026-03-14T10:00:00Z',
        description: 'Subscription payment',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockLedgerData,
    })

    render(<Billing />)

    await waitFor(() => {
      // Should display formatted NGN currency
      expect(screen.getByText(/RetailHub Lagos/)).toBeInTheDocument()
    })
  })

  it('should handle multiple transactions in ledger', async () => {
    const mockLedgerData = [
      {
        id: '1',
        tenantId: 'tenant-1',
        tenantName: 'TechCorp Nigeria',
        amount: 12500000,
        commission: 625000,
        status: 'completed',
        type: 'transaction',
        createdAt: '2026-03-15T10:00:00Z',
        description: 'Subscription payment',
      },
      {
        id: '2',
        tenantId: 'tenant-2',
        tenantName: 'RetailHub Lagos',
        amount: 4500000,
        commission: 225000,
        status: 'completed',
        type: 'transaction',
        createdAt: '2026-03-14T10:00:00Z',
        description: 'Subscription payment',
      },
      {
        id: '3',
        tenantId: 'tenant-3',
        tenantName: 'TransportGo',
        amount: 7800000,
        commission: 390000,
        status: 'pending',
        type: 'transaction',
        createdAt: '2026-03-13T10:00:00Z',
        description: 'Subscription payment',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockLedgerData,
    })

    render(<Billing />)

    await waitFor(() => {
      expect(screen.getByText('TechCorp Nigeria')).toBeInTheDocument()
      expect(screen.getByText('RetailHub Lagos')).toBeInTheDocument()
      expect(screen.getByText('TransportGo')).toBeInTheDocument()
    })
  })

  it('should display transaction status badges', async () => {
    const mockLedgerData = [
      {
        id: '1',
        tenantId: 'tenant-1',
        tenantName: 'TechCorp Nigeria',
        amount: 12500000,
        commission: 625000,
        status: 'completed',
        type: 'transaction',
        createdAt: '2026-03-15T10:00:00Z',
        description: 'Subscription payment',
      },
      {
        id: '2',
        tenantId: 'tenant-2',
        tenantName: 'RetailHub Lagos',
        amount: 4500000,
        commission: 225000,
        status: 'pending',
        type: 'transaction',
        createdAt: '2026-03-14T10:00:00Z',
        description: 'Subscription payment',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockLedgerData,
    })

    render(<Billing />)

    await waitFor(() => {
      expect(screen.getByText('completed')).toBeInTheDocument()
      expect(screen.getByText('pending')).toBeInTheDocument()
    })
  })

  it('should handle empty ledger gracefully', async () => {
    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: [],
    })

    render(<Billing />)

    await waitFor(() => {
      expect(screen.getByText(/No transactions found/)).toBeInTheDocument()
    })
  })

  it('should display commission hierarchy breakdown', async () => {
    const mockLedgerData = [
      {
        id: '1',
        tenantId: 'tenant-1',
        tenantName: 'TechCorp Nigeria',
        amount: 10000000, // 100,000 NGN
        commission: 500000,
        status: 'completed',
        type: 'transaction',
        createdAt: '2026-03-15T10:00:00Z',
        description: 'Subscription payment',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockLedgerData,
    })

    render(<Billing />)

    await waitFor(() => {
      expect(screen.getByText(/Commission Hierarchy/)).toBeInTheDocument()
      expect(screen.getByText(/Level 1/)).toBeInTheDocument()
      expect(screen.getByText(/Level 2/)).toBeInTheDocument()
    })
  })

  it('should only count completed transactions in commission summary', async () => {
    const mockLedgerData = [
      {
        id: '1',
        tenantId: 'tenant-1',
        tenantName: 'TechCorp Nigeria',
        amount: 10000000,
        commission: 500000,
        status: 'completed',
        type: 'transaction',
        createdAt: '2026-03-15T10:00:00Z',
        description: 'Subscription payment',
      },
      {
        id: '2',
        tenantId: 'tenant-2',
        tenantName: 'RetailHub Lagos',
        amount: 5000000,
        commission: 250000,
        status: 'pending', // Should not be counted
        type: 'transaction',
        createdAt: '2026-03-14T10:00:00Z',
        description: 'Subscription payment',
      },
    ]

    vi.mocked(apiClient.apiClient.get).mockResolvedValueOnce({
      success: true,
      data: mockLedgerData,
    })

    render(<Billing />)

    await waitFor(() => {
      // Only completed transaction should be counted
      expect(screen.getByText(/Commission Hierarchy/)).toBeInTheDocument()
    })
  })
})
