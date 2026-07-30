import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarFooter } from "@/components/ui/sidebar";
import { Topbar } from "./Topbar";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, CreditCard, CalendarDays, Briefcase, Network } from "lucide-react";
import { cn } from "@/lib/utils";

const adminRoutes = [
  { path: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { path: "/leads", label: "Заявки", icon: Network },
  { path: "/payments", label: "Оплаты", icon: CreditCard },
  { path: "/planning", label: "Планы", icon: CalendarDays },
  { path: "/employees", label: "Сотрудники", icon: Users },
  { path: "/workspace", label: "Рабочий стол", icon: Briefcase },
];

const managerRoutes = [
  { path: "/workspace", label: "Рабочий стол", icon: Briefcase },
  { path: "/leads", label: "Заявки", icon: Network },
  { path: "/payments", label: "Оплаты", icon: CreditCard },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const routes = user.role === "admin" ? adminRoutes : managerRoutes;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar className="border-r border-sidebar-border bg-sidebar">
          <SidebarHeader className="h-14 flex items-center justify-center px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2 w-full font-bold text-lg text-primary tracking-tight">
              <Network className="w-5 h-5" />
              <span>CRM</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-2 py-4">
            <SidebarMenu>
              {routes.map((route) => {
                const isActive = location.startsWith(route.path);
                return (
                  <SidebarMenuItem key={route.path}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={route.label}>
                      <Link href={route.path} className={cn("flex items-center gap-3 px-3 py-2 w-full", isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium")}>
                        <route.icon className="w-4 h-4" />
                        <span>{route.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border p-4">
             <div className="text-xs text-muted-foreground font-mono">v1.0.0</div>
          </SidebarFooter>
        </Sidebar>
        
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-hidden relative">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
