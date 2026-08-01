import {
  useCreatePayment,
  useDeletePayment,
  useListEmployees,
  useListPayments,
  useUpdatePayment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CreditCard,
  Edit2,
  Plus,
  RotateCcw,
  Search,
  Target,
  Trash2,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const TARIFFS = [
  { id: "куратор", label: "Обучение с куратором" },
  { id: "сам", label: "Самостоятельное обучение" },
  { id: "вип", label: "Обучение с VIP сопровождением от автора курса" },
  { id: "1 конс", label: "Часовая консультация" },
];

const PAYMENT_METHODS = [
  { id: "сразу", label: "Сразу" },
  { id: "рассрочка", label: "Рассрочка" },
];

const MONTHS = [
  { id: "2025-12", label: "Декабрь 2025" },
  { id: "2026-01", label: "Январь 2026" },
  { id: "2026-02", label: "Февраль 2026" },
];

type SortKey = "paymentDate" | "clientName" | "tariff" | "revenue" | "netProfit" | "paymentMethod" | "managerName";
type SortDirection = "asc" | "desc";

function formatMoney(value?: number | null) {
  if (!value) return "-";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU");
}

function tariffLabel(value?: string | null) {
  return TARIFFS.find((item) => item.id === value)?.label ?? value ?? "-";
}

function methodLabel(value?: string | null) {
  return PAYMENT_METHODS.find((item) => item.id === value)?.label ?? value ?? "-";
}

function StatCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: any }) {
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

export default function Payments() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const [managerId, setManagerId] = useState("all");
  const [month, setMonth] = useState("all");
  const [tariff, setTariff] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("paymentDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    clientName: "",
    telegram: "",
    tariff: "сам",
    revenue: "",
    netProfit: "",
    receivable: "",
    paymentMethod: "сразу",
    paymentDate: new Date().toISOString().slice(0, 10),
    managerId: user?.id.toString() || "",
  });

  const queryParams = useMemo(
    () => ({
      managerId: isAdmin && managerId !== "all" ? Number(managerId) : undefined,
      month: month !== "all" ? month : undefined,
      tariff: tariff !== "all" ? tariff : undefined,
      paymentMethod: paymentMethod !== "all" ? paymentMethod : undefined,
      search: search.trim() || undefined,
    }),
    [isAdmin, managerId, month, paymentMethod, search, tariff],
  );

  const { data: payments = [], isLoading } = useListPayments(queryParams);
  const { data: employees = [] } = useListEmployees();
  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const deletePayment = useDeletePayment();

  const availableTariffs = useMemo(() => {
    const byId = new Map(TARIFFS.map((item) => [item.id, item]));
    for (const payment of payments) {
      if (payment.tariff && !byId.has(payment.tariff)) byId.set(payment.tariff, { id: payment.tariff, label: payment.tariff });
    }
    if (tariff !== "all" && !byId.has(tariff)) byId.set(tariff, { id: tariff, label: tariff });
    return Array.from(byId.values());
  }, [payments, tariff]);

  const stats = useMemo(() => {
    const revenue = payments.reduce((sum, payment) => sum + payment.revenue, 0);
    const profit = payments.reduce((sum, payment) => sum + (payment.netProfit ?? 0), 0);
    const receivable = payments.reduce((sum, payment) => sum + (payment.receivable ?? 0), 0);
    const deals = payments.length;
    return {
      revenue,
      profit,
      receivable,
      deals,
      averageCheck: deals ? revenue / deals : 0,
    };
  }, [payments]);

  const sortedPayments = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...payments].sort((a, b) => {
      const left = a[sortKey] ?? "";
      const right = b[sortKey] ?? "";
      if (typeof left === "number" || typeof right === "number") {
        return ((Number(left) || 0) - (Number(right) || 0)) * direction;
      }
      return String(left).localeCompare(String(right), "ru") * direction;
    });
  }, [payments, sortDirection, sortKey]);

  const activeFilterCount = [
    isAdmin && managerId !== "all",
    month !== "all",
    tariff !== "all",
    paymentMethod !== "all",
    Boolean(search.trim()),
  ].filter(Boolean).length;

  const resetFilters = () => {
    setManagerId("all");
    setMonth("all");
    setTariff("all");
    setPaymentMethod("all");
    setSearch("");
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      clientName: "",
      telegram: "",
      tariff: "сам",
      revenue: "",
      netProfit: "",
      receivable: "",
      paymentMethod: "сразу",
      paymentDate: new Date().toISOString().slice(0, 10),
      managerId: user?.id.toString() || "",
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "clientName" || key === "tariff" ? "asc" : "desc");
  };

  const handleEdit = (payment: any) => {
    setEditingId(payment.id);
    setFormData({
      clientName: payment.clientName,
      telegram: payment.telegram || "",
      tariff: payment.tariff,
      revenue: payment.revenue.toString(),
      netProfit: payment.netProfit?.toString() || "",
      receivable: payment.receivable?.toString() || "",
      paymentMethod: payment.paymentMethod || "сразу",
      paymentDate: payment.paymentDate.slice(0, 10),
      managerId: payment.managerId.toString(),
    });
    setIsOpen(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      clientName: formData.clientName,
      telegram: formData.telegram || undefined,
      tariff: formData.tariff,
      revenue: Number(formData.revenue),
      netProfit: formData.netProfit ? Number(formData.netProfit) : undefined,
      receivable: formData.receivable ? Number(formData.receivable) : undefined,
      paymentMethod: formData.paymentMethod || undefined,
      paymentDate: formData.paymentDate,
      managerId: Number(formData.managerId || user?.id),
      status: "paid",
    };

    const options = {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
        setIsOpen(false);
        resetForm();
      },
    };

    if (editingId) updatePayment.mutate({ id: editingId, data: payload }, options);
    else createPayment.mutate({ data: payload }, options);
  };

  const handleDelete = (id: number) => {
    if (confirm("Удалить оплату?")) {
      deletePayment.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/payments"] }) });
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background p-4 lg:p-6">
      <div className="mb-4 flex shrink-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Оплаты</h1>
          <p className="text-sm text-muted-foreground">Фактические поступления из Excel и ручные оплаты</p>
        </div>

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
              Новая оплата
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Редактировать оплату" : "Новая оплата"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 pt-2">
              <div className="col-span-2 space-y-2">
                <Label>Клиент *</Label>
                <Input
                  value={formData.clientName}
                  onChange={(event) => setFormData({ ...formData, clientName: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Telegram</Label>
                <Input
                  value={formData.telegram}
                  onChange={(event) => setFormData({ ...formData, telegram: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Тариф</Label>
                <Select value={formData.tariff} onValueChange={(value) => setFormData({ ...formData, tariff: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARIFFS.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Выручка</Label>
                <Input
                  type="number"
                  value={formData.revenue}
                  onChange={(event) => setFormData({ ...formData, revenue: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Чистая прибыль</Label>
                <Input
                  type="number"
                  value={formData.netProfit}
                  onChange={(event) => setFormData({ ...formData, netProfit: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>К получению</Label>
                <Input
                  type="number"
                  value={formData.receivable}
                  onChange={(event) => setFormData({ ...formData, receivable: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Дата оплаты</Label>
                <Input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(event) => setFormData({ ...formData, paymentDate: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Способ оплаты</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && (
                <div className="col-span-2 space-y-2">
                  <Label>Ответственный</Label>
                  <Select
                    value={formData.managerId}
                    onValueChange={(value) => setFormData({ ...formData, managerId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
              <div className="col-span-2 mt-2 flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit">{editingId ? "Сохранить" : "Создать"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4 grid shrink-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Выручка" value={formatMoney(stats.revenue)} icon={CreditCard} />
        <StatCard title="Чистая прибыль" value={formatMoney(stats.profit)} icon={TrendingUp} />
        <StatCard title="Сделок" value={stats.deals} icon={WalletCards} />
        <StatCard title="Средний чек" value={formatMoney(stats.averageCheck)} icon={Target} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/20 p-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 bg-background pl-9"
              placeholder="Поиск клиента"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {isAdmin && (
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger className="h-9 w-44 bg-background">
                <SelectValue placeholder="Все сотрудники" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все сотрудники</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id.toString()}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-9 w-44 bg-background">
              <SelectValue placeholder="Все месяцы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все месяцы</SelectItem>
              {MONTHS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tariff} onValueChange={setTariff}>
            <SelectTrigger className="h-9 w-36 bg-background">
              <SelectValue placeholder="Все тарифы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все тарифы</SelectItem>
              {availableTariffs.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="h-9 w-40 bg-background">
              <SelectValue placeholder="Способ оплаты" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все способы</SelectItem>
              {PAYMENT_METHODS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button type="button" variant="outline" className="h-9" onClick={resetFilters}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Сброс{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow>
                  <SortableHead label="Клиент" sortKey="clientName" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                  <SortableHead label="Тариф" sortKey="tariff" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                  <SortableHead label="Способ" sortKey="paymentMethod" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                  <SortableHead label="Выручка" sortKey="revenue" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="right" />
                  <SortableHead label="Чистая прибыль" sortKey="netProfit" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="right" />
                  <TableHead className="text-right">К получению</TableHead>
                  <SortableHead label="Дата" sortKey="paymentDate" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                  {isAdmin && <SortableHead label="Сотрудник" sortKey="managerName" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />}
                  <TableHead className="w-[92px] text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="min-w-56 font-medium">
                      <div>{payment.clientName}</div>
                      {payment.telegram && <div className="text-xs text-muted-foreground">{payment.telegram}</div>}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium uppercase tracking-wide text-secondary-foreground">
                        {tariffLabel(payment.tariff)}
                      </span>
                    </TableCell>
                    <TableCell>{methodLabel(payment.paymentMethod)}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(payment.revenue)}</TableCell>
                    <TableCell className="text-right">{formatMoney(payment.netProfit)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatMoney(payment.receivable)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(payment.paymentDate)}</TableCell>
                    {isAdmin && <TableCell>{payment.managerName}</TableCell>}
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(payment)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(payment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {sortedPayments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="py-10 text-center text-muted-foreground">
                      Оплаты не найдены
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableHead({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const Icon = activeKey !== sortKey ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={cn(align === "right" && "text-right")}>
      <Button
        type="button"
        variant="ghost"
        className={cn("h-8 px-2", align === "right" && "ml-auto")}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </TableHead>
  );
}
