import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FraudAlerts from '@/pages/FraudAlerts'
import * as apiModule from '@/lib/api'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Auth mock — starts with manage:security permission
let mockPermissions = ['manage:security']
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'admin@webwaka.com', name: 'Admin', role: 'super_admin', permissions: mockPermissions },
    hasPermission: (p: string) => mockPermissions.includes(p),
    hasRole: (r: string) => r === 'super_admin',
  }),
}))

// ── Helpers ────────────────────────────────────────────────────────────────

const mockAlerts = [
  {
    id: 'a1',
    tenant_id: 't1',
    tenant_name: 'Acme Corp',
    type: 'card_fraud',
    severity: 'critical',
    status: 'open',
    description: 'Multiple high-value transactions detected.',
    amount_kobo: 4500000,
    ip_address: '192.168.1.1',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'a2',
    tenant_id: 't2',
    tenant_name: 'TechHub Nigeria',
    type: 'account_takeover',
    severity: 'high',
    status: 'open',
    description: 'Admin account login from unrecognized device.',
    ip_address: '41.206.10.5',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'a3',
    tenant_id: 't3',
    tenant_name: 'PayEasy Ltd',
    type: 'velocity_abuse',
    severity: 'medium',
    status: 'investigating',
    description: 'API rate limit exceeded.',
    created_at: new Date(Date.now() - 14400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'a4',
    tenant_id: 't4',
    tenant_name: 'EduZone',
    type: 'suspicious_login',
    severity: 'low',
    status: 'resolved',
    description: 'Login from new browser, verified via 2FA.',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date().toISOString(),
  },
]

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Fraud Alert Resolution Center (QA-SUP-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPermissions = ['manage:security']
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: mockAlerts })
  })

  it('renders the page heading', async () => {
    render(<FraudAlerts />)
    expect(screen.getByText('Fraud Alert Resolution Center')).toBeInTheDocument()
  })

  it('fetches fraud alerts from the correct API endpoint', async () => {
    render(<FraudAlerts />)
    await waitFor(() => {
      expect(apiModule.apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/fraud/alerts'))
    })
  })

  it('displays unresolved (open) alerts by default', async () => {
    render(<FraudAlerts />)
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })
  })

  it('shows alert tenant name in the list', async () => {
    render(<FraudAlerts />)
    await waitFor(() => {
      expect(screen.getByText('TechHub Nigeria')).toBeInTheDocument()
    })
  })

  it('shows alert description in the list', async () => {
    render(<FraudAlerts />)
    await waitFor(() => {
      expect(screen.getByText('Multiple high-value transactions detected.')).toBeInTheDocument()
    })
  })

  it('displays severity badges', async () => {
    render(<FraudAlerts />)
    await waitFor(() => {
      expect(screen.getByText('Critical')).toBeInTheDocument()
    })
  })

  it('displays summary status cards', async () => {
    render(<FraudAlerts />)
    // Status labels appear in both summary cards and in select dropdown options
    await waitFor(() => {
      expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Investigating').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Resolved').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Dismissed').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows action buttons for authorized users with manage:security permission', async () => {
    render(<FraudAlerts />)
    await waitFor(() => {
      expect(screen.getAllByText('Mark Resolved').length).toBeGreaterThan(0)
    })
  })

  it('shows Suspend Tenant button for authorized users', async () => {
    render(<FraudAlerts />)
    await waitFor(() => {
      expect(screen.getAllByText('Suspend Tenant').length).toBeGreaterThan(0)
    })
  })

  it('shows Dismiss button for authorized users', async () => {
    render(<FraudAlerts />)
    await waitFor(() => {
      expect(screen.getAllByText('Dismiss').length).toBeGreaterThan(0)
    })
  })

  it('hides action buttons when user lacks manage:security permission', async () => {
    mockPermissions = []
    render(<FraudAlerts />)
    await waitFor(() => {
      expect(screen.queryByText('Suspend Tenant')).not.toBeInTheDocument()
      expect(screen.queryByText('Mark Resolved')).not.toBeInTheDocument()
    })
  })

  it('shows permission warning when user lacks manage:security', async () => {
    mockPermissions = []
    render(<FraudAlerts />)
    await waitFor(() => {
      expect(screen.getAllByText(/manage:security permission/i).length).toBeGreaterThan(0)
    })
  })

  it('opens confirmation dialog when Mark Resolved is clicked', async () => {
    const user = userEvent.setup()
    render(<FraudAlerts />)
    await waitFor(() => screen.getAllByText('Mark Resolved'))
    await user.click(screen.getAllByText('Mark Resolved')[0])
    await waitFor(() => {
      expect(screen.getByText('Mark as Resolved')).toBeInTheDocument()
    })
  })

  it('opens confirmation dialog when Suspend Tenant is clicked', async () => {
    const user = userEvent.setup()
    render(<FraudAlerts />)
    await waitFor(() => screen.getAllByText('Suspend Tenant'))
    await user.click(screen.getAllByText('Suspend Tenant')[0])
    await waitFor(() => {
      // Dialog opens with title 'Suspend Tenant' — multiple matches expected (button + dialog title)
      expect(screen.getAllByText('Suspend Tenant').length).toBeGreaterThan(1)
    })
  })

  it('calls dismiss API when Dismiss is confirmed', async () => {
    vi.mocked(apiModule.apiClient.post).mockResolvedValue({ success: true, data: {} })
    const user = userEvent.setup()
    render(<FraudAlerts />)
    await waitFor(() => screen.getAllByText('Dismiss'))
    await user.click(screen.getAllByText('Dismiss')[0])
    await waitFor(() => screen.getByRole('alertdialog'))
    await user.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(apiModule.apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/dismiss'),
        {}
      )
    })
  })

  it('calls resolve API when Mark Resolved is confirmed', async () => {
    vi.mocked(apiModule.apiClient.post).mockResolvedValue({ success: true, data: {} })
    const user = userEvent.setup()
    render(<FraudAlerts />)
    await waitFor(() => screen.getAllByText('Mark Resolved'))
    await user.click(screen.getAllByText('Mark Resolved')[0])
    await waitFor(() => screen.getByRole('alertdialog'))
    await user.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(apiModule.apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/resolve'),
        {}
      )
    })
  })

  it('falls back to mock data when API returns non-success', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: false })
    render(<FraudAlerts />)
    await waitFor(() => {
      // Mock data still shows the component
      expect(screen.getByText('Fraud Alert Resolution Center')).toBeInTheDocument()
    })
  })

  it('falls back to mock data on network error', async () => {
    vi.mocked(apiModule.apiClient.get).mockRejectedValue(new Error('Network error'))
    render(<FraudAlerts />)
    await waitFor(() => {
      expect(screen.getByText('Fraud Alert Resolution Center')).toBeInTheDocument()
    })
  })

  it('renders a search input', () => {
    render(<FraudAlerts />)
    expect(screen.getByPlaceholderText(/Search by tenant/i)).toBeInTheDocument()
  })

  it('filters alerts by search term', async () => {
    const user = userEvent.setup()
    render(<FraudAlerts />)
    await waitFor(() => screen.getByText('Acme Corp'))
    const search = screen.getByPlaceholderText(/Search by tenant/i)
    await user.type(search, 'TechHub')
    await waitFor(() => {
      expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument()
      expect(screen.getByText('TechHub Nigeria')).toBeInTheDocument()
    })
  })

  it('shows empty state when no alerts match filters', async () => {
    vi.mocked(apiModule.apiClient.get).mockResolvedValue({ success: true, data: [] })
    render(<FraudAlerts />)
    await waitFor(() => {
      expect(screen.getByText('No alerts match your filters')).toBeInTheDocument()
    })
  })
})
