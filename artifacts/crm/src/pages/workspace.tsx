import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Briefcase, CheckCircle2, Target, WalletCards } from "lucide-react";
import { useGetMyStats, useListLeads } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MONTHS = [
  { id: "all", label: "Все периоды" },
  { id: "2026-01", label: "Январь 2026" },
  { id: "2026-02", label: "Февраль 2026" },
];

const statusLabels: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  proposal_sent: "КП отправлено",
  waiting_decision: "Ждем решения",
  paid: "Оплата",
  lost: "Отказ",
};

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function MiniMetric({
  title,
  value,
  hint,
  tone = "default",
}: {
  title: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-background p-3",
        tone === "good" && "border-emerald-200 bg-emerald-50/40",
        tone === "warning" && "border-amber-200 bg-amber-50/45",
      )}
    >
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <div className="mt-1 truncate text-xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default function Workspace() {
  const [month, setMonth] = useState<string>("2026-02");

  const { data: stats, isLoading: statsLoading } = useGetMyStats(month !== "all" ? { month } : undefined);
  const { data: leads = [], isLoading: leadsLoading } = useListLeads();

  const activeLeads = useMemo(
    () => leads.filter((lead) => !["paid", "lost"].includes(lead.status || "")).slice(0, 8),
    [leads],
  );

  const planProgress = Math.round(stats?.planProgress || 0);
  const netProfit = stats?.netProfit || 0;
  const minPlan = stats?.minPlan || 0;
  const targetPlan = stats?.targetPlan || 0;
  const amountToMin = Math.max(minPlan - netProfit, 0);
  const amountToTarget = Math.max(targetPlan - netProfit, 0);
  const minReached = minPlan > 0 && netProfit >= minPlan;
  const targetReached = targetPlan > 0 && netProfit >= targetPlan;

  if (statsLoading || leadsLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-50/70 p-4 lg:p-6">
      <div className="mb-4 flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Рабочий стол менеджера</p>
          <h1 className="text-2xl font-bold tracking-tight">{stats?.managerName || "Мой план"}</h1>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="h-9 w-48 bg-background">
            <SelectValue placeholder="Период" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="flex min-h-0 flex-col gap-4">
          <Card className="shrink-0 rounded-lg border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
                <div className="min-w-0 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Текущая премия</div>
                      <div className="mt-1 text-3xl font-bold tracking-tight text-primary">
                        {formatCurrency(stats?.currentBonus)}
                      </div>
                    </div>
                    <div className="rounded-full bg-background px-3 py-1 text-sm font-semibold text-primary shadow-sm">
                      x{stats?.currentMultiplier || 0}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">Прогресс к целевому плану</span>
                      <span className="font-bold">{planProgress}%</span>
                    </div>
                    <Progress value={Math.min(planProgress, 100)} className="h-3" />
                    <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                      <span>Факт: {formatCurrency(netProfit)}</span>
                      <span>Цель: {formatCurrency(targetPlan)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <MiniMetric
                    title="До минимума"
                    value={minReached ? "Выполнен" : formatCurrency(amountToMin)}
                    hint={formatCurrency(minPlan)}
                    tone={minReached ? "good" : "warning"}
                  />
                  <MiniMetric
                    title="До цели"
                    value={targetReached ? "Выполнена" : formatCurrency(amountToTarget)}
                    hint={formatCurrency(targetPlan)}
                    tone={targetReached ? "good" : "default"}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid shrink-0 gap-3 md:grid-cols-3">
            <Link href="/leads?status=in_progress">
              <MiniMetric title="Заявки в работе" value={stats?.openDeals || 0} hint="Открыть Kanban" />
            </Link>
            <MiniMetric title="Задачи сегодня" value={stats?.todayTasks || 0} hint="Нужны действия" />
            <MiniMetric title="Факт прибыли" value={formatCurrency(netProfit)} hint="По выбранному периоду" />
          </div>

          <Card className="flex min-h-0 flex-1 flex-col rounded-lg shadow-sm">
            <CardHeader className="shrink-0">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Заявки в работе</CardTitle>
                <Link href="/leads" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  Все заявки <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-3">
                {activeLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads?id=${lead.id}&status=${lead.status}`}
                    className="block rounded-lg border bg-background p-3 transition-colors hover:border-primary/60 hover:bg-primary/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{lead.clientName}</div>
                        <div className="mt-1 truncate text-sm text-muted-foreground">
                          {[lead.product, lead.tariff].filter(Boolean).join(" / ") || "Без продукта"}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-medium">{formatCurrency(lead.price)}</div>
                        <div className="mt-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                          {statusLabels[lead.status || ""] || lead.status}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                {activeLeads.length === 0 && (
                  <div className="rounded-lg border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
                    Сейчас нет открытых заявок
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="flex min-h-0 flex-col rounded-lg shadow-sm">
          <CardHeader className="shrink-0">
            <CardTitle className="text-base">Что важно сейчас</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-3">
              <div className="flex gap-3 rounded-lg border bg-background p-4">
                <WalletCards className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">Премия уже начислена: {formatCurrency(stats?.currentBonus)}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {minReached
                      ? "Минимальный план выполнен, базовая премия сохранена."
                      : `До минимального плана осталось ${formatCurrency(amountToMin)}.`}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 rounded-lg border bg-background p-4">
                <Target className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">
                    {targetReached ? "Целевой план выполнен" : `До цели осталось ${formatCurrency(amountToTarget)}`}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    При достижении цели применяется повышающий коэффициент.
                  </div>
                </div>
              </div>

              <Link href="/leads?status=in_progress" className="flex gap-3 rounded-lg border bg-background p-4 transition-colors hover:border-primary/60 hover:bg-primary/5">
                <Briefcase className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">Перейти к заявкам в работе</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Откроется Kanban с фильтром по активным карточкам.
                  </div>
                </div>
              </Link>

              {targetReached && (
                <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
                  <div>
                    <div className="font-semibold text-emerald-900">Отличный месяц</div>
                    <div className="mt-1 text-sm text-emerald-800">
                      Цель закрыта, можно удерживать результат и переводить новые сделки в оплату.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
