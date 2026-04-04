import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
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
  Flag,
  Brain,
  ShieldAlert,
  UserPlus,
  FileCheck,
  CreditCard,
  Bell,
  Globe,
  Download,
  Shield,
  Webhook,
  Sliders,
  Archive,
  UserCog,
  X,
  ChevronDown,
  ChevronRight,
  Paintbrush,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: UserRole[];
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

interface SidebarProps {
  onClose?: () => void;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    defaultOpen: true,
    items: [
      { label: 'Dashboard', href: '/', icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: 'Analytics', href: '/analytics', icon: <BarChart3 className="h-4 w-4" />, roles: ['super_admin', 'partner'] },
      { label: 'Operations', href: '/operations', icon: <Activity className="h-4 w-4" />, roles: ['super_admin'] },
      { label: 'System Health', href: '/health', icon: <AlertCircle className="h-4 w-4" />, roles: ['super_admin', 'support'] },
    ],
  },
  {
    label: 'Tenant Management',
    defaultOpen: true,
    items: [
      { label: 'Tenants', href: '/tenants', icon: <Users className="h-4 w-4" />, roles: ['super_admin', 'support'] },
      { label: 'Onboarding Wizard', href: '/onboarding', icon: <UserPlus className="h-4 w-4" />, roles: ['super_admin'] },
      { label: 'Impersonation', href: '/impersonation', icon: <UserCog className="h-4 w-4" />, roles: ['super_admin', 'support'] },
      { label: 'Inactive Tenants', href: '/inactive-tenants', icon: <Archive className="h-4 w-4" />, roles: ['super_admin'] },
      { label: 'Feature Flags', href: '/feature-flags', icon: <Flag className="h-4 w-4" />, roles: ['super_admin'] },
      { label: 'Custom Domains', href: '/custom-domains', icon: <Globe className="h-4 w-4" />, roles: ['super_admin'] },
    ],
  },
  {
    label: 'Billing & Plans',
    defaultOpen: false,
    items: [
      { label: 'Billing', href: '/billing', icon: <DollarSign className="h-4 w-4" />, roles: ['super_admin', 'partner'] },
      { label: 'Subscription Plans', href: '/subscription-plans', icon: <CreditCard className="h-4 w-4" />, roles: ['super_admin'] },
    ],
  },
  {
    label: 'Security & Compliance',
    defaultOpen: false,
    items: [
      { label: 'Fraud Alerts', href: '/fraud-alerts', icon: <ShieldAlert className="h-4 w-4" />, roles: ['super_admin', 'support'] },
      { label: 'KYC Queue', href: '/kyc-queue', icon: <FileCheck className="h-4 w-4" />, roles: ['super_admin', 'support'] },
      { label: 'RBAC Editor', href: '/rbac', icon: <Shield className="h-4 w-4" />, roles: ['super_admin'] },
      { label: 'Audit Log', href: '/audit-log', icon: <ClipboardList className="h-4 w-4" />, roles: ['super_admin', 'support'] },
    ],
  },
  {
    label: 'AI & Usage',
    defaultOpen: false,
    items: [
      { label: 'AI Usage', href: '/ai-usage', icon: <Brain className="h-4 w-4" />, roles: ['super_admin', 'partner'] },
    ],
  },
  {
    label: 'Platform',
    defaultOpen: false,
    items: [
      { label: 'Modules', href: '/modules', icon: <Package className="h-4 w-4" />, roles: ['super_admin'] },
      { label: 'Partners', href: '/partners', icon: <Handshake className="h-4 w-4" />, roles: ['super_admin'] },
      { label: 'Deployments', href: '/deployments', icon: <Rocket className="h-4 w-4" />, roles: ['super_admin'] },
      { label: 'UI Builder', href: '/builder-admin', icon: <Paintbrush className="h-4 w-4" />, roles: ['super_admin'] },
      { label: 'Webhooks', href: '/webhooks', icon: <Webhook className="h-4 w-4" />, roles: ['super_admin'] },
      { label: 'Bulk Notifications', href: '/bulk-notifications', icon: <Bell className="h-4 w-4" />, roles: ['super_admin'] },
      { label: 'Data Export', href: '/data-export', icon: <Download className="h-4 w-4" />, roles: ['super_admin'] },
      { label: 'Platform Config', href: '/platform-config', icon: <Sliders className="h-4 w-4" />, roles: ['super_admin'] },
    ],
  },
  {
    label: 'Settings',
    defaultOpen: false,
    items: [
      { label: 'Settings', href: '/settings', icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

export function Sidebar({ onClose }: SidebarProps) {
  const [location, navigate] = useLocation();
  const { logout, user, hasRole } = useAuth();
  const { currentTenant } = useTenant();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const s = new Set<string>();
    NAV_GROUPS.forEach((g) => { if (g.defaultOpen) s.add(g.label); });
    return s;
  });

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const n = new Set(prev);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });
  }

  function canSeeItem(item: NavItem) {
    if (!item.roles) return true;
    return user ? item.roles.some((r) => hasRole(r)) : false;
  }

  function handleNav(href: string) {
    navigate(href);
    onClose?.();
  }

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-screen shrink-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-base">W</span>
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">WebWaka</h1>
            <p className="text-xs text-muted-foreground">Super Admin v2</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="lg:hidden h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Current Tenant */}
      {currentTenant && (
        <div className="px-4 py-2.5 border-b border-border shrink-0">
          <p className="text-xs text-muted-foreground">Current Tenant</p>
          <p className="font-medium text-sm truncate">{currentTenant.name}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(canSeeItem);
          if (visibleItems.length === 0) return null;
          const isOpen = openGroups.has(group.label);
          const hasActive = visibleItems.some((item) => location === item.href);

          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  'w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors',
                  hasActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {group.label}
                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>

              {isOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {visibleItems.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => handleNav(item.href)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        location === item.href
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Profile & Logout */}
      <div className="p-3 border-t border-border space-y-2 shrink-0">
        <div className="px-2 py-1">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="text-sm font-medium truncate">{user?.email}</p>
          <p className="text-xs text-muted-foreground capitalize">{user?.role.replace('_', ' ')}</p>
        </div>
        <Button
          onClick={logout}
          variant="outline"
          className="w-full justify-start text-sm h-9"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
