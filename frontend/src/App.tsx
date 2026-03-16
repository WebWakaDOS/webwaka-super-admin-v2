import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./components/DashboardLayout";

// Pages
import Login from "./pages/Login";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import TenantManagement from "./pages/TenantManagement";
import Billing from "./pages/Billing";
import ModuleRegistry from "./pages/ModuleRegistry";
import SystemHealth from "./pages/SystemHealth";
import SettingsPage from "./pages/Settings";

const Analytics = () => <div className="p-6"><h1 className="text-2xl font-bold">Analytics</h1></div>;

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public Routes */}
      <Route path={"/login"} component={Login} />
      <Route path={"/unauthorized"} component={Unauthorized} />

      {/* Protected Routes */}
      <Route path={"/"}>
        {isAuthenticated ? (
          <ProtectedRoute>
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          </ProtectedRoute>
        ) : (
          <Login />
        )}
      </Route>

      <Route path={"/tenants"}>
        {isAuthenticated ? (
          <ProtectedRoute requiredPermission="manage:tenants">
            <DashboardLayout>
              <TenantManagement />
            </DashboardLayout>
          </ProtectedRoute>
        ) : (
          <Login />
        )}
      </Route>

      <Route path={"/modules"}>
        {isAuthenticated ? (
          <ProtectedRoute requiredPermission="manage:modules">
            <DashboardLayout>
              <ModuleRegistry />
            </DashboardLayout>
          </ProtectedRoute>
        ) : (
          <Login />
        )}
      </Route>

      <Route path={"/billing"}>
        {isAuthenticated ? (
          <ProtectedRoute requiredPermission="view:billing">
            <DashboardLayout>
              <Billing />
            </DashboardLayout>
          </ProtectedRoute>
        ) : (
          <Login />
        )}
      </Route>

      <Route path={"/analytics"}>
        {isAuthenticated ? (
          <ProtectedRoute>
            <DashboardLayout>
              <Analytics />
            </DashboardLayout>
          </ProtectedRoute>
        ) : (
          <Login />
        )}
      </Route>

      <Route path={"/health"}>
        {isAuthenticated ? (
          <ProtectedRoute requiredPermission="view:health">
            <DashboardLayout>
              <SystemHealth />
            </DashboardLayout>
          </ProtectedRoute>
        ) : (
          <Login />
        )}
      </Route>

      <Route path={"/settings"}>
        {isAuthenticated ? (
          <ProtectedRoute requiredPermission="manage:settings">
            <DashboardLayout>
              <SettingsPage />
            </DashboardLayout>
          </ProtectedRoute>
        ) : (
          <Login />
        )}
      </Route>

      {/* 404 */}
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TenantProvider>
            <Router hook={useHashLocation}>
              <TooltipProvider>
                <Toaster />
                <AppRouter />
              </TooltipProvider>
            </Router>
          </TenantProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
