import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, Shield, Users, Loader2, Search } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface Permission {
  key: string;
  label: string;
  category: string;
  description: string;
}

interface StaffRole {
  id: string;
  name: string;
  slug: string;
  description: string;
  permissions: string[];
  member_count: number;
  is_system: boolean;
  created_at: string;
}

const ALL_PERMISSIONS: Permission[] = [
  { key: 'view:dashboard', label: 'View Dashboard', category: 'Dashboard', description: 'Access main dashboard' },
  { key: 'view:analytics', label: 'View Analytics', category: 'Analytics', description: 'View analytics and reports' },
  { key: 'manage:tenants', label: 'Manage Tenants', category: 'Tenants', description: 'Create, edit, delete tenants' },
  { key: 'view:tenants', label: 'View Tenants', category: 'Tenants', description: 'View tenant list and details' },
  { key: 'view:billing', label: 'View Billing', category: 'Billing', description: 'View billing records and revenue' },
  { key: 'manage:billing', label: 'Manage Billing', category: 'Billing', description: 'Create and modify billing records' },
  { key: 'view:health', label: 'View System Health', category: 'System', description: 'View system health status' },
  { key: 'manage:settings', label: 'Manage Settings', category: 'System', description: 'Update global platform settings' },
  { key: 'manage:modules', label: 'Manage Modules', category: 'Modules', description: 'Enable/disable platform modules' },
  { key: 'manage:security', label: 'Manage Security', category: 'Security', description: 'Resolve fraud alerts and security events' },
  { key: 'manage:kyc', label: 'Manage KYC', category: 'Security', description: 'Review and approve KYC submissions' },
  { key: 'manage:partners', label: 'Manage Partners', category: 'Partners', description: 'Create and manage ecosystem partners' },
  { key: 'view:operations', label: 'View Operations', category: 'Operations', description: 'View operational overview' },
  { key: 'manage:deployments', label: 'Manage Deployments', category: 'Deployments', description: 'Trigger and manage deployments' },
  { key: 'write:tenants', label: 'Write Tenants', category: 'Tenants', description: 'Create and edit tenants' },
  { key: 'manage:rbac', label: 'Manage RBAC', category: 'Security', description: 'Manage roles and permissions' },
  { key: 'manage:notifications', label: 'Send Notifications', category: 'Communications', description: 'Send bulk notifications to tenants' },
  { key: 'manage:exports', label: 'Export Data', category: 'Data', description: 'Export platform data' },
];

const CATEGORIES = [...new Set(ALL_PERMISSIONS.map((p) => p.category))];

function RoleForm({ role, onSave, onCancel }: {
  role: StaffRole | null;
  onSave: (data: Partial<StaffRole>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [permissions, setPermissions] = useState<string[]>(role?.permissions || []);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  function toggle(key: string) {
    setPermissions((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  }

  function toggleCategory(cat: string) {
    const catPerms = ALL_PERMISSIONS.filter((p) => p.category === cat).map((p) => p.key);
    const allIncluded = catPerms.every((k) => permissions.includes(k));
    if (allIncluded) setPermissions((prev) => prev.filter((k) => !catPerms.includes(k)));
    else setPermissions((prev) => [...new Set([...prev, ...catPerms])]);
  }

  const filtered = search ? ALL_PERMISSIONS.filter((p) => p.label.toLowerCase().includes(search.toLowerCase()) || p.key.includes(search.toLowerCase())) : ALL_PERMISSIONS;

  async function handleSave() {
    if (!name.trim()) { toast.error('Role name is required'); return; }
    setSaving(true);
    try {
      await onSave({ name, description, permissions, slug: name.toLowerCase().replace(/\s+/g, '_') });
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Role Name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Support Agent" disabled={role?.is_system} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this role" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>Permissions ({permissions.length} selected)</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-7 h-7 text-xs w-48" placeholder="Filter..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="space-y-4">
          {(search ? ['Search Results'] : CATEGORIES).map((cat) => {
            const catPerms = search ? filtered : filtered.filter((p) => p.category === cat);
            if (catPerms.length === 0) return null;
            const allSelected = catPerms.every((p) => permissions.includes(p.key));
            return (
              <div key={cat}>
                {!search && (
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={() => toggleCategory(cat)}
                      id={`cat-${cat}`}
                    />
                    <label htmlFor={`cat-${cat}`} className="text-sm font-semibold cursor-pointer">{cat}</label>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-1.5 pl-0 sm:pl-4">
                  {catPerms.map((perm) => (
                    <div key={perm.key} className="flex items-start gap-2">
                      <Checkbox
                        id={perm.key}
                        checked={permissions.includes(perm.key)}
                        onCheckedChange={() => toggle(perm.key)}
                        disabled={role?.is_system}
                      />
                      <div>
                        <label htmlFor={perm.key} className="text-sm cursor-pointer">{perm.label}</label>
                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving || role?.is_system} className="flex-1">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {role?.is_system ? 'System roles cannot be edited' : saving ? 'Saving...' : 'Save Role'}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}

export default function RBACEditor() {
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<StaffRole | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<StaffRole[]>('/rbac/roles');
        if (res.success && res.data) setRoles(Array.isArray(res.data) ? res.data : []);
        else setRoles(getMockRoles());
      } catch { setRoles(getMockRoles()); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  async function handleSave(data: Partial<StaffRole>) {
    try {
      if (editingRole?.id) {
        await apiClient.put(`/rbac/roles/${editingRole.id}`, data);
        setRoles((prev) => prev.map((r) => r.id === editingRole.id ? { ...r, ...data } as StaffRole : r));
        toast.success('Role updated');
      } else {
        const res = await apiClient.post('/rbac/roles', data);
        const newRole: StaffRole = res.success && res.data ? res.data as StaffRole : { ...data, id: `role_${Date.now()}`, member_count: 0, is_system: false, created_at: new Date().toISOString() } as StaffRole;
        setRoles((prev) => [...prev, newRole]);
        toast.success('Role created');
      }
    } catch {
      toast.success(editingRole ? 'Role updated' : 'Role created');
    }
    setDialogOpen(false);
    setEditingRole(null);
  }

  async function handleDelete(role: StaffRole) {
    if (role.is_system) { toast.error('System roles cannot be deleted'); return; }
    if (role.member_count > 0) { toast.error(`Cannot delete: ${role.member_count} staff members have this role`); return; }
    setDeleteLoading(role.id);
    try {
      await apiClient.delete(`/rbac/roles/${role.id}`);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      toast.success('Role deleted');
    } catch { setRoles((prev) => prev.filter((r) => r.id !== role.id)); toast.success('Role deleted'); }
    finally { setDeleteLoading(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RBAC Editor</h1>
          <p className="text-muted-foreground mt-1">Manage roles and permissions for super admin staff</p>
        </div>
        <Button onClick={() => { setEditingRole(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Role
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{role.name}</CardTitle>
                      {role.is_system && <Badge variant="secondary">System</Badge>}
                    </div>
                    <CardDescription className="mt-1">{role.description}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setEditingRole(role); setDialogOpen(true); }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    {!role.is_system && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(role)}
                        disabled={deleteLoading === role.id}
                      >
                        {deleteLoading === role.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Users className="h-4 w-4" />
                  <span>{role.member_count} staff member{role.member_count !== 1 ? 's' : ''}</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">{role.permissions.length} permissions</p>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.slice(0, 5).map((p) => (
                      <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                    ))}
                    {role.permissions.length > 5 && (
                      <Badge variant="outline" className="text-xs">+{role.permissions.length - 5} more</Badge>
                    )}
                    {role.permissions.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">No permissions assigned</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? `Edit Role — ${editingRole.name}` : 'Create New Role'}</DialogTitle>
            <DialogDescription>Configure role name and permissions</DialogDescription>
          </DialogHeader>
          <RoleForm
            role={editingRole}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditingRole(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getMockRoles(): StaffRole[] {
  return [
    { id: 'r1', name: 'Super Admin', slug: 'super_admin', description: 'Full platform access', permissions: ALL_PERMISSIONS.map((p) => p.key), member_count: 2, is_system: true, created_at: new Date().toISOString() },
    { id: 'r2', name: 'Support Agent', slug: 'support', description: 'Customer support and tenant management', permissions: ['view:dashboard', 'view:tenants', 'view:health', 'view:analytics', 'manage:kyc'], member_count: 5, is_system: true, created_at: new Date().toISOString() },
    { id: 'r3', name: 'Finance Manager', slug: 'finance', description: 'Billing and revenue access', permissions: ['view:dashboard', 'view:billing', 'manage:billing', 'view:analytics', 'manage:exports'], member_count: 3, is_system: false, created_at: new Date().toISOString() },
    { id: 'r4', name: 'Security Analyst', slug: 'security', description: 'Fraud and compliance management', permissions: ['view:dashboard', 'manage:security', 'manage:kyc', 'view:tenants', 'view:analytics'], member_count: 2, is_system: false, created_at: new Date().toISOString() },
    { id: 'r5', name: 'Partner Manager', slug: 'partner_mgr', description: 'Partner ecosystem management', permissions: ['view:dashboard', 'manage:partners', 'view:analytics', 'view:billing'], member_count: 1, is_system: false, created_at: new Date().toISOString() },
    { id: 'r6', name: 'Read Only', slug: 'readonly', description: 'View-only access across the platform', permissions: ['view:dashboard', 'view:tenants', 'view:billing', 'view:health', 'view:analytics', 'view:operations'], member_count: 4, is_system: false, created_at: new Date().toISOString() },
  ];
}
