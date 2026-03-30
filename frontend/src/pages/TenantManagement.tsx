import { useState, useEffect, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Plus, Edit2, Trash2, Search, AlertCircle, Loader2, Download, Ban, Archive, CheckSquare, Square } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TenantForm, TenantFormData } from '@/components/TenantForm'
import { apiClient } from '@/lib/api'
import { toast } from 'sonner'

interface Tenant {
  id: string
  name: string
  email: string
  status: 'active' | 'suspended' | 'provisioning'
  plan: 'starter' | 'professional' | 'enterprise'
  createdAt: string
  users?: number
  revenue?: number
}

interface ServerPagination {
  page: number
  limit: number
  total: number
}

const PAGE_SIZE = 50
const ROW_HEIGHT = 56

export default function TenantManagement() {
  const { t } = useTranslation()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [serverPage, setServerPage] = useState(1)
  const [pagination, setPagination] = useState<ServerPagination>({ page: 1, limit: PAGE_SIZE, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)

  const fetchTenants = useCallback(async (page: number, search?: string) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      })
      if (search) params.set('search', search)

      const response = await apiClient.get(`/tenants?${params.toString()}`)
      if (!response.success) throw new Error('Failed to fetch tenants')

      const data = response.data as any
      const tenantsData: Tenant[] = data?.tenants || data || []
      const pag: ServerPagination = data?.pagination || { page, limit: PAGE_SIZE, total: tenantsData.length }

      setTenants(tenantsData)
      setPagination(pag)
      setSelectedIds(new Set())
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch tenants'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTenants(1, searchTerm || undefined)
      setServerPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, fetchTenants])

  useEffect(() => {
    fetchTenants(serverPage, searchTerm || undefined)
  }, [serverPage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Virtual scroll via @tanstack/react-virtual
  const rowVirtualizer = useVirtualizer({
    count: tenants.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  // ── Selection helpers ──────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === tenants.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(tenants.map((t) => t.id)))
    }
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────

  const handleBulkSuspend = async () => {
    if (!selectedIds.size) return
    setBulkLoading(true)
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          apiClient.put(`/tenants/${id}`, { status: 'suspended' }).catch(() => null)
        )
      )
      toast.success(`Suspended ${selectedIds.size} tenant(s)`)
      fetchTenants(serverPage, searchTerm || undefined)
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkArchive = async () => {
    if (!selectedIds.size) return
    setBulkLoading(true)
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          apiClient.delete(`/tenants/${id}`).catch(() => null)
        )
      )
      toast.success(`Archived ${selectedIds.size} tenant(s)`)
      fetchTenants(serverPage, searchTerm || undefined)
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkExportCSV = () => {
    const rows = tenants.filter((t) => selectedIds.size === 0 || selectedIds.has(t.id))
    const headers = ['ID', 'Name', 'Email', 'Plan', 'Status', 'Created At']
    const csvRows = [
      headers.join(','),
      ...rows.map((t) =>
        [t.id, `"${t.name}"`, t.email, t.plan, t.status, new Date(t.createdAt).toISOString()].join(',')
      ),
    ]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tenants-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${rows.length} tenant(s) to CSV`)
  }

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  const handleCreateTenant = () => { setEditingTenant(null); setFormError(null); setIsFormOpen(true) }
  const handleEditTenant = (tenant: Tenant) => { setEditingTenant(tenant); setFormError(null); setIsFormOpen(true) }

  const handleSubmitForm = async (formData: TenantFormData) => {
    try {
      setIsSubmitting(true)
      setFormError(null)
      if (editingTenant) {
        const response = await apiClient.put(`/tenants/${editingTenant.id}`, {
          name: formData.name, email: formData.email, status: formData.status, plan: formData.plan,
        })
        if (!response.success) throw new Error('Failed to update tenant')
        setTenants((prev) => prev.map((t) => t.id === editingTenant.id ? { ...t, ...formData } : t))
        toast.success('Tenant updated successfully')
      } else {
        const response = await apiClient.post('/tenants', {
          name: formData.name, email: formData.email, status: formData.status, plan: formData.plan,
        })
        if (!response.success) throw new Error('Failed to create tenant')
        toast.success('Tenant created successfully')
        fetchTenants(1, undefined)
      }
      setIsFormOpen(false)
      setEditingTenant(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred'
      setFormError(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return
    try {
      setIsSubmitting(true)
      const response = await apiClient.delete(`/tenants/${tenantToDelete.id}`)
      if (!response.success) throw new Error('Failed to delete tenant')
      setTenants((prev) => prev.filter((t) => t.id !== tenantToDelete.id))
      toast.success('Tenant deleted successfully')
      setDeleteConfirmOpen(false)
      setTenantToDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete tenant')
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusColor = (status: Tenant['status']) =>
    status === 'active' ? 'bg-green-100 text-green-800'
    : status === 'suspended' ? 'bg-red-100 text-red-800'
    : 'bg-yellow-100 text-yellow-800'

  const totalPages = Math.ceil(pagination.total / PAGE_SIZE)

  if (error && tenants.length === 0) {
    return (
      <div className="space-y-6" role="main">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('tenants.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('tenants.subtitle')}</p>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">Error Loading Tenants</p>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6" role="main">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('tenants.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('tenants.subtitle')}</p>
        </div>
        <Button onClick={handleCreateTenant} disabled={loading}>
          <Plus className="mr-2 h-4 w-4" />
          New Tenant
        </Button>
      </div>

      {/* Search + Bulk Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            <Button variant="outline" size="sm" onClick={handleBulkSuspend} disabled={bulkLoading}>
              <Ban className="h-3.5 w-3.5 mr-1" /> Suspend
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkArchive} disabled={bulkLoading}>
              <Archive className="h-3.5 w-3.5 mr-1" /> Archive
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkExportCSV}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </Button>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={handleBulkExportCSV} className="shrink-0">
          <Download className="h-4 w-4 mr-1" /> Export All
        </Button>
      </div>

      {/* Tenant Table with Virtual Scroll */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tenants</CardTitle>
              <CardDescription>
                {loading ? 'Loading…' : `${pagination.total} total · Page ${pagination.page} of ${Math.max(1, totalPages)}`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-0">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="border-b px-4 py-3">
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No tenants found{searchTerm ? ` matching "${searchTerm}"` : ''}.
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[32px_1fr_1fr_96px_96px_100px_80px] gap-2 border-b px-4 py-2 bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  aria-label="Select all"
                  className="flex items-center"
                >
                  {selectedIds.size === tenants.length && tenants.length > 0
                    ? <CheckSquare className="h-4 w-4 text-primary" />
                    : <Square className="h-4 w-4" />
                  }
                </button>
                <span>Name</span>
                <span>Email</span>
                <span>Plan</span>
                <span>Status</span>
                <span>Created</span>
                <span className="text-right">Actions</span>
              </div>

              {/* Virtualised rows */}
              <div
                ref={parentRef}
                className="overflow-y-auto"
                style={{ height: Math.min(tenants.length * ROW_HEIGHT, 560) }}
              >
                <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const tenant = tenants[virtualRow.index]
                    const isSelected = selectedIds.has(tenant.id)
                    return (
                      <div
                        key={tenant.id}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        className={`absolute inset-x-0 grid grid-cols-[32px_1fr_1fr_96px_96px_100px_80px] gap-2 items-center border-b px-4 transition-colors ${
                          isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                        }`}
                        style={{ top: virtualRow.start, height: ROW_HEIGHT }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSelect(tenant.id)}
                          aria-label={`Select ${tenant.name}`}
                        >
                          {isSelected
                            ? <CheckSquare className="h-4 w-4 text-primary" />
                            : <Square className="h-4 w-4 text-muted-foreground" />
                          }
                        </button>
                        <span className="font-medium text-sm truncate">{tenant.name}</span>
                        <span className="text-xs text-muted-foreground truncate">{tenant.email}</span>
                        <Badge variant="outline" className="text-xs capitalize justify-self-start">
                          {tenant.plan}
                        </Badge>
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${statusColor(tenant.status)}`}>
                          {tenant.status}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(tenant.createdAt).toLocaleDateString()}
                        </span>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditTenant(tenant)} aria-label="Edit">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setTenantToDelete(tenant); setDeleteConfirmOpen(true) }}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Server-side pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    {((serverPage - 1) * PAGE_SIZE) + 1}–{Math.min(serverPage * PAGE_SIZE, pagination.total)} of {pagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setServerPage((p) => Math.max(1, p - 1))}
                      disabled={serverPage === 1 || loading}
                    >
                      Previous
                    </Button>
                    <span className="text-sm tabular-nums">
                      Page {serverPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setServerPage((p) => Math.min(totalPages, p + 1))}
                      disabled={serverPage >= totalPages || loading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Tenant Form Dialog */}
      <TenantForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmitForm}
        initialData={editingTenant ? {
          id: editingTenant.id,
          name: editingTenant.name,
          email: editingTenant.email,
          status: editingTenant.status,
          plan: editingTenant.plan,
        } : undefined}
        isLoading={isSubmitting}
        error={formError}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {tenantToDelete?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTenant} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
