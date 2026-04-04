import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AIUsage from '@/pages/AIUsage'
import * as apiModule from '@/lib/api'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'admin@webwaka.com', name: 'Admin', role: 'super_admin', permissions: ['view:billing'] },
    hasPermission: (p: string) => p === 'view:billing',
    hasRole: (r: string) => r === 'super_admin',
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ── Helpers ────────────────────────────────────────────────────────────────

const mockSummary = {
  total_tokens: 2880000,
  total_cost_usd_cents: 4260,
  total_requests: 3550,
  active_tenants: 5,
  records: [
    {
      tenant_id: 't1',
      tenant_name: 'Acme Corp',
      model: 'gpt-4o',
      tokens_input: 800000,
      tokens_output: 200000,
      total_tokens: 1000000,
      cost_usd_cents: 2000,
      request_count: 1200,
      period: '30d',
    },
    {
      tenant_id: 't2',
      tenant_name: 'TechHub Nigeria',
      model: 'gpt-4o-mini',
      tokens_input: 600000,
      tokens_output: 150000,
      total_tokens: 750000,
      cost_usd_cents: 750,
      request_count: 980,
      period: '30d',
    },
  ],
  daily_trend: [
    { date: 'Apr 1', tokens: 450000, cost_cents: 900, requests: 450 },
    { date: 'Apr 2', tokens: 520000, cost_cents: 1040, requests: 520 },
    { date: 'Apr 3', tokens: 480000, cost_cents: 960, requests: 480 },
  ],
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AI Usage Dashboard (QA-SUP-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page heading', () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    render(<AIUsage />)
    expect(screen.getByText('AI Usage Dashboard')).toBeInTheDocument()
  })

  it('fetches token consumption data from the correct API endpoint', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    render(<AIUsage />)
    await waitFor(() => {
      expect(apiModule.apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/ai/usage'))
    })
  })

  it('displays total tokens metric card after successful fetch', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    render(<AIUsage />)
    await waitFor(() => {
      expect(screen.getByText('Total Tokens')).toBeInTheDocument()
    })
  })

  it('displays total cost metric card', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    render(<AIUsage />)
    await waitFor(() => {
      expect(screen.getByText('Total Cost')).toBeInTheDocument()
    })
  })

  it('displays API requests metric card', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    render(<AIUsage />)
    await waitFor(() => {
      expect(screen.getByText('API Requests')).toBeInTheDocument()
    })
  })

  it('displays active tenants metric card', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    render(<AIUsage />)
    await waitFor(() => {
      expect(screen.getByText('Active Tenants')).toBeInTheDocument()
    })
  })

  it('renders the top tenants table heading', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    render(<AIUsage />)
    await waitFor(() => {
      expect(screen.getByText('Top Tenants by AI Usage')).toBeInTheDocument()
    })
  })

  it('shows tenant name in the top tenants table', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    render(<AIUsage />)
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })
  })

  it('shows TechHub Nigeria in the top tenants table', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    render(<AIUsage />)
    await waitFor(() => {
      expect(screen.getByText('TechHub Nigeria')).toBeInTheDocument()
    })
  })

  it('renders the model breakdown section', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    render(<AIUsage />)
    await waitFor(() => {
      expect(screen.getByText('Model Breakdown')).toBeInTheDocument()
    })
  })

  it('renders the token consumption chart section', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    render(<AIUsage />)
    await waitFor(() => {
      expect(screen.getByText('Token Consumption Over Time')).toBeInTheDocument()
    })
  })

  it('renders the daily cost chart section', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    render(<AIUsage />)
    await waitFor(() => {
      expect(screen.getByText('Daily Cost (USD)')).toBeInTheDocument()
    })
  })

  it('falls back to mock data when API returns non-success', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: false, error: 'Unauthorized' })
    render(<AIUsage />)
    // Component should still render the page heading even when using mock data
    await waitFor(() => {
      expect(screen.getByText('AI Usage Dashboard')).toBeInTheDocument()
    })
  })

  it('falls back to mock data when API throws an error', async () => {
    vi.mocked(apiModule.apiClient.get).mockRejectedValue(new Error('Network error'))
    render(<AIUsage />)
    await waitFor(() => {
      // Should render with mock fallback, not crash
      expect(screen.getByText('AI Usage Dashboard')).toBeInTheDocument()
    })
  })

  it('renders a period selector dropdown', () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    render(<AIUsage />)
    // The Select trigger shows the current period
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('re-fetches data when period changes to 7d', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    const user = userEvent.setup()
    render(<AIUsage />)
    // Initial fetch happens on mount
    await waitFor(() => {
      expect(apiModule.apiClient.get).toHaveBeenCalledWith('/ai/usage?period=30d')
    })
    // Open the select and choose 7d
    await user.click(screen.getByRole('combobox'))
    const option = await screen.findByText('Last 7 days')
    await user.click(option)
    await waitFor(() => {
      expect(apiModule.apiClient.get).toHaveBeenCalledWith('/ai/usage?period=7d')
    })
  })

  it('displays the "No usage data" message when records are empty', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({
      success: true,
      data: { ...mockSummary, records: [], daily_trend: [] },
    })
    render(<AIUsage />)
    await waitFor(() => {
      expect(screen.getByText('No usage data for this period')).toBeInTheDocument()
    })
  })

  it('renders recharts components (token area chart)', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    render(<AIUsage />)
    await waitFor(() => {
      expect(screen.getAllByTestId('recharts-stub').length).toBeGreaterThan(0)
    })
  })

  it('calls api with 90d period when selected', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockSummary })
    const user = userEvent.setup()
    render(<AIUsage />)
    await user.click(screen.getByRole('combobox'))
    const option = await screen.findByText('Last 90 days')
    await user.click(option)
    await waitFor(() => {
      expect(apiModule.apiClient.get).toHaveBeenCalledWith('/ai/usage?period=90d')
    })
  })
})
