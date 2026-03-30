/**
 * PartnerManagement Page — Super Admin V2
 * Partner onboarding, suite assignment, commission management
 * Compliance: Nigeria First (kobo), NDPR consent, Mobile First
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Plus, Users, TrendingUp, Shield, Globe } from 'lucide-react'
import { apiClient } from '@/lib/api'

// ============================================================================
// TYPES
// ============================================================================

type PartnerStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CHURNED'
type PartnerTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'
type SuiteName = 'civic' | 'commerce' | 'transport' | 'fintech' | 'realestate' | 'education'

interface Partner {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  status: PartnerStatus
  tier: PartnerTier
  commission_rate_percent: number
  assigned_suites: string
  ndpr_consent: 0 | 1
  monthly_fee_kobo: number
  created_at: string
}

// ============================================================================
// HELPERS
// ============================================================================

function formatKobo(kobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(kobo / 100)
}

function statusBadgeVariant(status: PartnerStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE': return 'default'
    case 'PENDING': return 'secondary'
    case 'SUSPENDED': return 'outline'
    case 'CHURNED': return 'destructive'
  }
}

function tierBadgeColor(tier: PartnerTier): string {
  switch (tier) {
    case 'ENTERPRISE': return 'bg-purple-100 text-purple-800'
    case 'PROFESSIONAL': return 'bg-blue-100 text-blue-800'
    case 'STARTER': return 'bg-gray-100 text-gray-800'
  }
}

const SUITES: SuiteName[] = ['civic', 'commerce', 'transport', 'fintech', 'realestate', 'education']

// ============================================================================
// ONBOARDING FORM
// ============================================================================

interface OnboardingFormProps {
  onSuccess: () => void
}

function OnboardingForm({ onSuccess }: OnboardingFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    tier: 'STARTER' as PartnerTier,
    commission_rate_percent: 10,
    monthly_fee_kobo: 0,
    ndpr_consent: false,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.ndpr_consent) {
      setError('NDPR consent is required (Nigeria Data Protection Regulation)')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.post('/partners', form)
      if (!res.success) throw new Error(res.error || 'Failed to onboard partner')
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to onboard partner')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Partner name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="partner@company.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (Nigeria)</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+2348012345678"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            placeholder="Company Ltd"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tier">Partner Tier</Label>
          <Select
            value={form.tier}
            onValueChange={(v) => setForm({ ...form, tier: v as PartnerTier })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STARTER">Starter</SelectItem>
              <SelectItem value="PROFESSIONAL">Professional</SelectItem>
              <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="commission">Commission Rate (%)</Label>
          <Input
            id="commission"
            type="number"
            min="0"
            max="50"
            step="0.5"
            value={form.commission_rate_percent}
            onChange={(e) => setForm({ ...form, commission_rate_percent: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="fee">Monthly Fee (₦ — enter in Naira)</Label>
          <Input
            id="fee"
            type="number"
            min="0"
            value={form.monthly_fee_kobo / 100}
            onChange={(e) => setForm({ ...form, monthly_fee_kobo: Math.round(Number(e.target.value) * 100) })}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            Stored as kobo: {form.monthly_fee_kobo.toLocaleString()} kobo
          </p>
        </div>
      </div>

      {/* NDPR Consent — Nigeria First invariant */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="ndpr"
            checked={form.ndpr_consent}
            onCheckedChange={(v) => setForm({ ...form, ndpr_consent: Boolean(v) })}
          />
          <div>
            <Label htmlFor="ndpr" className="font-semibold text-amber-900">
              NDPR Consent (Required)
            </Label>
            <p className="text-xs text-amber-800 mt-1">
              I consent to the collection and processing of my personal data in accordance with the
              Nigeria Data Protection Regulation (NDPR) 2019 and WebWaka's Privacy Policy.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? 'Onboarding...' : 'Onboard Partner'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ============================================================================
// SUITE ASSIGNMENT MODAL
// ============================================================================

interface SuiteAssignmentProps {
  partner: Partner
  onSuccess: () => void
}

function SuiteAssignment({ partner, onSuccess }: SuiteAssignmentProps) {
  const [loading, setLoading] = useState(false)
  const activeSuites: SuiteName[] = (() => {
    try { return JSON.parse(partner.assigned_suites) } catch { return [] }
  })()

  async function toggleSuite(suite: SuiteName) {
    const isActive = activeSuites.includes(suite)
    setLoading(true)
    try {
      await apiClient.post(`/partners/${partner.id}/suites`, {
        suite,
        action: isActive ? 'revoke' : 'assign',
      })
      onSuccess()
    } catch (err) {
      console.error('Suite toggle failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Toggle suite access for <strong>{partner.name}</strong>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SUITES.map((suite) => {
          const isActive = activeSuites.includes(suite)
          return (
            <button
              key={suite}
              onClick={() => toggleSuite(suite)}
              disabled={loading}
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-green-300 bg-green-50 text-green-800'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Globe className="h-4 w-4" />
              <span className="capitalize">{suite}</span>
              {isActive && <Badge className="ml-auto text-xs">Active</Badge>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function PartnerManagement() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [filterTier, setFilterTier] = useState<string>('ALL')

  const fetchPartners = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterStatus !== 'ALL') params.set('status', filterStatus)
      if (filterTier !== 'ALL') params.set('tier', filterTier)
      const res = await apiClient.get<{ partners: Partner[] }>(`/partners?${params}`)
      setPartners(res.data?.partners || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load partners')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterTier])

  useEffect(() => { fetchPartners() }, [fetchPartners])

  const stats = {
    total: partners.length,
    active: partners.filter((p) => p.status === 'ACTIVE').length,
    enterprise: partners.filter((p) => p.tier === 'ENTERPRISE').length,
    totalRevenue: partners.reduce((sum, p) => sum + p.monthly_fee_kobo, 0),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partner Management</h1>
          <p className="text-muted-foreground mt-1">
            Onboard partners, assign suite access, manage commissions
          </p>
        </div>
        <Dialog open={showOnboarding} onOpenChange={setShowOnboarding}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Onboard Partner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Onboard New Partner</DialogTitle>
              <DialogDescription>
                Add a new reseller or ISV partner. NDPR consent is required.
              </DialogDescription>
            </DialogHeader>
            <OnboardingForm
              onSuccess={() => {
                setShowOnboarding(false)
                fetchPartners()
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Partners</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats.enterprise}</p>
                <p className="text-xs text-muted-foreground">Enterprise</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Globe className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-lg font-bold">{formatKobo(stats.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Monthly MRR</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader>
          <CardTitle>Partners</CardTitle>
          <CardDescription>Filter and manage all platform partners</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="CHURNED">Churned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterTier} onValueChange={setFilterTier}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Tiers</SelectItem>
                <SelectItem value="STARTER">Starter</SelectItem>
                <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm mb-4">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : partners.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No partners found. Onboard your first partner.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Monthly Fee</TableHead>
                    <TableHead>Suites</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((partner) => {
                    const suites: string[] = (() => {
                      try { return JSON.parse(partner.assigned_suites) } catch { return [] }
                    })()
                    return (
                      <TableRow key={partner.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{partner.name}</p>
                            <p className="text-xs text-muted-foreground">{partner.email}</p>
                            {partner.company && (
                              <p className="text-xs text-muted-foreground">{partner.company}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(partner.status)}>
                            {partner.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${tierBadgeColor(partner.tier)}`}>
                            {partner.tier}
                          </span>
                        </TableCell>
                        <TableCell>{partner.commission_rate_percent}%</TableCell>
                        <TableCell>{formatKobo(partner.monthly_fee_kobo)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {suites.length === 0 ? (
                              <span className="text-xs text-muted-foreground">None</span>
                            ) : (
                              suites.map((s) => (
                                <Badge key={s} variant="outline" className="text-xs capitalize">
                                  {s}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedPartner(partner)}
                              >
                                Assign Suites
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Suite Assignment</DialogTitle>
                                <DialogDescription>
                                  Manage suite access for this partner
                                </DialogDescription>
                              </DialogHeader>
                              {selectedPartner && (
                                <SuiteAssignment
                                  partner={selectedPartner}
                                  onSuccess={fetchPartners}
                                />
                              )}
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
