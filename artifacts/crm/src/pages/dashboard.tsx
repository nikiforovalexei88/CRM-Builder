import { useGetDashboardStats, useGetCashFlow, useGetManagerComparison } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { DollarSign, TrendingUp, Users, Target, Percent, Briefcase } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function StatCard({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: any, description?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [month, setMonth] = useState<string>("all");
  
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats(month !== "all" ? { month } : undefined);
  const { data: cashFlow, isLoading: flowLoading } = useGetCashFlow();
  const { data: managers, isLoading: managersLoading } = useGetManagerComparison(month !== "all" ? { month } : undefined);

  const formatCurrency = (val?: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(val || 0);

  if (statsLoading || flowLoading || managersLoading) {
    return <div className="h-full w-full flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-y-auto space-y-6">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Executive Dashboard</h1>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="2023-08">August 2023</SelectItem>
            <SelectItem value="2023-09">September 2023</SelectItem>
            <SelectItem value="2023-10">October 2023</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 shrink-0">
        <StatCard title="Total Revenue" value={formatCurrency(stats?.totalRevenue)} icon={DollarSign} />
        <StatCard title="Net Profit" value={formatCurrency(stats?.totalNetProfit)} icon={TrendingUp} />
        <StatCard title="Total Deals" value={stats?.totalDeals || 0} icon={Briefcase} />
        <StatCard title="Conversion Rate" value={`${(stats?.conversionRate || 0).toFixed(1)}%`} icon={Percent} />
        <StatCard title="Average Check" value={formatCurrency(stats?.averageCheck)} icon={Target} />
        <StatCard 
          title="Plan Progress" 
          value={`${Math.round(stats?.planProgress || 0)}%`} 
          icon={TrendingUp} 
          description={<Progress value={stats?.planProgress || 0} className="h-2" />} 
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 flex-1 min-h-[400px]">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Cash Flow Trend</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <ResponsiveContainer width="full" height="100%">
              <LineChart data={cashFlow || []} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="netProfit" name="Net Profit" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Manager Performance</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6">
              {managers?.map(m => (
                <div key={m.managerId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{m.managerName}</span>
                    <span className="text-sm text-muted-foreground">{formatCurrency(m.revenue)}</span>
                  </div>
                  <Progress value={m.planProgress || 0} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{m.deals} deals</span>
                    <span>Target: {formatCurrency(m.targetPlan)}</span>
                  </div>
                </div>
              ))}
              {!managers?.length && (
                <div className="text-center text-muted-foreground text-sm py-8">No manager data available for selected period.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
