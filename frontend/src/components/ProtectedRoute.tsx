import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { ReactNode } from 'react';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  requiredPermission?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole, hasPermission } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (requiredRole && !hasRole(requiredRole)) {
      navigate('/unauthorized');
    }
  }, [requiredRole, hasRole, navigate]);

  useEffect(() => {
    if (requiredPermission && !hasPermission(requiredPermission)) {
      navigate('/unauthorized');
    }
  }, [requiredPermission, hasPermission, navigate]);

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

  if (!isAuthenticated || (requiredRole && !hasRole(requiredRole)) || (requiredPermission && !hasPermission(requiredPermission))) {
    return null;
  }

  return <>{children}</>;
}
