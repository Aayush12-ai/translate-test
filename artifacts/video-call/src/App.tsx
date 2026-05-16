import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/authStore";
import { ProtectedRoute } from "@/components/protected-route";

import NotFound from "@/pages/not-found";
import { Join } from "@/pages/join";
import { Call } from "@/pages/call";
import { UserLoginPage } from "@/pages/user-login";
import { AdminLoginPage } from "@/pages/admin-login";
import { UserDashboardPage } from "@/pages/user-dashboard";
import { AdminDashboardPage } from "@/pages/admin-dashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function DashboardRedirect() {
  const [, navigate] = useLocation();
  const { user, isSessionReady } = useAuthStore();

  useEffect(() => {
    if (!isSessionReady) {
      return;
    }

    navigate(user ? (user.isAdmin ? "/admin/dashboard" : "/dashboard") : "/login");
  }, [isSessionReady, navigate, user]);

  return (
    <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
      Loading...
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardRedirect} />
      <Route path="/login" component={UserLoginPage} />
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route
        path="/dashboard"
        component={() => (
          <ProtectedRoute>
            <UserDashboardPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/admin/dashboard"
        component={() => (
          <ProtectedRoute requireAdmin>
            <AdminDashboardPage />
          </ProtectedRoute>
        )}
      />
      <Route path="/chat" component={DashboardRedirect} />
      <Route path="/join/:roomId" component={Join} />
      <Route path="/call/:roomId" component={Call} />
      <Route path="/call" component={DashboardRedirect} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Initialize authentication on app startup.
 * Ensures the session is checked before rendering protected routes.
 */
function AuthInitializer() {
  const { isSessionReady, refreshSession } = useAuthStore();

  useEffect(() => {
    if (!isSessionReady) {
      void refreshSession();
    }
  }, [isSessionReady, refreshSession]);

  return null;
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthInitializer />
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
