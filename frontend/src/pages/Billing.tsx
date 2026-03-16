import { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LedgerEntry {
  id: string;
  date: string;
  tenant: string;
  type: 'credit' | 'debit' | 'commission' | 'refund';
  amount: number;
  description: string;
  balance: number;
}

interface CommissionData {
  tenant: string;
  revenue: number;
  commission: number;
  rate: number;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function Billing() {
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit' | 'commission' | 'refund'>('all');
  const [searchTenant, setSearchTenant] = useState('');
  const [dateRange, setDateRange] = useState('month');

  // Mock ledger data
  const ledgerData: LedgerEntry[] = [
    { id: '1', date: '2026-03-15', tenant: 'TechCorp Nigeria', type: 'credit', amount: 125000, description: 'Subscription payment', balance: 125000 },
    { id: '2', date: '2026-03-14', tenant: 'RetailHub Lagos', type: 'credit', amount: 45000, description: 'Subscription payment', balance: 170000 },
    { id: '3', date: '2026-03-14', tenant: 'TechCorp Nigeria', type: 'commission', amount: 3750, description: 'Affiliate commission (3%)', balance: 173750 },
    { id: '4', date: '2026-03-13', tenant: 'TransportGo', type: 'credit', amount: 78000, description: 'Subscription payment', balance: 251750 },
    { id: '5', date: '2026-03-12', tenant: 'RetailHub Lagos', type: 'commission', amount: 1350, description: 'Affiliate commission (3%)', balance: 253100 },
    { id: '6', date: '2026-03-11', tenant: 'TechCorp Nigeria', type: 'refund', amount: -5000, description: 'Refund - Service issue', balance: 248100 },
    { id: '7', date: '2026-03-10', tenant: 'TransportGo', type: 'commission', amount: 2340, description: 'Affiliate commission (3%)', balance: 250440 },
  ];

  // Mock commission data
  const commissionData: CommissionData[] = [
    { tenant: 'TechCorp Nigeria', revenue: 125000, commission: 3750, rate: 3 },
    { tenant: 'RetailHub Lagos', revenue: 45000, commission: 1350, rate: 3 },
    { tenant: 'TransportGo', revenue: 78000, commission: 2340, rate: 3 },
  ];

  // Mock revenue trend data
  const revenueTrendData = [
    { month: 'Jan', revenue: 250000, commission: 7500 },
    { month: 'Feb', revenue: 380000, commission: 11400 },
    { month: 'Mar', revenue: 520000, commission: 15600 },
  ];

  // Mock payment distribution
  const paymentDistribution = [
    { name: 'Subscriptions', value: 520000 },
    { name: 'Commissions', value: 15600 },
    { name: 'Refunds', value: -5000 },
  ];

  // Filter ledger
  const filteredLedger = useMemo(() => {
    return ledgerData.filter((entry) => {
      const typeMatch = filterType === 'all' || entry.type === filterType;
      const tenantMatch = entry.tenant.toLowerCase().includes(searchTenant.toLowerCase());
      return typeMatch && tenantMatch;
    });
  }, [filterType, searchTenant]);

  // Calculate totals
  const totals = useMemo(() => {
    return {
      totalRevenue: ledgerData.filter((e) => e.type === 'credit').reduce((sum, e) => sum + e.amount, 0),
      totalCommission: ledgerData.filter((e) => e.type === 'commission').reduce((sum, e) => sum + e.amount, 0),
      totalRefunds: ledgerData.filter((e) => e.type === 'refund').reduce((sum, e) => sum + Math.abs(e.amount), 0),
      currentBalance: ledgerData[0]?.balance || 0,
    };
  }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'credit':
        return 'text-green-400';
      case 'debit':
        return 'text-red-400';
      case 'commission':
        return 'text-blue-400';
      case 'refund':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getTypeBg = (type: string) => {
    switch (type) {
      case 'credit':
        return 'bg-green-900/30';
      case 'debit':
        return 'bg-red-900/30';
      case 'commission':
        return 'bg-blue-900/30';
      case 'refund':
        return 'bg-yellow-900/30';
      default:
        return 'bg-gray-900/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Billing & Ledger</h1>
          <p className="text-gray-400 mt-1">Platform revenue, commissions, and financial tracking</p>
        </div>
        <Button className="gap-2">
          <Download size={20} />
          Export Report
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-gray-400 text-sm">Total Revenue</p>
          <p className="text-2xl font-bold mt-2 text-green-400">₦{totals.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <TrendingUp size={14} /> +12% from last month
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-gray-400 text-sm">Total Commissions</p>
          <p className="text-2xl font-bold mt-2 text-blue-400">₦{totals.totalCommission.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">3% affiliate rate</p>
        </Card>
        <Card className="p-4">
          <p className="text-gray-400 text-sm">Total Refunds</p>
          <p className="text-2xl font-bold mt-2 text-yellow-400">₦{totals.totalRefunds.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">0.96% refund rate</p>
        </Card>
        <Card className="p-4">
          <p className="text-gray-400 text-sm">Current Balance</p>
          <p className="text-2xl font-bold mt-2">₦{totals.currentBalance.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">Net available</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Revenue Trend */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Trend (3 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
              <Line type="monotone" dataKey="commission" stroke="#3b82f6" strokeWidth={2} name="Commission" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Commission by Tenant */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Commission Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={commissionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="tenant" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
              <Legend />
              <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
              <Bar dataKey="commission" fill="#3b82f6" name="Commission" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ledger" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="commissions">Commission Calculator</TabsTrigger>
          <TabsTrigger value="distribution">Payment Distribution</TabsTrigger>
        </TabsList>

        {/* Ledger Tab */}
        <TabsContent value="ledger">
          <Card className="p-6">
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Search Tenant</label>
                <Input
                  placeholder="Search by tenant name..."
                  value={searchTenant}
                  onChange={(e) => setSearchTenant(e.target.value)}
                />
              </div>
              <div className="w-48">
                <label className="block text-sm font-medium mb-2">Filter by Type</label>
                <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Transactions</SelectItem>
                    <SelectItem value="credit">Credits</SelectItem>
                    <SelectItem value="debit">Debits</SelectItem>
                    <SelectItem value="commission">Commissions</SelectItem>
                    <SelectItem value="refund">Refunds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Tenant</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Description</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">Amount</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-700 hover:bg-gray-800/50 transition">
                      <td className="px-6 py-4 text-sm text-gray-400">{entry.date}</td>
                      <td className="px-6 py-4 text-sm font-medium">{entry.tenant}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getTypeBg(entry.type)} ${getTypeColor(entry.type)}`}>
                          {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">{entry.description}</td>
                      <td className={`px-6 py-4 text-sm font-medium text-right ${entry.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {entry.amount > 0 ? '+' : ''}₦{entry.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-right">₦{entry.balance.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Commission Calculator Tab */}
        <TabsContent value="commissions">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Commission Breakdown by Tenant</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Tenant</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">Revenue</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">Commission Rate</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">Commission Amount</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">Net Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionData.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-700 hover:bg-gray-800/50 transition">
                      <td className="px-6 py-4 text-sm font-medium">{item.tenant}</td>
                      <td className="px-6 py-4 text-sm text-right text-green-400">₦{item.revenue.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-right">{item.rate}%</td>
                      <td className="px-6 py-4 text-sm text-right text-blue-400">₦{item.commission.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium">₦{(item.revenue - item.commission).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Distribution Tab */}
        <TabsContent value="distribution">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Payment Distribution</h3>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={paymentDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ₦${value.toLocaleString()}`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `₦${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
