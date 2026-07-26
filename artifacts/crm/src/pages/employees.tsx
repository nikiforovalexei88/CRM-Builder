import { useListEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Employees() {
  const { data: employees, isLoading } = useListEmployees();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const createEmp = useCreateEmployee();
  const updateEmp = useUpdateEmployee();
  const deleteEmp = useDeleteEmployee();
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
    maxPlan: ""
  });

  const resetForm = () => {
    setFormData({ name: "", username: "", password: "", role: "manager", salary: "", baseBonus: "", multiplier: "", minPlan: "", targetPlan: "", maxPlan: "" });
    setEditingId(null);
  };

  const handleEdit = (emp: any) => {
    setEditingId(emp.id);
    setFormData({
      name: emp.name,
      username: emp.username,
      password: "",
      role: emp.role,
      salary: emp.salary?.toString() || "",
      baseBonus: emp.baseBonus?.toString() || "",
      multiplier: emp.multiplier?.toString() || "",
      minPlan: emp.minPlan?.toString() || "",
      targetPlan: emp.targetPlan?.toString() || "",
      maxPlan: emp.maxPlan?.toString() || ""
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

    if (editingId) {
      updateEmp.mutate({ id: editingId, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
          setIsOpen(false);
          resetForm();
        }
      });
    } else {
      createEmp.mutate({ data: payload as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
          setIsOpen(false);
          resetForm();
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this employee?")) {
      deleteEmp.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/employees"] })
      });
    }
  };

  const formatMoney = (val?: number | null) => val ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(val) : '-';

  if (isLoading) return <div className="h-full flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-hidden space-y-6">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Employee</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Employee" : "Add Employee"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Password {editingId && "(Leave blank to keep)"}</Label>
                <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!editingId} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Salary</Label>
                <Input type="number" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Base Bonus</Label>
                <Input type="number" value={formData.baseBonus} onChange={e => setFormData({...formData, baseBonus: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Multiplier</Label>
                <Input type="number" step="0.1" value={formData.multiplier} onChange={e => setFormData({...formData, multiplier: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Min Plan</Label>
                <Input type="number" value={formData.minPlan} onChange={e => setFormData({...formData, minPlan: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Target Plan</Label>
                <Input type="number" value={formData.targetPlan} onChange={e => setFormData({...formData, targetPlan: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Max Plan</Label>
                <Input type="number" value={formData.maxPlan} onChange={e => setFormData({...formData, maxPlan: e.target.value})} />
              </div>
              <div className="col-span-2 flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button type="submit">{editingId ? "Save Changes" : "Create"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Min Plan</TableHead>
                <TableHead>Target Plan</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees?.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell><span className="uppercase text-xs tracking-wider bg-secondary text-secondary-foreground px-2 py-1 rounded-full">{emp.role}</span></TableCell>
                  <TableCell className="font-mono text-xs">{emp.username}</TableCell>
                  <TableCell>{formatMoney(emp.salary)}</TableCell>
                  <TableCell>{formatMoney(emp.minPlan)}</TableCell>
                  <TableCell>{formatMoney(emp.targetPlan)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(emp)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(emp.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {employees?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No employees found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
