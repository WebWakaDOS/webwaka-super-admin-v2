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
import { OfflineBanner } from "./components/OfflineBanner";

// Pages
import Login from "./pages/Login";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import TenantManagement from "./pages/TenantManagement";
import TenantProvisioning from "./pages/TenantProvisioning";
import Billing from "./pages/Billing";
import ModuleRegistry from "./pages/ModuleRegistry";
import SystemHealth from "./pages/SystemHealth";
import SettingsPage from "./pages/Settings";
import Analytics from "./pages/Analytics";
import AuditLog from "./pages/AuditLog";
// Phase 4 — New Pages
import PartnerManagement from "./pages/PartnerManagement";
import OperationsOverview from "./pages/OperationsOverview";
import DeploymentManager from "./pages/DeploymentManager";

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

      <Route path={"/tenant-provisioning"}>
        {isAuthenticated ? (
          <ProtectedRoute requiredPermission="manage:tenants">
            <DashboardLayout>
              <TenantProvisioning />
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

      {/* Phase 4 — New Routes */}
      <Route path={"/partners"}>
        {isAuthenticated ? (
          <ProtectedRoute requiredPermission="manage:partners">
            <DashboardLayout>
              <PartnerManagement />
            </DashboardLayout>
          </ProtectedRoute>
        ) : (
          <Login />
        )}
      </Route>

      <Route path={"/operations"}>
        {isAuthenticated ? (
          <ProtectedRoute requiredPermission="view:operations">
            <DashboardLayout>
              <OperationsOverview />
            </DashboardLayout>
          </ProtectedRoute>
        ) : (
          <Login />
        )}
      </Route>

      <Route path={"/deployments"}>
        {isAuthenticated ? (
          <ProtectedRoute requiredPermission="manage:deployments">
            <DashboardLayout>
              <DeploymentManager />
            </DashboardLayout>
          </ProtectedRoute>
        ) : (
          <Login />
        )}
      </Route>

      {/* Audit Log */}
      <Route path={"/audit-log"}>
        {isAuthenticated ? (
          <ProtectedRoute requiredPermission="manage:settings">
            <DashboardLayout>
              <AuditLog />
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
                <OfflineBanner />
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
