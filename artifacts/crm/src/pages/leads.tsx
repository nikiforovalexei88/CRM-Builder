import {
  useAddLeadNote,
  useCreateLead,
  useDeleteLead,
  useGetLead,
  useListEmployees,
  useListLeadActivities,
  useListLeads,
  useMoveLead,
  useUpdateLead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Edit2, Filter, MessageSquare, Phone, Plus, RotateCcw, Search, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle as ModalTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { id: "new", title: "Новая заявка", color: "bg-blue-100/50 border-blue-200" },
  { id: "in_progress", title: "В работе", color: "bg-amber-100/50 border-amber-200" },
  { id: "proposal_sent", title: "КП отправлено", color: "bg-purple-100/50 border-purple-200" },
  { id: "waiting_decision", title: "Ждет решения", color: "bg-pink-100/50 border-pink-200" },
  { id: "paid", title: "Оплата", color: "bg-emerald-100/50 border-emerald-200" },
  { id: "lost", title: "Отказ", color: "bg-rose-100/50 border-rose-200" },
];

const TARIFFS = [
  { id: "сам", label: "Сам", price: 34_990, color: "bg-slate-100 text-slate-800 border-slate-200" },
  { id: "куратор", label: "Куратор", price: 54_990, color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "вип", label: "VIP", price: 79_990, color: "bg-purple-100 text-purple-800 border-purple-200" },
  { id: "с Василием", label: "С Василием", price: 0, color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
];

function getInitialParam(name: string, fallback = "all") {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get(name) || fallback;
}

function formatMoney(value?: number | null) {
  if (!value) return "-";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusTitle(status?: string | null) {
  return COLUMNS.find((column) => column.id === status)?.title ?? status ?? "-";
}

function getTariffConfig(tariff?: string | null) {
  return TARIFFS.find((item) => item.id === tariff);
}

export default function Leads() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const [location] = useLocation();

  const [managerId, setManagerId] = useState<string>(() => getInitialParam("managerId"));
  const [tariff, setTariff] = useState<string>(() => getInitialParam("tariff"));
  const [statusFilter, setStatusFilter] = useState<string>(() => getInitialParam("status"));
  const [search, setSearch] = useState(() => getInitialParam("search", ""));
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1] ?? "");
    const id = Number(params.get("id"));
    if (Number.isFinite(id) && id > 0) setSelectedLeadId(id);

    const managerFromUrl = params.get("managerId");
    if (isAdmin && managerFromUrl) setManagerId(managerFromUrl);

    const statusFromUrl = params.get("status");
    if (statusFromUrl && COLUMNS.some((column) => column.id === statusFromUrl)) setStatusFilter(statusFromUrl);

    const tariffFromUrl = params.get("tariff");
    if (tariffFromUrl) setTariff(tariffFromUrl);

    const searchFromUrl = params.get("search");
    if (searchFromUrl) setSearch(searchFromUrl);
  }, [isAdmin, location]);

  const queryParams = useMemo(
    () => ({
      managerId: isAdmin && managerId !== "all" ? Number(managerId) : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      tariff: tariff !== "all" ? tariff : undefined,
      search: search.trim() || undefined,
    }),
    [isAdmin, managerId, search, statusFilter, tariff],
  );

  const { data: leads = [], isLoading } = useListLeads(queryParams);
  const { data: employees = [] } = useListEmployees();

  const moveLead = useMoveLead();

  const activeColumns = useMemo(
    () => (statusFilter === "all" ? COLUMNS : COLUMNS.filter((column) => column.id === statusFilter)),
    [statusFilter],
  );

  const availableTariffs = useMemo(() => {
    const byId = new Map(TARIFFS.map((item) => [item.id, item]));
    for (const lead of leads) {
      if (lead.tariff && !byId.has(lead.tariff)) {
        byId.set(lead.tariff, {
          id: lead.tariff,
          label: lead.tariff,
          price: 0,
          color: "bg-muted text-foreground border-border",
        });
      }
    }
    if (tariff !== "all" && !byId.has(tariff)) {
      byId.set(tariff, { id: tariff, label: tariff, price: 0, color: "bg-muted text-foreground border-border" });
    }
    return Array.from(byId.values());
  }, [leads, tariff]);

  const totals = useMemo(() => {
    return {
      count: leads.length,
      amount: leads.reduce((sum, lead) => sum + (lead.price ?? 0), 0),
    };
  }, [leads]);

  const activeFilterCount = [isAdmin && managerId !== "all", tariff !== "all", statusFilter !== "all", Boolean(search.trim())].filter(Boolean).length;

  const resetFilters = () => {
    setManagerId("all");
    setTariff("all");
    setStatusFilter("all");
    setSearch("");
  };

  const handleDragStart = (event: React.DragEvent, id: number) => {
    event.dataTransfer.setData("leadId", id.toString());
    event.currentTarget.classList.add("opacity-50");
  };

  const handleDragEnd = (event: React.DragEvent) => {
    event.currentTarget.classList.remove("opacity-50");
  };

  const handleDrop = (event: React.DragEvent, status: string) => {
    event.preventDefault();
    event.currentTarget.classList.remove("bg-accent/50");
    const id = Number(event.dataTransfer.getData("leadId"));
    if (!Number.isFinite(id)) return;

    queryClient.setQueryData(["/api/leads", queryParams], (old: any) => {
      if (!old) return old;
      return old.map((lead: any) => (lead.id === id ? { ...lead, status } : lead));
    });

    moveLead.mutate(
      { id, data: { status } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/leads"] }),
        onError: () => queryClient.invalidateQueries({ queryKey: ["/api/leads"] }),
      },
    );
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.currentTarget.classList.add("bg-accent/50");
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.currentTarget.classList.remove("bg-accent/50");
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border bg-card px-4 py-3 lg:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">Заявки</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span>{totals.count} карточек</span>
              <span>{formatMoney(totals.amount)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 bg-background pl-9 text-sm"
                placeholder="Поиск"
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

            <Select value={tariff} onValueChange={setTariff}>
              <SelectTrigger className="h-9 w-40 bg-background">
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

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-44 bg-background">
                <SelectValue placeholder="Все статусы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {COLUMNS.map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    {column.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={resetFilters}>
              {activeFilterCount > 0 ? <RotateCcw className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
            </Button>

            <Button
              size="sm"
              className="h-9"
              onClick={() => {
                setEditingLeadId(null);
                setIsCreateOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Новая заявка
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-4 lg:p-6">
        <div className="h-full overflow-x-auto overflow-y-hidden">
          <div className="flex h-full min-w-max gap-4 pb-2">
            {activeColumns.map((column) => {
              const columnLeads = leads.filter((lead) => lead.status === column.id);
              return (
                <div
                  key={column.id}
                  className="flex h-full w-[19rem] flex-col overflow-hidden rounded-lg border border-border/70 bg-muted/30"
                  onDrop={(event) => handleDrop(event, column.id)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <div className={cn("flex shrink-0 items-center justify-between border-b px-4 py-3", column.color)}>
                    <h3 className="text-sm font-semibold">{column.title}</h3>
                    <span className="rounded-full bg-background/70 px-2 py-0.5 text-xs font-medium">
                      {columnLeads.length}
                    </span>
                  </div>

                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                    {isLoading && (
                      <div className="space-y-3">
                        {[1, 2, 3].map((item) => (
                          <div key={item} className="h-24 animate-pulse rounded-md bg-muted" />
                        ))}
                      </div>
                    )}

                    {!isLoading && columnLeads.length === 0 && (
                      <div className="rounded-md border border-dashed border-border bg-background/60 p-4 text-center text-sm text-muted-foreground">
                        Пусто
                      </div>
                    )}

                    {columnLeads.map((lead) => {
                      const tariffConfig = getTariffConfig(lead.tariff);
                      return (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(event) => handleDragStart(event, lead.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setSelectedLeadId(lead.id)}
                          className="cursor-grab rounded-md border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/50 hover:shadow-md active:cursor-grabbing"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <span className="min-w-0 truncate text-sm font-semibold">{lead.clientName}</span>
                            {lead.tariff && (
                              <span
                                className={cn(
                                  "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                  tariffConfig?.color ?? "bg-muted text-foreground border-border",
                                )}
                              >
                                {tariffConfig?.label ?? lead.tariff}
                              </span>
                            )}
                          </div>

                          <div className="mb-3 text-sm font-medium text-primary">{formatMoney(lead.price)}</div>

                          <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                            <span className="truncate pr-2">{lead.managerName}</span>
                            <div className="flex shrink-0 gap-2">
                              {lead.phone && <Phone className="h-3.5 w-3.5" />}
                              {lead.telegram && <Send className="h-3.5 w-3.5" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <LeadSlideOver
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onEdit={(id) => {
          setSelectedLeadId(null);
          setEditingLeadId(id);
          setIsCreateOpen(true);
        }}
      />
      <LeadFormDialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} leadId={editingLeadId} />
    </div>
  );
}

function LeadSlideOver({
  leadId,
  onClose,
  onEdit,
}: {
  leadId: number | null;
  onClose: () => void;
  onEdit: (id: number) => void;
}) {
  const { data: lead, isLoading } = useGetLead(leadId || 0, {
    query: { enabled: !!leadId, queryKey: ["/api/leads", leadId] },
  });
  const { data: activities = [] } = useListLeadActivities(leadId || 0, {
    query: { enabled: !!leadId, queryKey: ["/api/leads", leadId, "activities"] },
  });
  const addNote = useAddLeadNote();
  const deleteLead = useDeleteLead();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const { user } = useAuth();

  const handleAddNote = (event: React.FormEvent) => {
    event.preventDefault();
    if (!note.trim() || !leadId) return;
    addNote.mutate(
      { id: leadId, data: { content: note } },
      {
        onSuccess: () => {
          setNote("");
          queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "activities"] });
        },
      },
    );
  };

  const handleDelete = () => {
    if (!leadId) return;
    if (confirm("Удалить заявку?")) {
      deleteLead.mutate(
        { id: leadId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
            onClose();
          },
        },
      );
    }
  };

  return (
    <Sheet open={!!leadId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-[500px] flex-col border-l p-0 sm:w-[540px] sm:max-w-none">
        {isLoading || !lead ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            <SheetHeader className="shrink-0 border-b bg-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl font-bold">{lead.clientName}</SheetTitle>
                  <SheetDescription className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-primary">
                      {getStatusTitle(lead.status)}
                    </span>
                    <span>{lead.product || "Без продукта"}</span>
                  </SheetDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => onEdit(lead.id)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  {(user?.role === "admin" || user?.id === lead.managerId) && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-muted/10 p-6">
              <div className="grid grid-cols-2 gap-5 rounded-lg border bg-card p-5 shadow-sm">
                <InfoBlock label="Тариф" value={lead.tariff || "-"} />
                <InfoBlock label="Сумма" value={formatMoney(lead.price)} accent />
                <InfoBlock label="Менеджер" value={lead.managerName || "-"} />
                <InfoBlock label="Источник" value={lead.source || "-"} />
              </div>

              <div className="space-y-4 rounded-lg border bg-card p-5 shadow-sm">
                <h3 className="flex items-center gap-2 border-b pb-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4" />
                  Контакты и заметки
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <InfoBlock label="Телефон" value={lead.phone || "-"} />
                  <InfoBlock label="Telegram" value={lead.telegram || "-"} />
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Заметки</span>
                    <div className="mt-1 whitespace-pre-wrap rounded-md bg-muted/50 p-3 font-medium">
                      {lead.notes || "Нет заметок"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold">История активности</h3>
                <div className="ml-2 space-y-4 border-l-2 border-border pl-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="relative">
                      <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary ring-4 ring-background" />
                      <div className="rounded-md border bg-card p-3 text-sm shadow-sm">
                        <div className="mb-1 flex justify-between gap-3 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{activity.authorName || "Система"}</span>
                          <span>{new Date(activity.createdAt).toLocaleString("ru-RU")}</span>
                        </div>
                        <div className="whitespace-pre-wrap">{activity.content}</div>
                      </div>
                    </div>
                  ))}
                  {activities.length === 0 && <div className="text-sm italic text-muted-foreground">Истории пока нет</div>}
                </div>

                <form onSubmit={handleAddNote} className="flex gap-2 pt-2">
                  <Input
                    placeholder="Добавить заметку"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="bg-card"
                  />
                  <Button type="submit" disabled={!note.trim() || addNote.isPending}>
                    Добавить
                  </Button>
                </form>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoBlock({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("font-medium", accent && "text-primary")}>{value}</div>
    </div>
  );
}

function LeadFormDialog({
  isOpen,
  onClose,
  leadId,
}: {
  isOpen: boolean;
  onClose: () => void;
  leadId: number | null;
}) {
  const { data: lead } = useGetLead(leadId || 0, {
    query: { enabled: !!leadId, queryKey: ["/api/leads", leadId] },
  });
  const { data: employees = [] } = useListEmployees();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    clientName: "",
    phone: "",
    telegram: "",
    product: "",
    tariff: "сам",
    price: "",
    source: "",
    status: "new",
    notes: "",
    managerId: user?.id.toString() || "",
  });

  useEffect(() => {
    if (leadId && lead) {
      setFormData({
        clientName: lead.clientName,
        phone: lead.phone || "",
        telegram: lead.telegram || "",
        product: lead.product || "",
        tariff: lead.tariff || "сам",
        price: lead.price?.toString() || "",
        source: lead.source || "",
        status: lead.status,
        notes: lead.notes || "",
        managerId: lead.managerId.toString(),
      });
    } else if (!leadId && isOpen) {
      setFormData({
        clientName: "",
        phone: "",
        telegram: "",
        product: "",
        tariff: "сам",
        price: "",
        source: "",
        status: "new",
        notes: "",
        managerId: user?.id.toString() || "",
      });
    }
  }, [isOpen, lead, leadId, user]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      clientName: formData.clientName,
      phone: formData.phone || undefined,
      telegram: formData.telegram || undefined,
      product: formData.product || undefined,
      tariff: formData.tariff || undefined,
      price: formData.price ? Number(formData.price) : undefined,
      source: formData.source || undefined,
      status: formData.status,
      notes: formData.notes || undefined,
      managerId: Number(formData.managerId || user?.id),
    };

    if (leadId) {
      updateLead.mutate(
        { id: leadId, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
            queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
            onClose();
          },
        },
      );
      return;
    }

    createLead.mutate(
      { data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <ModalTitle>{leadId ? "Редактировать заявку" : "Новая заявка"}</ModalTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 pt-4">
          <div className="col-span-2 space-y-2">
            <Label>Клиент *</Label>
            <Input
              value={formData.clientName}
              onChange={(event) => setFormData({ ...formData, clientName: event.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Телефон</Label>
            <Input value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Telegram</Label>
            <Input
              value={formData.telegram}
              onChange={(event) => setFormData({ ...formData, telegram: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Продукт</Label>
            <Input
              value={formData.product}
              onChange={(event) => setFormData({ ...formData, product: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Тариф</Label>
            <Select value={formData.tariff} onValueChange={(value) => setFormData({ ...formData, tariff: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARIFFS.map((tariffItem) => (
                  <SelectItem key={tariffItem.id} value={tariffItem.id}>
                    {tariffItem.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Сумма</Label>
            <Input
              type="number"
              value={formData.price}
              onChange={(event) => setFormData({ ...formData, price: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Источник</Label>
            <Input
              value={formData.source}
              onChange={(event) => setFormData({ ...formData, source: event.target.value })}
            />
          </div>

          {isAdmin && (
            <div className="col-span-2 space-y-2">
              <Label>Ответственный</Label>
              <Select value={formData.managerId} onValueChange={(value) => setFormData({ ...formData, managerId: value })}>
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

          <div className="col-span-2 space-y-2">
            <Label>Статус</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMNS.map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    {column.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-2">
            <Label>Заметки</Label>
            <Input value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} />
          </div>

          <div className="col-span-2 mt-4 flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit">{leadId ? "Сохранить" : "Создать"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
