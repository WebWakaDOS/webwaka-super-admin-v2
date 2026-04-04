import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Settings, LogOut, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NotificationBell } from '@/components/NotificationBell';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const { tenants, currentTenant, switchTenant } = useTenant();

  return (
    <header className="h-16 bg-card border-b border-border px-4 lg:px-6 flex items-center justify-between shrink-0">
      {/* Mobile Menu Button + Search */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search Bar */}
        <div className="flex-1 max-w-md hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tenants, modules..."
              className="pl-10 bg-muted border-muted-foreground/20"
            />
          </div>
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-2 lg:gap-4 ml-2 shrink-0">
        {/* Language Switcher */}
        <div className="hidden md:block">
          <LanguageSwitcher />
        </div>

        {/* Notifications */}
        <NotificationBell />

        {/* Tenant Switcher */}
        {tenants.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 hidden md:flex max-w-[160px]">
                <span className="truncate">{currentTenant?.name || 'Select Tenant'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Switch Tenant</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {tenants.map((tenant) => (
                <DropdownMenuItem
                  key={tenant.id}
                  onClick={() => switchTenant(tenant.id)}
                  className={currentTenant?.id === tenant.id ? 'bg-muted' : ''}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{tenant.name}</span>
                    <span className="text-xs text-muted-foreground">{tenant.domain}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
                {user?.name.charAt(0).toUpperCase()}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.name}</span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
