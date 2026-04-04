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
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
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
import FeatureFlagManager from "./pages/FeatureFlagManager";
// Phase 5 — Enhancement A: UI Builder Admin [SUP-1]
import BuilderAdmin from "./pages/BuilderAdmin";
// Phase 6 — 20 Backlog Enhancements
import AIUsage from "./pages/AIUsage";
import FraudAlerts from "./pages/FraudAlerts";
import OnboardingWizard from "./pages/OnboardingWizard";
import KYCQueue from "./pages/KYCQueue";
import SubscriptionPlans from "./pages/SubscriptionPlans";
import BulkNotifications from "./pages/BulkNotifications";
import CustomDomains from "./pages/CustomDomains";
import DataExport from "./pages/DataExport";
import RBACEditor from "./pages/RBACEditor";
import WebhookManager from "./pages/WebhookManager";
import PlatformConfig from "./pages/PlatformConfig";
import InactiveTenants from "./pages/InactiveTenants";
import TenantImpersonation from "./pages/TenantImpersonation";

function ProtectedPage({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Login />;
  return (
    <ProtectedRoute requiredPermission={permission}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

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
      <Route path={"/forgot-password"} component={ForgotPassword} />
      <Route path={"/reset-password"} component={ResetPassword} />
      <Route path={"/unauthorized"} component={Unauthorized} />

      {/* Protected Routes */}
      <Route path={"/"}>
        <ProtectedPage>{isAuthenticated ? <Dashboard /> : <Login />}</ProtectedPage>
      </Route>

      <Route path={"/tenants"}>
        <ProtectedPage permission="manage:tenants"><TenantManagement /></ProtectedPage>
      </Route>

      <Route path={"/tenant-provisioning"}>
        <ProtectedPage permission="manage:tenants"><TenantProvisioning /></ProtectedPage>
      </Route>

      <Route path={"/modules"}>
        <ProtectedPage permission="manage:modules"><ModuleRegistry /></ProtectedPage>
      </Route>

      <Route path={"/billing"}>
        <ProtectedPage permission="view:billing"><Billing /></ProtectedPage>
      </Route>

      <Route path={"/analytics"}>
        <ProtectedPage><Analytics /></ProtectedPage>
      </Route>

      <Route path={"/health"}>
        <ProtectedPage permission="view:health"><SystemHealth /></ProtectedPage>
      </Route>

      <Route path={"/settings"}>
        <ProtectedPage permission="manage:settings"><SettingsPage /></ProtectedPage>
      </Route>

      {/* Phase 4 */}
      <Route path={"/partners"}>
        <ProtectedPage permission="manage:partners"><PartnerManagement /></ProtectedPage>
      </Route>

      <Route path={"/operations"}>
        <ProtectedPage permission="view:operations"><OperationsOverview /></ProtectedPage>
      </Route>

      <Route path={"/deployments"}>
        <ProtectedPage permission="manage:deployments"><DeploymentManager /></ProtectedPage>
      </Route>

      <Route path={"/feature-flags"}>
        <ProtectedPage permission="write:tenants"><FeatureFlagManager /></ProtectedPage>
      </Route>

      <Route path={"/audit-log"}>
        <ProtectedPage permission="manage:settings"><AuditLog /></ProtectedPage>
      </Route>

      <Route path={"/builder-admin"}>
        <ProtectedPage permission="manage:tenants"><BuilderAdmin /></ProtectedPage>
      </Route>

      {/* Phase 6 — 20 Backlog Enhancements */}
      <Route path={"/ai-usage"}>
        <ProtectedPage><AIUsage /></ProtectedPage>
      </Route>

      <Route path={"/fraud-alerts"}>
        <ProtectedPage permission="manage:security"><FraudAlerts /></ProtectedPage>
      </Route>

      <Route path={"/onboarding"}>
        <ProtectedPage permission="manage:tenants"><OnboardingWizard /></ProtectedPage>
      </Route>

      <Route path={"/kyc-queue"}>
        <ProtectedPage permission="manage:kyc"><KYCQueue /></ProtectedPage>
      </Route>

      <Route path={"/subscription-plans"}>
        <ProtectedPage permission="manage:billing"><SubscriptionPlans /></ProtectedPage>
      </Route>

      <Route path={"/bulk-notifications"}>
        <ProtectedPage permission="manage:notifications"><BulkNotifications /></ProtectedPage>
      </Route>

      <Route path={"/custom-domains"}>
        <ProtectedPage permission="manage:tenants"><CustomDomains /></ProtectedPage>
      </Route>

      <Route path={"/data-export"}>
        <ProtectedPage permission="manage:exports"><DataExport /></ProtectedPage>
      </Route>

      <Route path={"/rbac"}>
        <ProtectedPage permission="manage:rbac"><RBACEditor /></ProtectedPage>
      </Route>

      <Route path={"/webhooks"}>
        <ProtectedPage permission="manage:tenants"><WebhookManager /></ProtectedPage>
      </Route>

      <Route path={"/platform-config"}>
        <ProtectedPage permission="manage:settings"><PlatformConfig /></ProtectedPage>
      </Route>

      <Route path={"/inactive-tenants"}>
        <ProtectedPage permission="manage:tenants"><InactiveTenants /></ProtectedPage>
      </Route>

      <Route path={"/impersonation"}>
        <ProtectedPage permission="manage:tenants"><TenantImpersonation /></ProtectedPage>
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
