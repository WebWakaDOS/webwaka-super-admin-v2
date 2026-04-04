import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingWizard from '@/pages/OnboardingWizard'
import * as apiModule from '@/lib/api'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  apiClient: {
    post: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'admin@webwaka.com', name: 'Admin', role: 'super_admin', permissions: ['manage:tenants'] },
    hasPermission: (p: string) => p === 'manage:tenants',
    hasRole: (r: string) => r === 'super_admin',
  }),
}))

// Mock wouter navigation
vi.mock('wouter', () => ({
  useLocation: () => ['/', vi.fn()],
}))

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Automated Onboarding Wizard (QA-SUP-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Rendering ────────────────────────────────────────────────────────────

  it('renders the page heading', () => {
    render(<OnboardingWizard />)
    expect(screen.getByText('Automated Onboarding Wizard')).toBeInTheDocument()
  })

  it('renders 4 step indicators', () => {
    render(<OnboardingWizard />)
    // Each step title appears in the step indicator row AND in the active card header (Business Info is on step 1)
    expect(screen.getAllByText('Business Info').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Vertical Suites')).toBeInTheDocument()
    expect(screen.getByText('Subscription')).toBeInTheDocument()
    expect(screen.getByText('Domain & Config')).toBeInTheDocument()
  })

  it('starts on step 1 — Business Info', () => {
    render(<OnboardingWizard />)
    expect(screen.getByLabelText(/Business Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Business Email/i)).toBeInTheDocument()
  })

  it('shows Back button disabled on first step', () => {
    render(<OnboardingWizard />)
    const backBtn = screen.getByRole('button', { name: /back/i })
    expect(backBtn).toBeDisabled()
  })

  it('shows Next button on first step', () => {
    render(<OnboardingWizard />)
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
  })

  // ── Step 1 — Validation ──────────────────────────────────────────────────

  it('shows validation error if Next is clicked without a business name', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByText('Business name is required')).toBeInTheDocument()
    })
  })

  it('shows validation error if email is missing on step 1', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    await user.type(screen.getByLabelText(/Business Name/i), 'Acme Corp')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument()
    })
  })

  // ── Step Navigation ──────────────────────────────────────────────────────

  it('advances to step 2 when step 1 is valid', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    await user.type(screen.getByLabelText(/Business Name/i), 'Acme Corp')
    await user.type(screen.getByLabelText(/Business Email/i), 'admin@acmecorp.ng')
    // Select industry using combobox
    const industryTrigger = screen.getByRole('combobox')
    await user.click(industryTrigger)
    const retailOption = await screen.findByText('Retail')
    await user.click(retailOption)
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByText(/Select active modules/i)).toBeInTheDocument()
    })
  })

  it('can go back from step 2 to step 1', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    // Fill step 1
    await user.type(screen.getByLabelText(/Business Name/i), 'Acme Corp')
    await user.type(screen.getByLabelText(/Business Email/i), 'admin@acmecorp.ng')
    const industryTrigger = screen.getByRole('combobox')
    await user.click(industryTrigger)
    await user.click(await screen.findByText('Retail'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    // Now on step 2
    await waitFor(() => screen.getByText(/Select active modules/i))
    // Go back
    await user.click(screen.getByRole('button', { name: /back/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/Business Name/i)).toBeInTheDocument()
    })
  })

  // ── Step 2 — Verticals ───────────────────────────────────────────────────

  it('shows toast error if no verticals are selected on step 2', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    // Fill and advance step 1
    await user.type(screen.getByLabelText(/Business Name/i), 'Acme Corp')
    await user.type(screen.getByLabelText(/Business Email/i), 'admin@acmecorp.ng')
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('Finance'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByText(/Select active modules/i))
    // Try to advance without selecting
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please select at least one vertical suite')
    })
  })

  it('toggles a vertical when its card is clicked', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    // Advance to step 2
    await user.type(screen.getByLabelText(/Business Name/i), 'Acme')
    await user.type(screen.getByLabelText(/Business Email/i), 'a@b.com')
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('Retail'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByText('Commerce'))
    // Click Commerce card
    await user.click(screen.getByText('Commerce'))
    // Badge should appear
    await waitFor(() => {
      expect(screen.getByText('commerce')).toBeInTheDocument()
    })
  })

  // ── Step 3 — Plan ────────────────────────────────────────────────────────

  it('shows plan cards on step 3', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    // Step 1
    await user.type(screen.getByLabelText(/Business Name/i), 'Acme')
    await user.type(screen.getByLabelText(/Business Email/i), 'a@b.com')
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('Retail'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    // Step 2
    await waitFor(() => screen.getByText('Commerce'))
    await user.click(screen.getByText('Commerce'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    // Step 3
    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeInTheDocument()
      expect(screen.getByText('Professional')).toBeInTheDocument()
      expect(screen.getByText('Enterprise')).toBeInTheDocument()
    })
  })

  // ── Step 4 — Submission ──────────────────────────────────────────────────

  async function advanceToStep4(user: ReturnType<typeof userEvent.setup>) {
    // Step 1
    await user.type(screen.getByLabelText(/Business Name/i), 'Acme Corp')
    await user.type(screen.getByLabelText(/Business Email/i), 'admin@acmecorp.ng')
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('Retail'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    // Step 2
    await waitFor(() => screen.getByText('Commerce'))
    await user.click(screen.getByText('Commerce'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    // Step 3
    await waitFor(() => screen.getByText('Starter'))
    await user.click(screen.getByText('Starter'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    // Now on step 4
    await waitFor(() => screen.getByText(/Provisioning Summary/i))
  }

  it('shows Provision Tenant button on final step', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    await advanceToStep4(user)
    expect(screen.getByRole('button', { name: /Provision Tenant/i })).toBeInTheDocument()
  })

  it('calls the provision API with form data on submit', async () => {
    vi.mocked(apiModule.apiClient.post).mockResolvedValue({ success: true, data: { id: 'new_t1' } })
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    await advanceToStep4(user)
    await user.click(screen.getByRole('button', { name: /Provision Tenant/i }))
    await waitFor(() => {
      expect(apiModule.apiClient.post).toHaveBeenCalledWith(
        '/tenants/provision',
        expect.objectContaining({
          name: 'Acme Corp',
          email: 'admin@acmecorp.ng',
          plan: 'starter',
          verticals: ['commerce'],
        })
      )
    })
  })

  it('shows success screen after successful provisioning', async () => {
    vi.mocked(apiModule.apiClient.post).mockResolvedValue({ success: true, data: { id: 'new_t1' } })
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    await advanceToStep4(user)
    await user.click(screen.getByRole('button', { name: /Provision Tenant/i }))
    await waitFor(() => {
      expect(screen.getByText('Tenant Provisioned!')).toBeInTheDocument()
    })
  })

  it('shows tenant name in success screen', async () => {
    vi.mocked(apiModule.apiClient.post).mockResolvedValue({ success: true, data: { id: 'new_t1' } })
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    await advanceToStep4(user)
    await user.click(screen.getByRole('button', { name: /Provision Tenant/i }))
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })
  })

  it('shows success even when API throws (graceful degradation)', async () => {
    vi.mocked(apiModule.apiClient.post).mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    await advanceToStep4(user)
    await user.click(screen.getByRole('button', { name: /Provision Tenant/i }))
    await waitFor(() => {
      // Should fall back and show success
      expect(screen.getByText('Tenant Provisioned!')).toBeInTheDocument()
    })
  })

  it('Onboard Another resets the wizard to step 1', async () => {
    vi.mocked(apiModule.apiClient.post).mockResolvedValue({ success: true, data: { id: 'new_t1' } })
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    await advanceToStep4(user)
    await user.click(screen.getByRole('button', { name: /Provision Tenant/i }))
    await waitFor(() => screen.getByText('Tenant Provisioned!'))
    await user.click(screen.getByRole('button', { name: /Onboard Another/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/Business Name/i)).toBeInTheDocument()
    })
  })
})
