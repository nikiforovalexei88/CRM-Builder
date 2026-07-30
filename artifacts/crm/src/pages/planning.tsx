import { useCreatePlan, useGetManagerComparison, useListEmployees, useListPlans, useUpdatePlan } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Edit2, Plus, Target, TrendingUp, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MONTHS = [
  { id: "2025-12", label: "Декабрь 2025" },
  { id: "2026-01", label: "Январь 2026" },
  { id: "2026-02", label: "Февраль 2026" },
  { id: "2026-03", label: "Март 2026" },
];

function formatMoney(value?: number | null) {
  if (!value) return "-";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function monthLabel(value: string) {
  return MONTHS.find((month) => month.id === value)?.label ?? value;
}

export default function Planning() {
  const [month, setMonth] = useState("2026-02");
  const { data: plans = [], isLoading: plansLoading } = useListPlans({ month });
  const { data: allPlans = [] } = useListPlans();
  const { data: employees = [] } = useListEmployees();
  const { data: managers = [], isLoading: managersLoading } = useGetManagerComparison({ month });

  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    managerId: "",
    month,
    product: "Финансовое обучение",
    minPlan: "",
    targetPlan: "",
    maxPlan: "",
  });

  const totals = useMemo(() => {
    return managers.reduce(
      (acc, manager) => {
        acc.revenue += manager.revenue || 0;
        acc.netProfit += manager.netProfit || 0;
        acc.targetPlan += manager.targetPlan || 0;
        acc.deals += manager.deals || 0;
        return acc;
      },
      { revenue: 0, netProfit: 0, targetPlan: 0, deals: 0 },
    );
  }, [managers]);

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      managerId: "",
      month,
      product: "Финансовое обучение",
      minPlan: "",
      targetPlan: "",
      maxPlan: "",
    });
  };

  const openCreate = (managerId?: number) => {
    const employee = employees.find((item) => item.id === managerId);
    setEditingId(null);
    setFormData({
      managerId: managerId?.toString() || "",
      month,
      product: "Финансовое обучение",
      minPlan: employee?.minPlan?.toString() || "1000000",
      targetPlan: employee?.targetPlan?.toString() || "1500000",
      maxPlan: employee?.maxPlan?.toString() || "2000000",
    });
    setIsOpen(true);
  };

  const handleEdit = (plan: any) => {
    setEditingId(plan.id);
    setFormData({
      managerId: plan.managerId.toString(),
      month: plan.month,
      product: plan.product || "Финансовое обучение",
      minPlan: plan.minPlan.toString(),
      targetPlan: plan.targetPlan.toString(),
      maxPlan: plan.maxPlan.toString(),
    });
    setIsOpen(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planning"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries();
      setIsOpen(false);
      resetForm();
    };

    if (editingId) {
      updatePlan.mutate(
        {
          id: editingId,
          data: {
            product: formData.product || undefined,
            minPlan: Number(formData.minPlan),
            targetPlan: Number(formData.targetPlan),
            maxPlan: Number(formData.maxPlan),
          },
        },
        { onSuccess: invalidate },
      );
      return;
    }

    createPlan.mutate(
      {
        data: {
          managerId: Number(formData.managerId),
          month: formData.month,
          product: formData.product || undefined,
          minPlan: Number(formData.minPlan),
          targetPlan: Number(formData.targetPlan),
          maxPlan: Number(formData.maxPlan),
        },
      },
      { onSuccess: invalidate },
    );
  };

  const isLoading = plansLoading || managersLoading;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background p-4 lg:p-6">
      <div className="mb-4 flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Планы</h1>
          <p className="text-sm text-muted-foreground">Месячные планы, факт выполнения и история настроек</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-9 w-52 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => openCreate()}>
                <Plus className="mr-2 h-4 w-4" />
                Новый план
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Редактировать план" : "Новый план"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingId && (
                  <div className="space-y-2">
                    <Label>Сотрудник</Label>
                    <Select
                      value={formData.managerId}
                      onValueChange={(value) => setFormData({ ...formData, managerId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите сотрудника" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id.toString()}>
                            {employee.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Месяц</Label>
                  <Select value={formData.month} onValueChange={(value) => setFormData({ ...formData, month: value })}>
                    <SelectTrigger>
                      <SelectValue />
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
                <div className="space-y-2">
                  <Label>Продукт / категория</Label>
                  <Input value={formData.product} onChange={(event) => setFormData({ ...formData, product: event.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Минимум</Label>
                    <Input
                      type="number"
                      value={formData.minPlan}
                      onChange={(event) => setFormData({ ...formData, minPlan: event.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Цель</Label>
                    <Input
                      type="number"
                      value={formData.targetPlan}
                      onChange={(event) => setFormData({ ...formData, targetPlan: event.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Максимум</Label>
                    <Input
                      type="number"
                      value={formData.maxPlan}
                      onChange={(event) => setFormData({ ...formData, maxPlan: event.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={!editingId && !formData.managerId}>
                    {editingId ? "Сохранить" : "Создать"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mb-4 grid shrink-0 gap-3 md:grid-cols-3">
        <SummaryCard title="Выручка" value={formatMoney(totals.revenue)} icon={WalletCards} />
        <SummaryCard title="Чистая прибыль" value={formatMoney(totals.netProfit)} icon={TrendingUp} />
        <SummaryCard title="Целевой план" value={formatMoney(totals.targetPlan)} icon={Target} />
      </div>

      <Tabs defaultValue="fact" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabsList className="mb-3 shrink-0">
          <TabsTrigger value="fact">План-факт</TabsTrigger>
          <TabsTrigger value="settings">Настройка планов</TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>

        <TabsContent value="fact" className="min-h-0 flex-1 overflow-hidden">
          <Card className="flex h-full min-h-0 flex-col rounded-lg">
            <CardHeader className="shrink-0">
              <CardTitle>Выполнение за {monthLabel(month)}</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {managers.map((manager) => {
                    const progress = Math.round(manager.planProgress || 0);
                    const toMin = Math.max((manager.minPlan || 0) - (manager.netProfit || 0), 0);
                    const toTarget = Math.max((manager.targetPlan || 0) - (manager.netProfit || 0), 0);
                    const existingPlan = plans.find((plan) => plan.managerId === manager.managerId);
                    return (
                      <div key={manager.managerId} className="rounded-lg border bg-background p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{manager.managerName}</div>
                            <div className="text-sm text-muted-foreground">{manager.deals} оплат</div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => (existingPlan ? handleEdit(existingPlan) : openCreate(manager.managerId))}
                          >
                            {existingPlan ? "Изменить план" : "Задать план"}
                          </Button>
                        </div>
                        <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
                          <Metric label="Факт" value={formatMoney(manager.netProfit)} />
                          <Metric label="Минимум" value={formatMoney(manager.minPlan)} />
                          <Metric label="Цель" value={formatMoney(manager.targetPlan)} />
                        </div>
                        <Progress value={Math.min(progress, 100)} className="h-2" />
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <span>{progress}% цели</span>
                          <span>до минимума {formatMoney(toMin)}</span>
                          <span className="text-right">до цели {formatMoney(toTarget)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="min-h-0 flex-1 overflow-hidden">
          <PlanTable plans={plans} isLoading={plansLoading} onEdit={handleEdit} emptyText="Планов за выбранный месяц пока нет" />
        </TabsContent>

        <TabsContent value="history" className="min-h-0 flex-1 overflow-hidden">
          <PlanTable plans={allPlans} isLoading={false} onEdit={handleEdit} emptyText="История планов пока пустая" showMonth />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon }: { title: string; value: string; icon: any }) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="truncate text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate font-medium">{value}</div>
    </div>
  );
}

function PlanTable({
  plans,
  isLoading,
  onEdit,
  emptyText,
  showMonth = false,
}: {
  plans: any[];
  isLoading: boolean;
  onEdit: (plan: any) => void;
  emptyText: string;
  showMonth?: boolean;
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col rounded-lg">
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead>Сотрудник</TableHead>
                {showMonth && <TableHead>Месяц</TableHead>}
                <TableHead>Продукт</TableHead>
                <TableHead className="text-right">Минимум</TableHead>
                <TableHead className="text-right">Цель</TableHead>
                <TableHead className="text-right">Максимум</TableHead>
                <TableHead className="w-[90px] text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.managerName}</TableCell>
                  {showMonth && <TableCell>{monthLabel(plan.month)}</TableCell>}
                  <TableCell>{plan.product || "-"}</TableCell>
                  <TableCell className="text-right">{formatMoney(plan.minPlan)}</TableCell>
                  <TableCell className="text-right font-medium text-primary">{formatMoney(plan.targetPlan)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatMoney(plan.maxPlan)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(plan)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {plans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={showMonth ? 7 : 6} className="py-10 text-center text-muted-foreground">
                    {emptyText}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  );
}
