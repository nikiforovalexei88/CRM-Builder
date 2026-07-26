import { useListLeads, useCreateLead, useUpdateLead, useDeleteLead, useMoveLead, useListEmployees, useGetLead, useAddLeadNote, useListLeadActivities } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle as ModalTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Phone, Send, MessageSquare, Trash2, Edit2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { id: "new", title: "Новый", color: "bg-blue-100/50 border-blue-200" },
  { id: "in_progress", title: "В работе", color: "bg-amber-100/50 border-amber-200" },
  { id: "proposal_sent", title: "КП отправлено", color: "bg-purple-100/50 border-purple-200" },
  { id: "waiting_decision", title: "Ждет решения", color: "bg-pink-100/50 border-pink-200" },
  { id: "paid", title: "Оплачено", color: "bg-emerald-100/50 border-emerald-200" },
];

const TARIFFS = [
  { id: "сам", label: "Сам", price: 34990, color: "bg-slate-100 text-slate-800 border-slate-200" },
  { id: "куратор", label: "Куратор", price: 54990, color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "вип", label: "VIP", price: 79990, color: "bg-purple-100 text-purple-800 border-purple-200" },
];

export default function Leads() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const [managerId, setManagerId] = useState<string>("all");
  const [tariff, setTariff] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);

  const queryParams = {
    managerId: managerId !== "all" ? Number(managerId) : undefined,
    tariff: tariff !== "all" ? tariff : undefined,
    search: search || undefined
  };

  const { data: leads, isLoading } = useListLeads(queryParams);
  const { data: employees } = useListEmployees();

  const moveLead = useMoveLead();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();

  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData("leadId", id.toString());
    e.currentTarget.classList.add("opacity-50");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("opacity-50");
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove("bg-accent/50");
    const idStr = e.dataTransfer.getData("leadId");
    if (!idStr) return;
    const id = parseInt(idStr, 10);
    
    // Optimistic update
    queryClient.setQueryData(["/api/leads", queryParams], (old: any) => {
      if (!old) return old;
      return old.map((l: any) => l.id === id ? { ...l, status } : l);
    });

    moveLead.mutate({ id, data: { status } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/leads"] }),
      onError: () => queryClient.invalidateQueries({ queryKey: ["/api/leads"] })
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("bg-accent/50");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("bg-accent/50");
  };

  const formatMoney = (val?: number | null) => val ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(val) : '-';

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-background">
      <div className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 bg-card">
        <h1 className="text-xl font-bold tracking-tight">Sales Pipeline</h1>
        
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9 bg-background h-9 text-sm" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          
          <Select value={tariff} onValueChange={setTariff}>
            <SelectTrigger className="w-40 h-9 bg-background"><SelectValue placeholder="All Tariffs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tariffs</SelectItem>
              {TARIFFS.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {isAdmin && (
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger className="w-48 h-9 bg-background"><SelectValue placeholder="All Managers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Managers</SelectItem>
                {employees?.filter(e => e.role === "manager").map(emp => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button size="sm" onClick={() => { setEditingLeadId(null); setIsCreateOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Lead
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex gap-6 h-full min-w-max pb-4">
          {COLUMNS.map(col => {
            const columnLeads = leads?.filter(l => l.status === col.id) || [];
            return (
              <div 
                key={col.id} 
                className="w-80 flex flex-col bg-muted/30 rounded-xl border border-border/50 overflow-hidden"
                onDrop={(e) => handleDrop(e, col.id)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className={cn("px-4 py-3 border-b flex items-center justify-between shrink-0", col.color)}>
                  <h3 className="font-semibold text-sm">{col.title}</h3>
                  <span className="text-xs font-medium bg-background/50 px-2 py-0.5 rounded-full">{columnLeads.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {isLoading && <div className="animate-pulse space-y-3">{[1,2].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}</div>}
                  
                  {columnLeads.map(lead => {
                    const tariffConfig = TARIFFS.find(t => t.id === lead.tariff);
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className="bg-card border border-border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-semibold text-sm line-clamp-1">{lead.clientName}</span>
                          {tariffConfig && (
                            <span className={cn("text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border", tariffConfig.color)}>
                              {tariffConfig.label}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm font-medium text-primary mb-3">
                          {formatMoney(lead.price)}
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
                          <span className="truncate pr-2">{lead.managerName}</span>
                          <div className="flex gap-2 shrink-0">
                            {lead.phone && <Phone className="w-3.5 h-3.5" />}
                            {lead.telegram && <Send className="w-3.5 h-3.5" />}
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

      <LeadSlideOver 
        leadId={selectedLeadId} 
        onClose={() => setSelectedLeadId(null)} 
        onEdit={(id) => { setSelectedLeadId(null); setEditingLeadId(id); setIsCreateOpen(true); }}
      />
      <LeadFormDialog 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        leadId={editingLeadId} 
      />
    </div>
  );
}

function LeadSlideOver({ leadId, onClose, onEdit }: { leadId: number | null, onClose: () => void, onEdit: (id: number) => void }) {
  const { data: lead, isLoading } = useGetLead(leadId || 0, { query: { enabled: !!leadId, queryKey: ["/api/leads", leadId] } });
  const { data: activities } = useListLeadActivities(leadId || 0, { query: { enabled: !!leadId, queryKey: ["/api/leads", leadId, "activities"] } });
  const addNote = useAddLeadNote();
  const deleteLead = useDeleteLead();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const { user } = useAuth();

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim() || !leadId) return;
    addNote.mutate({ id: leadId, data: { content: note } }, {
      onSuccess: () => {
        setNote("");
        queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "activities"] });
      }
    });
  };

  const handleDelete = () => {
    if (!leadId) return;
    if (confirm("Are you sure you want to delete this lead?")) {
      deleteLead.mutate({ id: leadId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
          onClose();
        }
      });
    }
  };

  const formatMoney = (val?: number | null) => val ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(val) : '-';

  return (
    <Sheet open={!!leadId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[500px] sm:w-[540px] sm:max-w-none flex flex-col p-0 border-l">
        {isLoading || !lead ? (
          <div className="h-full flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
        ) : (
          <>
            <SheetHeader className="p-6 border-b shrink-0 bg-card">
              <div className="flex items-start justify-between">
                <div>
                  <DialogTitle className="text-xl font-bold">{lead.clientName}</DialogTitle>
                  <SheetDescription className="flex items-center gap-2 mt-1">
                    <span className="uppercase text-xs tracking-wider font-medium text-primary">{lead.status.replace("_", " ")}</span>
                    <span>•</span>
                    <span>{lead.product}</span>
                  </SheetDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => onEdit(lead.id)}><Edit2 className="w-4 h-4" /></Button>
                  {(user?.role === "admin" || user?.id === lead.managerId) && (
                    <Button variant="outline" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}><Trash2 className="w-4 h-4" /></Button>
                  )}
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-muted/10">
              <div className="grid grid-cols-2 gap-6 bg-card p-5 rounded-xl border shadow-sm">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tariff</div>
                  <div className="font-medium">{lead.tariff || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Price</div>
                  <div className="font-medium text-primary">{formatMoney(lead.price)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Manager</div>
                  <div className="font-medium">{lead.managerName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Source</div>
                  <div className="font-medium">{lead.source || "-"}</div>
                </div>
              </div>

              <div className="bg-card p-5 rounded-xl border shadow-sm space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2 border-b pb-2"><MessageSquare className="w-4 h-4" /> Contacts & Info</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <div className="font-medium">{lead.phone || "-"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Telegram:</span>
                    <div className="font-medium">{lead.telegram || "-"}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Notes:</span>
                    <div className="font-medium mt-1 p-3 bg-muted/50 rounded-lg whitespace-pre-wrap">{lead.notes || "No notes"}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">Activity History</h3>
                <div className="space-y-4 border-l-2 border-border ml-2 pl-4">
                  {activities?.map(act => (
                    <div key={act.id} className="relative">
                      <div className="absolute w-2 h-2 bg-primary rounded-full -left-[21px] top-1.5 ring-4 ring-background" />
                      <div className="text-sm bg-card p-3 rounded-lg border shadow-sm">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span className="font-medium text-foreground">{act.authorName}</span>
                          <span>{new Date(act.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="whitespace-pre-wrap">{act.content}</div>
                      </div>
                    </div>
                  ))}
                  {activities?.length === 0 && <div className="text-sm text-muted-foreground italic">No activity yet.</div>}
                </div>
                
                <form onSubmit={handleAddNote} className="pt-4 flex gap-2">
                  <Input placeholder="Add a note..." value={note} onChange={e => setNote(e.target.value)} className="bg-card" />
                  <Button type="submit" disabled={!note.trim() || addNote.isPending}>Add</Button>
                </form>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function LeadFormDialog({ isOpen, onClose, leadId }: { isOpen: boolean, onClose: () => void, leadId: number | null }) {
  const { data: lead } = useGetLead(leadId || 0, { query: { enabled: !!leadId, queryKey: ["/api/leads", leadId] } });
  const { data: employees } = useListEmployees();
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
    managerId: user?.id.toString() || ""
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
        managerId: lead.managerId.toString()
      });
    } else if (!leadId && isOpen) {
      setFormData({
        clientName: "", phone: "", telegram: "", product: "", tariff: "сам", price: "", source: "", status: "new", notes: "", managerId: user?.id.toString() || ""
      });
    }
  }, [lead, leadId, isOpen, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      managerId: Number(formData.managerId)
    };

    if (leadId) {
      updateLead.mutate({ id: leadId, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
          if (leadId) queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
          onClose();
        }
      });
    } else {
      createLead.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
          onClose();
        }
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <ModalTitle>{leadId ? "Edit Lead" : "New Lead"}</ModalTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 pt-4">
          <div className="space-y-2 col-span-2">
            <Label>Client Name *</Label>
            <Input value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} required />
          </div>
          
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Telegram</Label>
            <Input value={formData.telegram} onChange={e => setFormData({...formData, telegram: e.target.value})} />
          </div>
          
          <div className="space-y-2">
            <Label>Product</Label>
            <Input value={formData.product} onChange={e => setFormData({...formData, product: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Tariff</Label>
            <Select value={formData.tariff} onValueChange={v => setFormData({...formData, tariff: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TARIFFS.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Price (₽)</Label>
            <Input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Input value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} placeholder="e.g. Instagram, Referral" />
          </div>
          
          {isAdmin && (
            <div className="space-y-2 col-span-2">
              <Label>Manager</Label>
              <Select value={formData.managerId} onValueChange={v => setFormData({...formData, managerId: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {employees?.filter(e => e.role === "manager").map(emp => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 col-span-2">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLUMNS.map(col => <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2 col-span-2">
            <Label>Initial Notes</Label>
            <Input value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
          </div>
          
          <div className="col-span-2 flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{leadId ? "Save Changes" : "Create Lead"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
