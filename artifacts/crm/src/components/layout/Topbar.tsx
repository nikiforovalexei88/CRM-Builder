import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useLogout } from "@workspace/api-client-react";
import { LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export function Topbar() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const logout = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(["/api/auth/me"], null);
        setLocation("/login");
      }
    });
  };

  const roleLabel = user?.role === "admin" ? "Руководитель" : "Менеджер";

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0 shadow-sm z-10 relative">
      <div className="flex-1"></div>
      
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <span className="text-sm font-semibold text-foreground leading-none">{user?.name}</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{roleLabel}</span>
        </div>
        <div className="h-8 w-px bg-border mx-2"></div>
        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive" title="Выйти">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
