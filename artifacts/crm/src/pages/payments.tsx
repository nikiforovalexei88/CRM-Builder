import { useListPayments, useCreatePayment, useUpdatePayment, useDeletePayment, useListEmployees } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Edit2, Trash2, Search, DollarSign, TrendingUp, Users, Target } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function StatCard({ title, value, icon: Icon }: { title: string, value: string | number, icon: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function Payments() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  
  const [managerId, setManagerId] = useState<string>("all");
  const [month, setMonth] = useState<string>("all");
  const [search, setSearch] = useState("");
  
  const queryParams = {
    managerId: managerId !== "all" ? Number(managerId) : undefined,
    month: month !== "all" ? month : undefined,
    search: search || undefined
  };
  
  const { data: payments, isLoading } = useListPayments(queryParams);
  const { data: employees } = useListEmployees();
  
  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const deletePayment = useDeletePayment();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    clientName: "",
    tariff: "сам",
    revenue: "",
    netProfit: "",
    paymentMethod: "",
    paymentDate: new Date().toISOString().split('T')[0],
    managerId: user?.id.toString() || "",
  });

  const resetForm = () => {
    setFormData({ clientName: "", tariff: "сам", revenue: "", netProfit: "", paymentMethod: "", paymentDate: new Date().toISOString().split('T')[0], managerId: user?.id.toString() || "" });
    setEditingId(null);
  };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setFormData({
      clientName: p.clientName,
      tariff: p.tariff,
      revenue: p.revenue.toString(),
      netProfit: p.netProfit?.toString() || "",
      paymentMethod: p.paymentMethod || "",
      paymentDate: p.paymentDate.split('T')[0],
      managerId: p.managerId.toString()
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      clientName: formData.clientName,
      tariff: formData.tariff,
      revenue: Number(formData.revenue),
      netProfit: formData.netProfit ? Number(formData.netProfit) : undefined,
      paymentMethod: formData.paymentMethod,
      paymentDate: formData.paymentDate,
      managerId: Number(formData.managerId)
    };

    if (editingId) {
      updatePayment.mutate({ id: editingId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/payments"] }); setIsOpen(false); resetForm(); }
      });
    } else {
      createPayment.mutate({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/payments"] }); setIsOpen(false); resetForm(); }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete payment?")) {
      deletePayment.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/payments"] })
      });
    }
  };

  const formatMoney = (val?: number | null) => val ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(val) : '-';

  // Derived stats
  const stats = useMemo(() => {
    if (!payments) return { revenue: 0, profit: 0, deals: 0, avg: 0 };
    const revenue = payments.reduce((sum, p) => sum + p.revenue, 0);
    const profit = payments.reduce((sum, p) => sum + (p.netProfit || 0), 0);
    const deals = payments.length;
    return { revenue, profit, deals, avg: deals ? revenue / deals : 0 };
  }, [payments]);

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-hidden space-y-6">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit Payment" : "Add Payment"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Client Name</Label>
                <Input value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Tariff</Label>
                <Select value={formData.tariff} onValueChange={v => setFormData({...formData, tariff: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="сам">Сам (34,990)</SelectItem>
                    <SelectItem value="куратор">Куратор (54,990)</SelectItem>
                    <SelectItem value="вип">VIP (79,990)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Revenue (₽)</Label>
                <Input type="number" value={formData.revenue} onChange={e => setFormData({...formData, revenue: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Net Profit (₽)</Label>
                <Input type="number" value={formData.netProfit} onChange={e => setFormData({...formData, netProfit: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} required />
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
              <div className="col-span-2 flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button type="submit">{editingId ? "Save" : "Create"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4 shrink-0">
        <StatCard title="Total Revenue" value={formatMoney(stats.revenue)} icon={DollarSign} />
        <StatCard title="Total Net Profit" value={formatMoney(stats.profit)} icon={TrendingUp} />
        <StatCard title="Total Deals" value={stats.deals} icon={Users} />
        <StatCard title="Average Check" value={formatMoney(stats.avg)} icon={Target} />
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="p-4 border-b bg-muted/20 flex gap-4 shrink-0">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9 bg-background" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isAdmin && (
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger className="w-48 bg-background"><SelectValue placeholder="All Managers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Managers</SelectItem>
                {employees?.filter(e => e.role === "manager").map(emp => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-48 bg-background"><SelectValue placeholder="All Time" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="2023-08">August 2023</SelectItem>
              <SelectItem value="2023-09">September 2023</SelectItem>
              <SelectItem value="2023-10">October 2023</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="h-full flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Tariff</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Net Profit</TableHead>
                  <TableHead>Date</TableHead>
                  {isAdmin && <TableHead>Manager</TableHead>}
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.clientName}</TableCell>
                    <TableCell><span className="uppercase text-xs tracking-wider bg-secondary text-secondary-foreground px-2 py-1 rounded-full">{p.tariff}</span></TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(p.revenue)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatMoney(p.netProfit)}</TableCell>
                    <TableCell>{new Date(p.paymentDate).toLocaleDateString()}</TableCell>
                    {isAdmin && <TableCell>{p.managerName}</TableCell>}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Edit2 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {payments?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">No payments found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
