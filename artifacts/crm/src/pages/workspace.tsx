import { useGetMyStats, useListLeads } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, Briefcase, Zap, DollarSign, ListTodo } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";

function StatCard({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: any, description?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <div className="text-xs text-muted-foreground mt-1">{description}</div>}
      </CardContent>
    </Card>
  );
}

export default function Workspace() {
  const [month, setMonth] = useState<string>("all");
  
  const { data: stats, isLoading: statsLoading } = useGetMyStats(month !== "all" ? { month } : undefined);
  
  // Fetch active leads for this manager
  const { data: leads, isLoading: leadsLoading } = useListLeads();
  
  const formatCurrency = (val?: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(val || 0);

  if (statsLoading || leadsLoading) {
    return <div className="h-full w-full flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  const activeLeads = leads?.filter(l => l.status !== "paid").slice(0, 10) || [];

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-y-auto space-y-6">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">My Workspace</h1>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Current Month</SelectItem>
            <SelectItem value="2023-08">August 2023</SelectItem>
            <SelectItem value="2023-09">September 2023</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shrink-0 bg-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Monthly Plan Progress</span>
              <span className="text-2xl font-bold text-primary">{Math.round(stats?.planProgress || 0)}%</span>
            </div>
            <Progress value={stats?.planProgress || 0} className="h-4" />
            <div className="flex justify-between text-sm font-medium">
              <span>{formatCurrency(stats?.netProfit)} <span className="text-muted-foreground font-normal">Current</span></span>
              <span>{formatCurrency(stats?.targetPlan)} <span className="text-muted-foreground font-normal">Target</span></span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 shrink-0">
        <StatCard title="Open Deals" value={stats?.openDeals || 0} icon={Briefcase} description={<Link href="/leads" className="text-primary hover:underline">View Pipeline</Link>} />
        <StatCard title="Current Bonus" value={formatCurrency(stats?.currentBonus)} icon={DollarSign} />
        <StatCard title="Amount to Target" value={formatCurrency(stats?.amountToTarget)} icon={Target} />
        <StatCard title="Bonus Multiplier" value={`${stats?.currentMultiplier || 1}x`} icon={Zap} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle>Recent Open Deals</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              {activeLeads.map(lead => (
                <Link key={lead.id} href={`/leads?id=${lead.id}`} className="block border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer group hover-elevate">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold group-hover:text-primary transition-colors">{lead.clientName}</div>
                      <div className="text-sm text-muted-foreground">{lead.product} - {lead.tariff}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(lead.price || 0)}</div>
                      <div className="text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground uppercase font-medium mt-1 tracking-wider">
                        {lead.status.replace("_", " ")}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {activeLeads.length === 0 && (
                <div className="text-center text-muted-foreground py-8">No open deals right now.</div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListTodo className="w-5 h-5" /> Today's Tasks</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center text-center">
            <div className="space-y-2">
              <div className="text-4xl font-bold text-muted-foreground/50">{stats?.todayTasks || 0}</div>
              <div className="text-sm text-muted-foreground">Tasks pending</div>
              {stats?.todayTasks === 0 && <div className="text-xs text-primary mt-2">You're all caught up!</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
