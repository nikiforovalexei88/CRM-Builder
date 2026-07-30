import {
  useCreateEmployee,
  useDeleteEmployee,
  useGetManagerComparison,
  useListEmployees,
  useListPlans,
  useUpdateEmployee,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Edit2, Plus, Trash2, Users, WalletCards, TrendingUp, BadgeRussianRuble } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

function roleLabel(role?: string | null) {
  return role === "admin" ? "Руководитель" : "Менеджер";
}

function calculateBonus(input: {
  netProfit: number;
  minPlan: number;
  targetPlan: number;
  baseBonus: number;
  multiplier: number;
}) {
  if (input.targetPlan > 0 && input.netProfit >= input.targetPlan) {
    return {
      coefficient: input.multiplier || 1,
      bonus: input.baseBonus * (input.multiplier || 1),
      level: "Цель",
    };
  }

  if (input.minPlan > 0 && input.netProfit >= input.minPlan) {
    return {
      coefficient: 1,
      bonus: input.baseBonus,
      level: "Минимум",
    };
  }

  return {
    coefficient: 0,
    bonus: 0,
    level: "Ниже минимума",
  };
}

export default function Employees() {
  const { data: employees = [], isLoading: employeesLoading } = useListEmployees();
  const [month, setMonth] = useState("2026-02");
  const { data: managers = [], isLoading: managersLoading } = useGetManagerComparison({ month });
  const { data: plans = [] } = useListPlans({ month });

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    password: "",
    role: "manager",
    salary: "",
    baseBonus: "",
    multiplier: "",
    minPlan: "",
    targetPlan: "",
    maxPlan: "",
  });

  const rows = useMemo(() => {
    return employees.map((employee) => {
      const managerStats = managers.find((manager) => manager.managerId === employee.id);
      const monthPlan = plans.find((plan) => plan.managerId === employee.id);
      const minPlan = monthPlan?.minPlan ?? employee.minPlan ?? managerStats?.minPlan ?? 0;
      const targetPlan = monthPlan?.targetPlan ?? employee.targetPlan ?? managerStats?.targetPlan ?? 0;
      const maxPlan = monthPlan?.maxPlan ?? employee.maxPlan ?? 0;
      const salary = employee.salary ?? 0;
      const baseBonus = employee.baseBonus ?? 0;
      const multiplier = employee.multiplier ?? 1;
      const netProfit = managerStats?.netProfit ?? 0;
      const progress = targetPlan > 0 ? (netProfit / targetPlan) * 100 : 0;
      const bonus = calculateBonus({ netProfit, minPlan, targetPlan, baseBonus, multiplier });

      return {
        employee,
        managerStats,
        minPlan,
        targetPlan,
        maxPlan,
        salary,
        baseBonus,
        multiplier,
        netProfit,
        progress,
        coefficient: bonus.coefficient,
        bonus: bonus.bonus,
        bonusLevel: bonus.level,
        payout: salary + bonus.bonus,
      };
    });
  }, [employees, managers, plans]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.salary += row.salary;
        acc.bonus += row.bonus;
        acc.payout += row.payout;
        acc.netProfit += row.netProfit;
        return acc;
      },
      { salary: 0, bonus: 0, payout: 0, netProfit: 0 },
    );
  }, [rows]);

  const resetForm = () => {
    setFormData({
      name: "",
      username: "",
      password: "",
      role: "manager",
      salary: "",
      baseBonus: "",
      multiplier: "",
      minPlan: "",
      targetPlan: "",
      maxPlan: "",
    });
    setEditingId(null);
  };

  const handleEdit = (employee: any) => {
    setEditingId(employee.id);
    setFormData({
      name: employee.name,
      username: employee.username,
      password: "",
      role: employee.role,
      salary: employee.salary?.toString() || "",
      baseBonus: employee.baseBonus?.toString() || "",
      multiplier: employee.multiplier?.toString() || "",
      minPlan: employee.minPlan?.toString() || "",
      targetPlan: employee.targetPlan?.toString() || "",
      maxPlan: employee.maxPlan?.toString() || "",
    });
    setIsOpen(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name: formData.name,
      username: formData.username,
      password: formData.password || undefined,
      role: formData.role,
      salary: formData.salary ? Number(formData.salary) : undefined,
      baseBonus: formData.baseBonus ? Number(formData.baseBonus) : undefined,
      multiplier: formData.multiplier ? Number(formData.multiplier) : undefined,
      minPlan: formData.minPlan ? Number(formData.minPlan) : undefined,
      targetPlan: formData.targetPlan ? Number(formData.targetPlan) : undefined,
      maxPlan: formData.maxPlan ? Number(formData.maxPlan) : undefined,
    };

    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspace/my-stats"] });
      setIsOpen(false);
      resetForm();
    };

    if (editingId) {
      updateEmployee.mutate({ id: editingId, data: payload }, { onSuccess });
    } else {
      createEmployee.mutate({ data: payload as any }, { onSuccess });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Удалить сотрудника?")) {
      deleteEmployee.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/employees"] }) });
    }
  };

  const isLoading = employeesLoading || managersLoading;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background p-4 lg:p-6">
      <div className="mb-4 flex shrink-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Сотрудники</h1>
          <p className="text-sm text-muted-foreground">Оклады, премии, коэффициенты и расчет выплат за месяц</p>
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
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Новый сотрудник
              </Button>
            </DialogTrigger>
            <EmployeeDialog
              editingId={editingId}
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleSubmit}
              onClose={() => setIsOpen(false)}
            />
          </Dialog>
        </div>
      </div>

      <div className="mb-4 grid shrink-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Сотрудников" value={rows.length} icon={Users} />
        <SummaryCard title="ФОТ оклад" value={formatMoney(totals.salary)} icon={WalletCards} />
        <SummaryCard title="Премии" value={formatMoney(totals.bonus)} icon={TrendingUp} />
        <SummaryCard title="К выплате" value={formatMoney(totals.payout)} icon={BadgeRussianRuble} />
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg">
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead>Сотрудник</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead className="text-right">Факт прибыли</TableHead>
                <TableHead className="min-w-44">План</TableHead>
                <TableHead className="text-right">Оклад</TableHead>
                <TableHead className="text-right">База премии</TableHead>
                <TableHead className="text-right">Коэф.</TableHead>
                <TableHead className="text-right">Премия</TableHead>
                <TableHead className="text-right">К выплате</TableHead>
                <TableHead className="w-[96px] text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.employee.id}>
                  <TableCell className="font-medium">
                    <div>{row.employee.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{row.employee.username}</div>
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium uppercase tracking-wide text-secondary-foreground">
                      {roleLabel(row.employee.role)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(row.netProfit)}</TableCell>
                  <TableCell>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>{Math.round(row.progress)}%</span>
                      <span>{formatMoney(row.targetPlan)}</span>
                    </div>
                    <Progress value={Math.min(row.progress, 100)} className="h-2" />
                    <div className="mt-1 text-xs text-muted-foreground">
                      минимум {formatMoney(row.minPlan)} · максимум {formatMoney(row.maxPlan)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(row.salary)}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.baseBonus)}</TableCell>
                  <TableCell className="text-right">
                    <div className="font-medium">{row.coefficient}x</div>
                    <div className="text-xs text-muted-foreground">{row.bonusLevel}</div>
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(row.bonus)}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">{formatMoney(row.payout)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(row.employee)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(row.employee.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    Сотрудники не найдены.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: any }) {
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

function EmployeeDialog({
  editingId,
  formData,
  setFormData,
  onSubmit,
  onClose,
}: {
  editingId: number | null;
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{editingId ? "Редактировать сотрудника" : "Новый сотрудник"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Имя</Label>
          <Input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>Логин</Label>
          <Input
            value={formData.username}
            onChange={(event) => setFormData({ ...formData, username: event.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Пароль {editingId && "(оставьте пустым, чтобы не менять)"}</Label>
          <Input
            type="password"
            value={formData.password}
            onChange={(event) => setFormData({ ...formData, password: event.target.value })}
            required={!editingId}
          />
        </div>
        <div className="space-y-2">
          <Label>Роль</Label>
          <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Руководитель</SelectItem>
              <SelectItem value="manager">Менеджер</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Оклад</Label>
          <Input
            type="number"
            value={formData.salary}
            onChange={(event) => setFormData({ ...formData, salary: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Базовая премия</Label>
          <Input
            type="number"
            value={formData.baseBonus}
            onChange={(event) => setFormData({ ...formData, baseBonus: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Коэффициент при цели</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.multiplier}
            onChange={(event) => setFormData({ ...formData, multiplier: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>План минимум</Label>
          <Input
            type="number"
            value={formData.minPlan}
            onChange={(event) => setFormData({ ...formData, minPlan: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>План цель</Label>
          <Input
            type="number"
            value={formData.targetPlan}
            onChange={(event) => setFormData({ ...formData, targetPlan: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>План максимум</Label>
          <Input
            type="number"
            value={formData.maxPlan}
            onChange={(event) => setFormData({ ...formData, maxPlan: event.target.value })}
          />
        </div>
        <div className="col-span-2 mt-2 flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit">{editingId ? "Сохранить" : "Создать"}</Button>
        </div>
      </form>
    </DialogContent>
  );
}
