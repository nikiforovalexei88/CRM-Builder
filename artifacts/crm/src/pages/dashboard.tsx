import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useGetCashFlow, useGetDashboardStats, useGetManagerComparison } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const statStyles = {
  revenue: "border-l-4 border-l-emerald-500 bg-emerald-50/35",
  profit: "border-l-4 border-l-sky-500 bg-sky-50/40",
  deals: "border-l-4 border-l-indigo-500 bg-indigo-50/35",
  conversion: "border-l-4 border-l-violet-500 bg-violet-50/35",
  average: "border-l-4 border-l-amber-500 bg-amber-50/35",
  plan: "border-l-4 border-l-blue-500 bg-blue-50/35",
};

type StatTone = keyof typeof statStyles;

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value || 0);
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  const date = new Date(Number(year), Number(monthNumber) - 1, 1);
  return date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

function chartMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  const date = new Date(Number(year), Number(monthNumber) - 1, 1);
  return date.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "");
}

function previousMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatComparison(current?: number | null, previous?: number | null, mode: "money" | "number" | "percent" = "number") {
  if (previous === undefined || previous === null) return "Нет данных за прошлый период";

  const currentValue = current || 0;
  const previousValue = previous || 0;
  const diff = currentValue - previousValue;
  const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
  const absDiff = Math.abs(diff);
  const formattedDiff =
    mode === "money"
      ? formatCurrency(absDiff)
      : mode === "percent"
        ? `${absDiff.toFixed(1)} п.п.`
        : formatNumber(absDiff);
  const percent = previousValue !== 0 ? ` (${sign}${((absDiff / Math.abs(previousValue)) * 100).toFixed(1)}%)` : "";

  if (diff === 0) return "Без изменений к прошлому месяцу";
  return `${sign}${formattedDiff}${percent} к прошлому месяцу`;
}

function comparisonTone(current?: number | null, previous?: number | null) {
  const diff = (current || 0) - (previous || 0);
  if (diff > 0) return "text-emerald-700";
  if (diff < 0) return "text-rose-700";
  return "text-muted-foreground";
}

function StatCard({
  title,
  value,
  comparison,
  tone,
  description,
}: {
  title: string;
  value: string | number;
  comparison?: ReactNode;
  tone: StatTone;
  description?: ReactNode;
}) {
  return (
    <Card className={cn("overflow-hidden rounded-lg shadow-sm", statStyles[tone])}>
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="truncate text-2xl font-bold tracking-tight">{value}</div>
        {comparison && <div className="mt-2 min-h-4 text-xs font-medium">{comparison}</div>}
        {description && <div className="mt-3 text-xs text-muted-foreground">{description}</div>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [month, setMonth] = useState("2026-02");

  const { data: cashFlow = [], isLoading: flowLoading } = useGetCashFlow();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats(month !== "all" ? { month } : undefined);
  const previousPeriod = month !== "all" ? previousMonth(month) : undefined;
  const { data: previousStats } = useGetDashboardStats(previousPeriod ? { month: previousPeriod } : undefined);
  const { data: managers = [], isLoading: managersLoading } = useGetManagerComparison(
    month !== "all" ? { month } : undefined,
  );

  const monthOptions = useMemo(() => {
    const options = cashFlow.map((entry) => entry.month);
    return options.length > 0 ? options : ["2026-01", "2026-02"];
  }, [cashFlow]);

  const chartData = useMemo(
    () =>
      cashFlow.map((entry) => ({
        ...entry,
        label: chartMonthLabel(entry.month),
      })),
    [cashFlow],
  );

  const planProgress = Math.round(stats?.planProgress || 0);
  const previousPlanProgress = previousStats?.planProgress || 0;
  const comparisonUnavailable = month === "all";
  const isLoading = statsLoading || flowLoading || managersLoading;

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const compareHint = comparisonUnavailable ? (
    <span className="text-muted-foreground">Выберите месяц для сравнения</span>
  ) : null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-50/70 p-4 lg:p-6">
      <div className="mb-4 flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Сводка руководителя</p>
          <h1 className="text-2xl font-bold tracking-tight">Дашборд</h1>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="h-9 w-52 bg-background">
            <SelectValue placeholder="Период" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все периоды</SelectItem>
            {monthOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {monthLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 grid shrink-0 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Выручка"
          value={formatCurrency(stats?.totalRevenue)}
          tone="revenue"
          comparison={
            compareHint ?? (
              <span className={comparisonTone(stats?.totalRevenue, previousStats?.totalRevenue)}>
                {formatComparison(stats?.totalRevenue, previousStats?.totalRevenue, "money")}
              </span>
            )
          }
        />
        <StatCard
          title="Чистая прибыль"
          value={formatCurrency(stats?.totalNetProfit)}
          tone="profit"
          comparison={
            compareHint ?? (
              <span className={comparisonTone(stats?.totalNetProfit, previousStats?.totalNetProfit)}>
                {formatComparison(stats?.totalNetProfit, previousStats?.totalNetProfit, "money")}
              </span>
            )
          }
        />
        <StatCard
          title="Оплат"
          value={stats?.totalDeals || 0}
          tone="deals"
          comparison={
            compareHint ?? (
              <span className={comparisonTone(stats?.totalDeals, previousStats?.totalDeals)}>
                {formatComparison(stats?.totalDeals, previousStats?.totalDeals, "number")}
              </span>
            )
          }
        />
        <StatCard
          title="Конверсия"
          value={`${(stats?.conversionRate || 0).toFixed(1)}%`}
          tone="conversion"
          comparison={
            compareHint ?? (
              <span className={comparisonTone(stats?.conversionRate, previousStats?.conversionRate)}>
                {formatComparison(stats?.conversionRate, previousStats?.conversionRate, "percent")}
              </span>
            )
          }
        />
        <StatCard
          title="Средний чек"
          value={formatCurrency(stats?.averageCheck)}
          tone="average"
          comparison={
            compareHint ?? (
              <span className={comparisonTone(stats?.averageCheck, previousStats?.averageCheck)}>
                {formatComparison(stats?.averageCheck, previousStats?.averageCheck, "money")}
              </span>
            )
          }
        />
        <StatCard
          title="План-факт"
          value={`${planProgress}%`}
          tone="plan"
          comparison={
            compareHint ?? (
              <span className={comparisonTone(planProgress, previousPlanProgress)}>
                {formatComparison(planProgress, previousPlanProgress, "percent")}
              </span>
            )
          }
          description={
            <div className="space-y-2">
              <Progress value={Math.min(planProgress, 100)} className="h-2" />
              <div>Цель: {formatCurrency(stats?.targetPlan)}</div>
            </div>
          }
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card className="flex min-h-0 flex-col rounded-lg shadow-sm">
          <CardHeader className="shrink-0">
            <CardTitle>Динамика поступлений</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 24, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${(Number(value) / 1_000_000).toFixed(1)} млн`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(_, payload) => {
                    const entry = payload?.[0]?.payload;
                    return entry?.month ? monthLabel(entry.month) : "";
                  }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Legend />
                <Bar dataKey="revenue" name="Выручка" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="netProfit" name="Чистая прибыль" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col rounded-lg shadow-sm">
          <CardHeader className="shrink-0">
            <CardTitle>План-факт по сотрудникам</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-5">
              {managers.map((manager) => {
                const progress = Math.round(manager.planProgress || 0);
                const toTarget = Math.max((manager.targetPlan || 0) - (manager.netProfit || 0), 0);
                return (
                  <div key={manager.managerId} className="space-y-2 rounded-md border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{manager.managerName}</span>
                      <span className="text-sm font-medium">{formatCurrency(manager.netProfit)}</span>
                    </div>
                    <Progress value={Math.min(progress, 100)} className="h-2" />
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <span>{manager.deals} оплат</span>
                      <span>{progress}% плана</span>
                      <span className="text-right">до цели {formatCurrency(toTarget)}</span>
                    </div>
                  </div>
                );
              })}
              {managers.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">Нет данных за выбранный период</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
