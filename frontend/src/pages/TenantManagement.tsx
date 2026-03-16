import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Tenant {
  id: string;
  name: string;
  email: string;
  industry: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  plan: 'starter' | 'professional' | 'enterprise';
  users: number;
  revenue: number;
}

export default function TenantManagement() {
  const { hasPermission } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    industry: string;
    plan: 'starter' | 'professional' | 'enterprise';
  }>({
    name: '',
    email: '',
    industry: '',
    plan: 'starter',
  });

  // Mock data - in production, this would come from an API
  useEffect(() => {
    const mockTenants: Tenant[] = [
      {
        id: '1',
        name: 'TechCorp Nigeria',
        email: 'admin@techcorp.ng',
        industry: 'Technology',
        status: 'active',
        createdAt: '2026-01-15',
        plan: 'enterprise',
        users: 45,
        revenue: 125000,
      },
      {
        id: '2',
        name: 'RetailHub Lagos',
        email: 'info@retailhub.ng',
        industry: 'Retail',
        status: 'active',
        createdAt: '2026-02-01',
        plan: 'professional',
        users: 12,
        revenue: 45000,
      },
      {
        id: '3',
        name: 'TransportGo',
        email: 'support@transportgo.ng',
        industry: 'Transportation',
        status: 'active',
        createdAt: '2026-02-10',
        plan: 'professional',
        users: 28,
        revenue: 78000,
      },
    ];
    setTenants(mockTenants);
    setFilteredTenants(mockTenants);
  }, []);

  // Filter tenants based on search
  useEffect(() => {
    const filtered = tenants.filter(
      (tenant) =>
        tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.industry.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTenants(filtered);
  }, [searchTerm, tenants]);

  const handleAddTenant = () => {
    setEditingTenant(null);
    setFormData({ name: '', email: '', industry: '', plan: 'starter' as const });
    setIsDialogOpen(true);
  };

  const handleEditTenant = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormData({
      name: tenant.name,
      email: tenant.email,
      industry: tenant.industry,
      plan: tenant.plan as 'starter' | 'professional' | 'enterprise',
    });
    setIsDialogOpen(true);
  };

  const handleSaveTenant = () => {
    if (!formData.name || !formData.email || !formData.industry) {
      toast.error('Please fill in all fields');
      return;
    }

    if (editingTenant) {
      // Update existing tenant
      setTenants(
        tenants.map((t) =>
          t.id === editingTenant.id
            ? {
                ...t,
                name: formData.name,
                email: formData.email,
                industry: formData.industry,
                plan: formData.plan,
              }
            : t
        )
      );
      toast.success('Tenant updated successfully');
    } else {
      // Add new tenant
      const newTenant: Tenant = {
        id: Date.now().toString(),
        name: formData.name,
        email: formData.email,
        industry: formData.industry,
        plan: formData.plan,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0],
        users: 1,
        revenue: 0,
      };
      setTenants([...tenants, newTenant]);
      toast.success('Tenant created successfully');
    }

    setIsDialogOpen(false);
  };

  const handleDeleteTenant = (id: string) => {
    if (confirm('Are you sure you want to delete this tenant?')) {
      setTenants(tenants.filter((t) => t.id !== id));
      toast.success('Tenant deleted successfully');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'starter':
        return 'bg-blue-100 text-blue-800';
      case 'professional':
        return 'bg-purple-100 text-purple-800';
      case 'enterprise':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!hasPermission('manage:tenants')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">You don't have permission to manage tenants</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tenant Management</h1>
          <p className="text-gray-400 mt-1">Manage and provision tenants across the platform</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddTenant} className="gap-2">
              <Plus size={20} />
              Add Tenant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTenant ? 'Edit Tenant' : 'Create New Tenant'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tenant Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., TechCorp Nigeria"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Industry</label>
                <Select value={formData.industry} onValueChange={(value) => setFormData({ ...formData, industry: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Transportation">Transportation</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Education">Education</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Plan</label>
                <Select value={formData.plan} onValueChange={(value) => setFormData({ ...formData, plan: value as 'starter' | 'professional' | 'enterprise' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTenant}>Save Tenant</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <Input
          placeholder="Search tenants by name, email, or industry..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tenants Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 border-b border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Tenant Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Industry</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Plan</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Users</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Revenue</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Created</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                    No tenants found
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-gray-700 hover:bg-gray-800/50 transition">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-sm text-gray-400">{tenant.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">{tenant.industry}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getPlanColor(tenant.plan)}`}>
                        {tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(tenant.status)}`}>
                        {tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">{tenant.users}</td>
                    <td className="px-6 py-4 text-sm font-medium">₦{tenant.revenue.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{tenant.createdAt}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditTenant(tenant)}
                          className="p-2 hover:bg-gray-700 rounded transition"
                          title="Edit"
                        >
                          <Edit2 size={16} className="text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteTenant(tenant.id)}
                          className="p-2 hover:bg-gray-700 rounded transition"
                          title="Delete"
                        >
                          <Trash2 size={16} className="text-red-400" />
                        </button>
                        <button className="p-2 hover:bg-gray-700 rounded transition" title="View Details">
                          <ChevronRight size={16} className="text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-gray-400 text-sm">Total Tenants</p>
          <p className="text-2xl font-bold mt-2">{tenants.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-gray-400 text-sm">Active Tenants</p>
          <p className="text-2xl font-bold mt-2 text-green-400">{tenants.filter((t) => t.status === 'active').length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-gray-400 text-sm">Total Users</p>
          <p className="text-2xl font-bold mt-2">{tenants.reduce((sum, t) => sum + t.users, 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-gray-400 text-sm">Total Revenue</p>
          <p className="text-2xl font-bold mt-2 text-blue-400">
            ₦{tenants.reduce((sum, t) => sum + t.revenue, 0).toLocaleString()}
          </p>
        </Card>
      </div>
    </div>
  );
}
