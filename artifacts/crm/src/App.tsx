import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, Redirect, useLocation } from 'wouter';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/Shell';

import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import Leads from '@/pages/leads';
import Payments from '@/pages/payments';
import Workspace from '@/pages/workspace';
import Planning from '@/pages/planning';
import Employees from '@/pages/employees';

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="h-screen w-full flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) return <Redirect to="/login" />;
  if (adminOnly && user.role !== "admin") return <Redirect to="/workspace" />;

  return <Component />;
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="h-screen w-full flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) return <Redirect to="/login" />;
  
  return <Redirect to={user.role === "admin" ? "/dashboard" : "/workspace"} />;
}

function Router() {
  const [location] = useLocation();
  const isAuthRoute = location === "/login";

  if (isAuthRoute) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
      </Switch>
    );
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={RootRedirect} />
        <Route path="/dashboard"><ProtectedRoute component={Dashboard} adminOnly /></Route>
        <Route path="/leads"><ProtectedRoute component={Leads} /></Route>
        <Route path="/payments"><ProtectedRoute component={Payments} /></Route>
        <Route path="/workspace"><ProtectedRoute component={Workspace} /></Route>
        <Route path="/planning"><ProtectedRoute component={Planning} adminOnly /></Route>
        <Route path="/employees"><ProtectedRoute component={Employees} adminOnly /></Route>
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
