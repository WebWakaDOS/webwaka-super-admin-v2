import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useTranslation } from '@/hooks/useTranslation';
import {
  LayoutDashboard,
  Users,
  Package,
  DollarSign,
  Settings,
  LogOut,
  BarChart3,
  AlertCircle,
  Handshake,
  Activity,
  Rocket,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  requiredRole?: string;
}

export function Sidebar() {
  const [location, navigate] = useLocation();
  const { logout, user } = useAuth();
  const { currentTenant } = useTenant();
  const { t } = useTranslation();

  const navItems: NavItem[] = [
    {
      label: t('nav.dashboard'),
      href: '/',
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      label: t('nav.tenants'),
      href: '/tenants',
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: t('nav.partners'),
      href: '/partners',
      icon: <Handshake className="h-5 w-5" />,
    },
    {
      label: t('nav.modules'),
      href: '/modules',
      icon: <Package className="h-5 w-5" />,
    },
    {
      label: t('nav.billing'),
      href: '/billing',
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      label: t('nav.operations'),
      href: '/operations',
      icon: <Activity className="h-5 w-5" />,
    },
    {
      label: t('nav.analytics'),
      href: '/analytics',
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      label: t('nav.deployments'),
      href: '/deployments',
      icon: <Rocket className="h-5 w-5" />,
    },
    {
      label: t('nav.health'),
      href: '/health',
      icon: <AlertCircle className="h-5 w-5" />,
    },
    {
      label: t('nav.settings'),
      href: '/settings',
      icon: <Settings className="h-5 w-5" />,
    },
    {
      label: t('nav.auditLog'),
      href: '/audit-log',
      icon: <ClipboardList className="h-5 w-5" />,
      requiredRole: 'super_admin',
    },
  ];

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">W</span>
          </div>
          <div>
            <h1 className="font-bold text-lg">WebWaka</h1>
            <p className="text-xs text-muted-foreground">Super Admin v2</p>
          </div>
        </div>
      </div>

      {/* Current Tenant */}
      {currentTenant && (
        <div className="px-6 py-4 border-b border-border">
          <p className="text-xs text-muted-foreground mb-1">Current Tenant</p>
          <p className="font-medium text-sm truncate">{currentTenant.name}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {navItems
          .filter((item) => !item.requiredRole || user?.role === item.requiredRole)
          .map((item) => (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              aria-current={location === item.href ? 'page' : undefined}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                location === item.href
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
      </nav>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-border space-y-3">
        <div className="px-3 py-2">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="text-sm font-medium truncate">{user?.email}</p>
          <p className="text-xs text-muted-foreground capitalize">{user?.role.replace('_', ' ')}</p>
        </div>
        <Button
          onClick={logout}
          variant="outline"
          className="w-full justify-start"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
