import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle, AlertCircle, Package, Zap, Plus } from 'lucide-react';

interface Module {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'active' | 'inactive' | 'beta' | 'deprecated';
  category: string;
  enabledTenants: number;
  totalTenants: number;
  lastUpdated: string;
}

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetAudience: string;
  createdAt: string;
  lastModified: string;
}

const MODULES: Module[] = [
  {
    id: 'com-1',
    name: 'Commerce Core',
    description: 'Core e-commerce functionality with inventory, orders, and payments',
    version: '1.0.0',
    status: 'active',
    category: 'Commerce',
    enabledTenants: 45,
    totalTenants: 50,
    lastUpdated: '2026-03-10',
  },
  {
    id: 'trn-1',
    name: 'Transportation',
    description: 'Ride-hailing, logistics, and fleet management',
    version: '1.2.1',
    status: 'active',
    category: 'Logistics',
    enabledTenants: 28,
    totalTenants: 30,
    lastUpdated: '2026-03-12',
  },
  {
    id: 'fin-1',
    name: 'Fintech Core',
    description: 'Banking, wallets, payments, and compliance',
    version: '2.0.0',
    status: 'beta',
    category: 'Finance',
    enabledTenants: 12,
    totalTenants: 50,
    lastUpdated: '2026-03-14',
  },
  {
    id: 'res-1',
    name: 'Real Estate',
    description: 'Property listings, management, and transactions',
    version: '0.9.5',
    status: 'beta',
    category: 'Real Estate',
    enabledTenants: 8,
    totalTenants: 50,
    lastUpdated: '2026-03-08',
  },
  {
    id: 'edu-1',
    name: 'Education',
    description: 'School management, e-learning, and student tracking',
    version: '1.1.0',
    status: 'active',
    category: 'Education',
    enabledTenants: 35,
    totalTenants: 50,
    lastUpdated: '2026-03-11',
  },
];

const FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: 'ff-001',
    name: 'Advanced Analytics Dashboard',
    description: 'New analytics dashboard with real-time metrics',
    enabled: true,
    rolloutPercentage: 75,
    targetAudience: 'Enterprise tenants',
    createdAt: '2026-02-15',
    lastModified: '2026-03-14',
  },
  {
    id: 'ff-002',
    name: 'AI-Powered Recommendations',
    description: 'Machine learning recommendations for products',
    enabled: true,
    rolloutPercentage: 50,
    targetAudience: 'All tenants',
    createdAt: '2026-03-01',
    lastModified: '2026-03-13',
  },
  {
    id: 'ff-003',
    name: 'Multi-Currency Support',
    description: 'Support for multiple currencies in transactions',
    enabled: false,
    rolloutPercentage: 0,
    targetAudience: 'Africa-based tenants',
    createdAt: '2026-03-05',
    lastModified: '2026-03-14',
  },
  {
    id: 'ff-004',
    name: 'WhatsApp Integration',
    description: 'WhatsApp Business API integration for notifications',
    enabled: true,
    rolloutPercentage: 100,
    targetAudience: 'All tenants',
    createdAt: '2026-01-20',
    lastModified: '2026-03-10',
  },
];

export default function ModuleRegistry() {
  const [searchModule, setSearchModule] = useState('');
  const [searchFlag, setSearchFlag] = useState('');
  const [flags, setFlags] = useState<FeatureFlag[]>(FEATURE_FLAGS);

  const filteredModules = useMemo(() => {
    return MODULES.filter((m) =>
      m.name.toLowerCase().includes(searchModule.toLowerCase()) ||
      m.category.toLowerCase().includes(searchModule.toLowerCase())
    );
  }, [searchModule]);

  const filteredFlags = useMemo(() => {
    return flags.filter((f) =>
      f.name.toLowerCase().includes(searchFlag.toLowerCase()) ||
      f.description.toLowerCase().includes(searchFlag.toLowerCase())
    );
  }, [searchFlag, flags]);

  const toggleFlag = (id: string) => {
    setFlags(flags.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-900/30 text-green-400';
      case 'beta':
        return 'bg-yellow-900/30 text-yellow-400';
      case 'deprecated':
        return 'bg-red-900/30 text-red-400';
      default:
        return 'bg-gray-900/30 text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle size={16} />;
      case 'beta':
        return <AlertCircle size={16} />;
      default:
        return <Package size={16} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Module Registry & Feature Flags</h1>
          <p className="text-gray-400 mt-1">Manage platform modules and feature rollouts</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="modules" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="flags">Feature Flags</TabsTrigger>
        </TabsList>

        {/* Modules Tab */}
        <TabsContent value="modules">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex-1 max-w-md">
                <Input
                  placeholder="Search modules..."
                  value={searchModule}
                  onChange={(e) => setSearchModule(e.target.value)}
                />
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus size={20} />
                    Add Module
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Module</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Module Name</label>
                      <Input placeholder="Enter module name" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Description</label>
                      <Input placeholder="Enter module description" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Category</label>
                      <Input placeholder="Enter category" />
                    </div>
                    <Button className="w-full">Create Module</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredModules.map((module) => (
                <Card key={module.id} className="p-4 border border-gray-700">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <Package size={20} className="text-blue-400" />
                      <div>
                        <h3 className="font-semibold">{module.name}</h3>
                        <p className="text-xs text-gray-500">v{module.version}</p>
                      </div>
                    </div>
                    <Badge className={`${getStatusColor(module.status)}`}>
                      {module.status.charAt(0).toUpperCase() + module.status.slice(1)}
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-400 mb-3">{module.description}</p>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Category:</span>
                      <span>{module.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Enabled Tenants:</span>
                      <span>
                        {module.enabledTenants}/{module.totalTenants}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Last Updated:</span>
                      <span>{module.lastUpdated}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-700 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      Configure
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      Logs
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Feature Flags Tab */}
        <TabsContent value="flags">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex-1 max-w-md">
                <Input
                  placeholder="Search feature flags..."
                  value={searchFlag}
                  onChange={(e) => setSearchFlag(e.target.value)}
                />
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus size={20} />
                    Create Flag
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Feature Flag</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Flag Name</label>
                      <Input placeholder="Enter flag name" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Description</label>
                      <Input placeholder="Enter description" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Rollout Percentage</label>
                      <Input type="number" min="0" max="100" placeholder="0-100" />
                    </div>
                    <Button className="w-full">Create Flag</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {filteredFlags.map((flag) => (
                <Card key={flag.id} className="p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap size={18} className={flag.enabled ? 'text-yellow-400' : 'text-gray-500'} />
                        <h3 className="font-semibold">{flag.name}</h3>
                      </div>
                      <p className="text-sm text-gray-400 mb-3">{flag.description}</p>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Target Audience:</span>
                          <p className="font-medium">{flag.targetAudience}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Rollout:</span>
                          <p className="font-medium">{flag.rolloutPercentage}%</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <p className="font-medium">{flag.createdAt}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Modified:</span>
                          <p className="font-medium">{flag.lastModified}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-2">Status</p>
                        <Switch checked={flag.enabled} onCheckedChange={() => toggleFlag(flag.id)} />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
