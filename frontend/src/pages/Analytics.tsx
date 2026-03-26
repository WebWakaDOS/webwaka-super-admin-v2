import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const Analytics = () => {
  const { t } = useTranslation();
  // Sample data for analytics
  const userGrowthData = [
    { month: "Jan", users: 400, activeUsers: 240 },
    { month: "Feb", users: 520, activeUsers: 350 },
    { month: "Mar", users: 680, activeUsers: 480 },
    { month: "Apr", users: 850, activeUsers: 620 },
    { month: "May", users: 1050, activeUsers: 800 },
    { month: "Jun", users: 1200, activeUsers: 950 },
  ];

  const transactionData = [
    { month: "Jan", transactions: 1200, amount: 45000 },
    { month: "Feb", transactions: 1500, amount: 52000 },
    { month: "Mar", transactions: 1800, amount: 61000 },
    { month: "Apr", transactions: 2100, amount: 71000 },
    { month: "May", transactions: 2400, amount: 82000 },
    { month: "Jun", transactions: 2800, amount: 95000 },
  ];

  const moduleUsageData = [
    { name: "Commerce", value: 35, color: "#3b82f6" },
    { name: "Transportation", value: 25, color: "#10b981" },
    { name: "Fintech", value: 20, color: "#f59e0b" },
    { name: "Real Estate", value: 15, color: "#ef4444" },
    { name: "Education", value: 5, color: "#8b5cf6" },
  ];

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="space-y-6" role="main">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('nav.analytics')}</h1>
        <p className="text-muted-foreground mt-2">
          Platform performance metrics and usage analytics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,450</div>
            <p className="text-xs text-green-600 mt-1">+12% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3,240</div>
            <p className="text-xs text-green-600 mt-1">+8% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">28,450</div>
            <p className="text-xs text-green-600 mt-1">+15% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">145ms</div>
            <p className="text-xs text-red-600 mt-1">+5% from last month</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth */}
        <Card>
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>
              Total and active users over the last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Total Users"
                />
                <Line
                  type="monotone"
                  dataKey="activeUsers"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Active Users"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Transaction Analytics */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Analytics</CardTitle>
            <CardDescription>
              Transaction count and volume over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={transactionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="transactions"
                  fill="#3b82f6"
                  name="Transactions"
                />
                <Bar
                  yAxisId="right"
                  dataKey="amount"
                  fill="#10b981"
                  name="Amount (₦)"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Module Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Module Usage Distribution</CardTitle>
          <CardDescription>
            Percentage of transactions by module
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={moduleUsageData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name} ${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {moduleUsageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-4">
              {moduleUsageData.map((module, index) => (
                <div key={module.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{module.name}</span>
                  </div>
                  <span className="text-muted-foreground">{module.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest platform events and activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { time: "2 hours ago", event: "New tenant registered", details: "TechCorp Nigeria" },
              { time: "4 hours ago", event: "Module enabled", details: "Commerce Core on RetailHub Lagos" },
              { time: "6 hours ago", event: "Payment processed", details: "₦125,000 from TechCorp Nigeria" },
              { time: "8 hours ago", event: "System health alert", details: "Message Queue degraded to 98.5%" },
              { time: "1 day ago", event: "Backup completed", details: "Full system backup completed successfully" },
            ].map((activity, index) => (
              <div key={index} className="flex items-start gap-4 pb-4 border-b last:border-b-0 last:pb-0">
                <div className="text-xs text-muted-foreground whitespace-nowrap pt-1">
                  {activity.time}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{activity.event}</p>
                  <p className="text-xs text-muted-foreground">{activity.details}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
