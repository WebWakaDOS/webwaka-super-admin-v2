import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Search, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import { apiClient } from '@/lib/api-client'
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

export default function TenantManagement() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null)

  // Fetch tenants from D1
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await apiClient.get('/tenants')
        if (!response.success) {
          throw new Error('Failed to fetch tenants')
        }

        const tenantsData = response.data || []
        setTenants(tenantsData)
        setFilteredTenants(tenantsData)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tenants'
        setError(errorMessage)
        toast.error(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchTenants()
  }, [])

  // Filter tenants based on search
  useEffect(() => {
    const filtered = tenants.filter(
      (tenant) =>
        tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredTenants(filtered)
  }, [searchTerm, tenants])

  const handleCreateTenant = () => {
    setEditingTenant(null)
    setFormError(null)
    setIsFormOpen(true)
  }

  const handleEditTenant = (tenant: Tenant) => {
    setEditingTenant(tenant)
    setFormError(null)
    setIsFormOpen(true)
  }

  const handleSubmitForm = async (formData: TenantFormData) => {
    try {
      setIsSubmitting(true)
      setFormError(null)

      if (editingTenant) {
        // Update existing tenant
        const response = await apiClient.put(`/tenants/${editingTenant.id}`, {
          name: formData.name,
          email: formData.email,
          status: formData.status,
          plan: formData.plan,
        })

        if (!response.success) {
          throw new Error('Failed to update tenant')
        }

        setTenants(
          tenants.map((t) =>
            t.id === editingTenant.id
              ? {
                  ...t,
                  name: formData.name,
                  email: formData.email,
                  status: formData.status,
                  plan: formData.plan,
                }
              : t
          )
        )

        toast.success('Tenant updated successfully')
      } else {
        // Create new tenant
        const response = await apiClient.post('/tenants', {
          name: formData.name,
          email: formData.email,
          status: formData.status,
          plan: formData.plan,
        })

        if (!response.success) {
          throw new Error('Failed to create tenant')
        }

        const newTenant = response.data
        setTenants([...tenants, newTenant])
        toast.success('Tenant created successfully')
      }

      setIsFormOpen(false)
      setEditingTenant(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setFormError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return

    try {
      setIsSubmitting(true)

      const response = await apiClient.delete(`/tenants/${tenantToDelete.id}`)
      if (!response.success) {
        throw new Error('Failed to delete tenant')
      }

      setTenants(tenants.filter((t) => t.id !== tenantToDelete.id))
      toast.success('Tenant deleted successfully')
      setDeleteConfirmOpen(false)
      setTenantToDelete(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete tenant'
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (error && tenants.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenant Management</h1>
          <p className="text-muted-foreground mt-2">Manage your platform tenants and their configurations.</p>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenant Management</h1>
          <p className="text-muted-foreground mt-2">Manage your platform tenants and their configurations.</p>
        </div>
        <Button onClick={handleCreateTenant} disabled={loading}>
          <Plus className="mr-2 h-4 w-4" />
          New Tenant
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          disabled={loading}
        />
      </div>

      {/* Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tenants</CardTitle>
          <CardDescription>A list of all platform tenants and their status.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : filteredTenants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Email</th>
                    <th className="text-left py-3 px-4 font-semibold">Plan</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 font-semibold">Created</th>
                    <th className="text-right py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{tenant.name}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{tenant.email}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {tenant.plan}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                            tenant.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : tenant.status === 'suspended'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {tenant.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(tenant.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTenant(tenant)}
                            disabled={isSubmitting}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTenantToDelete(tenant)
                              setDeleteConfirmOpen(true)
                            }}
                            disabled={isSubmitting}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No tenants found.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tenant Form Dialog */}
      <TenantForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmitForm}
        initialData={
          editingTenant
            ? {
                id: editingTenant.id,
                name: editingTenant.name,
                email: editingTenant.email,
                status: editingTenant.status,
                plan: editingTenant.plan,
              }
            : undefined
        }
        isLoading={isSubmitting}
        error={formError}
      />

      {/* Delete Confirmation Dialog */}
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
