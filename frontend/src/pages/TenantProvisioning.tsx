/**
 * TenantProvisioning Page — Super Admin V2
 * 4-step wizard: Basic Info → Suite Selection → Billing Plan → Success
 * Nigeria First: kobo amounts, NDPR awareness, mobile-first layout
 */

import { useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'
import { toast } from 'sonner'
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Briefcase,
  Zap,
  Crown,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

type Suite = 'civic' | 'commerce' | 'transport'
type Plan = 'starter' | 'professional' | 'enterprise'

interface StepBasicInfo {
  name: string
  email: string
  industry: string
}

interface WizardState {
  basic: StepBasicInfo
  suites: Suite[]
  plan: Plan
  tenantId: string | null
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SUITES: { id: Suite; label: string; description: string; color: string }[] = [
  { id: 'civic', label: 'Civic Suite', description: 'Government & public services digitisation', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'commerce', label: 'Commerce Suite', description: 'E-commerce, payments & retail management', color: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'transport', label: 'Transport Suite', description: 'Logistics, fleet & mobility solutions', color: 'bg-amber-100 text-amber-800 border-amber-200' },
]

const PLANS: { id: Plan; label: string; price_kobo: number; features: string[]; icon: typeof Briefcase }[] = [
  {
    id: 'starter',
    label: 'Starter',
    price_kobo: 5000000,
    features: ['Up to 100 users', '5 GB storage', 'Email support', 'Basic analytics'],
    icon: Briefcase,
  },
  {
    id: 'professional',
    label: 'Professional',
    price_kobo: 15000000,
    features: ['Up to 1,000 users', '50 GB storage', 'Priority support', 'Advanced analytics', 'API access'],
    icon: Zap,
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    price_kobo: 50000000,
    features: ['Unlimited users', 'Unlimited storage', 'Dedicated support', 'Custom analytics', 'Full API access', 'SLA guarantee'],
    icon: Crown,
  },
]

const INDUSTRIES = [
  'Agriculture', 'Education', 'Finance & Banking', 'Government',
  'Healthcare', 'Logistics', 'Manufacturing', 'Retail',
  'Technology', 'Telecommunications', 'Other',
]

const STEP_LABELS = ['Basic Info', 'Suite Selection', 'Billing Plan', 'Review & Create']

// ============================================================================
// STEP COMPONENTS
// ============================================================================

function StepBasic({ data, onChange }: { data: StepBasicInfo; onChange: (d: StepBasicInfo) => void }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="tenant-name">Organisation Name <span className="text-red-500">*</span></Label>
        <Input
          id="tenant-name"
          placeholder="e.g. Lagos State Ministry of Finance"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tenant-email">Contact Email <span className="text-red-500">*</span></Label>
        <Input
          id="tenant-email"
          type="email"
          placeholder="admin@organisation.gov.ng"
          value={data.email}
          onChange={(e) => onChange({ ...data, email: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tenant-industry">Industry <span className="text-red-500">*</span></Label>
        <select
          id="tenant-industry"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={data.industry}
          onChange={(e) => onChange({ ...data, industry: e.target.value })}
        >
          <option value="">Select industry…</option>
          {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
    </div>
  )
}

function StepSuites({ selected, onChange }: { selected: Suite[]; onChange: (s: Suite[]) => void }) {
  const toggle = (id: Suite) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Select one or more suites to enable for this tenant.</p>
      {SUITES.map((suite) => {
        const active = selected.includes(suite.id)
        return (
          <button
            key={suite.id}
            type="button"
            onClick={() => toggle(suite.id)}
            className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
              active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{suite.label}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{suite.description}</div>
              </div>
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-4 ${
                active ? 'border-primary bg-primary' : 'border-muted-foreground'
              }`}>
                {active && <CheckCircle2 className="h-3 w-3 text-white" />}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function StepPlan({ selected, onChange }: { selected: Plan; onChange: (p: Plan) => void }) {
  return (
    <div className="space-y-4">
      {PLANS.map((plan) => {
        const Icon = plan.icon
        const active = selected === plan.id
        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onChange(plan.id)}
            className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
              active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`rounded-lg p-2 shrink-0 ${active ? 'bg-primary text-white' : 'bg-muted'}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">{plan.label}</span>
                  <span className="text-sm font-mono font-bold text-primary">
                    ₦{(plan.price_kobo / 100).toLocaleString('en-NG')}/mo
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {plan.features.map((f) => (
                    <li key={f} className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function StepReview({ state }: { state: WizardState }) {
  const planObj = PLANS.find((p) => p.id === state.plan)!
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="font-semibold">Organisation Details</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Name</span>
          <span className="font-medium">{state.basic.name}</span>
          <span className="text-muted-foreground">Email</span>
          <span className="font-medium">{state.basic.email}</span>
          <span className="text-muted-foreground">Industry</span>
          <span className="font-medium">{state.basic.industry}</span>
        </div>
      </div>
      <div className="rounded-lg border p-4 space-y-2">
        <span className="font-semibold text-sm">Enabled Suites</span>
        <div className="flex flex-wrap gap-2 mt-1">
          {state.suites.map((s) => (
            <Badge key={s} variant="secondary" className="capitalize">{s}</Badge>
          ))}
        </div>
      </div>
      <div className="rounded-lg border p-4 space-y-2">
        <span className="font-semibold text-sm">Billing Plan</span>
        <div className="flex items-center justify-between mt-1">
          <span className="capitalize font-medium">{planObj.label}</span>
          <span className="font-mono font-bold text-primary">
            ₦{(planObj.price_kobo / 100).toLocaleString('en-NG')}/month
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SUCCESS STATE
// ============================================================================

function SuccessView({ tenantId, name, onDone }: { tenantId: string; name: string; onDone: () => void }) {
  return (
    <div className="text-center space-y-6 py-6">
      <div className="flex justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-green-100 rounded-full animate-pulse" />
          <CheckCircle2 className="relative h-16 w-16 text-green-500" />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-green-700">Tenant Created!</h2>
        <p className="text-muted-foreground mt-1">{name} is now provisioned on WebWaka.</p>
      </div>
      <div className="rounded-lg bg-muted p-4 text-left space-y-1">
        <p className="text-xs text-muted-foreground font-mono">Tenant ID</p>
        <p className="font-mono text-sm font-bold break-all">{tenantId}</p>
      </div>
      <Button onClick={onDone} className="w-full">
        Go to Tenant Management
      </Button>
    </div>
  )
}

// ============================================================================
// MAIN WIZARD
// ============================================================================

export default function TenantProvisioning() {
  useTranslation()
  const [, navigate] = useLocation()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [state, setState] = useState<WizardState>({
    basic: { name: '', email: '', industry: '' },
    suites: [],
    plan: 'starter',
    tenantId: null,
  })

  const canProceed = () => {
    if (step === 0) return state.basic.name.trim() && state.basic.email.trim() && state.basic.industry
    if (step === 1) return state.suites.length > 0
    if (step === 2) return !!state.plan
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await apiClient.post('/tenants', {
        name: state.basic.name.trim(),
        email: state.basic.email.trim(),
        industry: state.basic.industry,
        plan: state.plan,
        suites: state.suites,
        status: 'provisioning',
      })
      if (!res.success) throw new Error(res.error || 'Failed to create tenant')
      const tenantId = (res.data as any)?.id || (res.data as any)?.tenantId || 'new-tenant'
      setState((s) => ({ ...s, tenantId }))
      setStep(4)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create tenant')
    } finally {
      setSubmitting(false)
    }
  }

  const next = () => {
    if (step === 3) handleSubmit()
    else setStep((s) => s + 1)
  }

  if (step === 4 && state.tenantId) {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-6 px-4" role="main">
        <SuccessView
          tenantId={state.tenantId}
          name={state.basic.name}
          onDone={() => navigate('/tenants')}
        />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6 px-4" role="main">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Provision New Tenant</h1>
        <p className="text-muted-foreground mt-1">Set up a new organisation on the WebWaka platform</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
              i < step ? 'bg-primary text-white' : i === step ? 'bg-primary text-white ring-2 ring-primary ring-offset-2' : 'bg-muted text-muted-foreground'
            }`}>
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === step ? 'font-semibold' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <div className={`h-0.5 flex-1 transition-colors ${i < step ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{STEP_LABELS[step]}</CardTitle>
          <CardDescription>
            {step === 0 && 'Enter the tenant organisation details'}
            {step === 1 && 'Choose which product suites to enable'}
            {step === 2 && 'Select the billing plan for this tenant'}
            {step === 3 && 'Review and confirm tenant configuration'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <StepBasic
              data={state.basic}
              onChange={(basic) => setState((s) => ({ ...s, basic }))}
            />
          )}
          {step === 1 && (
            <StepSuites
              selected={state.suites}
              onChange={(suites) => setState((s) => ({ ...s, suites }))}
            />
          )}
          {step === 2 && (
            <StepPlan
              selected={state.plan}
              onChange={(plan) => setState((s) => ({ ...s, plan }))}
            />
          )}
          {step === 3 && <StepReview state={state} />}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => (step === 0 ? navigate('/tenants') : setStep((s) => s - 1))}
          disabled={submitting}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Button onClick={next} disabled={!canProceed() || submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {step === 3 ? 'Create Tenant' : 'Next'}
          {!submitting && step < 3 && <ChevronRight className="h-4 w-4 ml-1" />}
        </Button>
      </div>
    </div>
  )
}
