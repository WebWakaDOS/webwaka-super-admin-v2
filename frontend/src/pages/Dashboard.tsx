import { MetricCard } from '@/components/MetricCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/contexts/TenantContext';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Users, DollarSign, Package, TrendingUp, Activity } from 'lucide-react';

// Mock data for charts
const revenueData = [
  { month: 'Jan', revenue: 45000, commission: 12000 },
  { month: 'Feb', revenue: 52000, commission: 14000 },
  { month: 'Mar', revenue: 48000, commission: 13000 },
  { month: 'Apr', revenue: 61000, commission: 16000 },
  { month: 'May', revenue: 55000, commission: 15000 },
  { month: 'Jun', revenue: 67000, commission: 18000 },
];

const tenantDistribution = [
  { name: 'Active', value: 156, color: '#10B981' },
  { name: 'Suspended', value: 12, color: '#EF4444' },
  { name: 'Provisioning', value: 8, color: '#F59E0B' },
];

const activityData = [
  { time: '00:00', transactions: 120, signups: 45 },
  { time: '04:00', transactions: 98, signups: 32 },
  { time: '08:00', transactions: 234, signups: 78 },
  { time: '12:00', transactions: 456, signups: 145 },
  { time: '16:00', transactions: 389, signups: 112 },
  { time: '20:00', transactions: 267, signups: 89 },
];

export default function Dashboard() {
  const { tenants } = useTenant();

  const totalRevenue = 328000;
  const totalCommissions = 88000;
  const activeModules = 24;
  const platformHealth = 99.8;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome to WebWaka Super Admin. Monitor your platform performance and manage tenants.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={`₦${(totalRevenue / 1000).toFixed(0)}k`}
          change={12}
          trend="up"
          icon={<DollarSign className="h-4 w-4" />}
          description="Last 30 days"
        />
        <MetricCard
          title="Total Commissions"
          value={`₦${(totalCommissions / 1000).toFixed(0)}k`}
          change={8}
          trend="up"
          icon={<TrendingUp className="h-4 w-4" />}
          description="Last 30 days"
        />
        <MetricCard
          title="Active Tenants"
          value={tenants.filter((t) => t.status === 'active').length}
          change={5}
          trend="up"
          icon={<Users className="h-4 w-4" />}
          description="Total: {tenants.length}"
        />
        <MetricCard
          title="Platform Health"
          value={`${platformHealth}%`}
          change={0.2}
          trend="up"
          icon={<Activity className="h-4 w-4" />}
          description="System uptime"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue & Commission Trend</CardTitle>
            <CardDescription>
              Last 6 months revenue and commission data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="commission"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tenant Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Status</CardTitle>
            <CardDescription>Distribution by status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tenantDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tenantDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Activity</CardTitle>
          <CardDescription>Transactions and signups by hour</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="transactions" fill="#3B82F6" />
              <Bar dataKey="signups" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest platform events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                event: 'New tenant provisioned',
                tenant: 'Tech Startup Inc',
                time: '2 hours ago',
              },
              {
                event: 'Module enabled',
                tenant: 'Retail Store A',
                time: '4 hours ago',
              },
              {
                event: 'Payment processed',
                tenant: 'Transport Company B',
                time: '6 hours ago',
              },
              {
                event: 'System backup completed',
                tenant: 'System',
                time: '8 hours ago',
              },
            ].map((activity, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{activity.event}</p>
                  <p className="text-xs text-muted-foreground">{activity.tenant}</p>
                </div>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
