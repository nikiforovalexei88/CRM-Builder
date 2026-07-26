import { useListPlans, useCreatePlan, useUpdatePlan, useListEmployees } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Plus, Edit2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Planning() {
  const [month, setMonth] = useState("2023-10");
  const { data: plans, isLoading } = useListPlans({ month });
  const { data: employees } = useListEmployees();
  
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    managerId: "",
    month: "2023-10",
    product: "",
    minPlan: "",
    targetPlan: "",
    maxPlan: ""
  });

  const resetForm = () => {
    setFormData({ managerId: "", month: "2023-10", product: "", minPlan: "", targetPlan: "", maxPlan: "" });
    setEditingId(null);
  };

  const handleEdit = (plan: any) => {
    setEditingId(plan.id);
    setFormData({
      managerId: plan.managerId.toString(),
      month: plan.month,
      product: plan.product || "",
      minPlan: plan.minPlan.toString(),
      targetPlan: plan.targetPlan.toString(),
      maxPlan: plan.maxPlan.toString()
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      managerId: Number(formData.managerId),
      month: formData.month,
      product: formData.product || undefined,
      minPlan: Number(formData.minPlan),
      targetPlan: Number(formData.targetPlan),
      maxPlan: Number(formData.maxPlan)
    };

    if (editingId) {
      updatePlan.mutate({ id: editingId, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
          setIsOpen(false);
          resetForm();
        }
      });
    } else {
      createPlan.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
          setIsOpen(false);
          resetForm();
        }
      });
    }
  };

  const formatMoney = (val?: number | null) => val ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(val) : '-';

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-hidden space-y-6">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Monthly Planning</h1>
        <div className="flex gap-4">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48" />
          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Add Plan</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Plan" : "Create Plan"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingId && (
                  <div className="space-y-2">
                    <Label>Manager</Label>
                    <Select value={formData.managerId} onValueChange={v => setFormData({...formData, managerId: v})}>
                      <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                      <SelectContent>
                        {employees?.filter(e => e.role === "manager").map(emp => (
                          <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Month (YYYY-MM)</Label>
                  <Input value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Product / Category</Label>
                  <Input value={formData.product} onChange={e => setFormData({...formData, product: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Min Plan (₽)</Label>
                  <Input type="number" value={formData.minPlan} onChange={e => setFormData({...formData, minPlan: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Target Plan (₽)</Label>
                  <Input type="number" value={formData.targetPlan} onChange={e => setFormData({...formData, targetPlan: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Max Plan (₽)</Label>
                  <Input type="number" value={formData.maxPlan} onChange={e => setFormData({...formData, maxPlan: e.target.value})} required />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                  <Button type="submit">{editingId ? "Save" : "Create"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="h-full flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                <TableRow>
                  <TableHead>Manager</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Min Plan</TableHead>
                  <TableHead className="text-right">Target Plan</TableHead>
                  <TableHead className="text-right">Max Plan</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans?.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.managerName}</TableCell>
                    <TableCell>{plan.month}</TableCell>
                    <TableCell>{plan.product || "-"}</TableCell>
                    <TableCell className="text-right">{formatMoney(plan.minPlan)}</TableCell>
                    <TableCell className="text-right font-medium text-primary">{formatMoney(plan.targetPlan)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatMoney(plan.maxPlan)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)}><Edit2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {plans?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No plans for this month.</TableCell>
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
