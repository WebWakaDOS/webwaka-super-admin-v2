import { ReactNode, useState, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const openSidebar = useCallback(() => setIsMobileOpen(true), []);
  const closeSidebar = useCallback(() => setIsMobileOpen(false), []);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — fixed on desktop, drawer on mobile */}
      <Sidebar isOpen={isMobileOpen} onClose={closeSidebar} />

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuToggle={openSidebar} />

        <main className="flex-1 overflow-auto">
          <div className="container mx-auto py-6 px-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
