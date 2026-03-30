import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types
export type UserRole = 'super_admin' | 'partner' | 'support' | 'tenant_admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId?: string;
  permissions: string[];
  avatar?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
  switchTenant: (tenantId: string) => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API base URL - evaluated at runtime to ensure correct endpoint is used
function getAPIBase() {
  if (typeof window === 'undefined') {
    return 'https://webwaka-super-admin-api.webwaka.workers.dev';
  }
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocalhost ? 'http://localhost:8787' : 'https://webwaka-super-admin-api.webwaka.workers.dev';
}
const API_BASE = getAPIBase();

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to restore auth state:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }

    setIsLoading(false);
  }, []);

  // Handle automatic session expiry triggered by 401/403 responses in the API client
  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const status = (event as CustomEvent<{ status: number }>).detail?.status;

      // Clear all local auth state immediately
      setUser(null);
      setToken(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');

      // Redirect: 403 means valid session but forbidden resource → /unauthorized
      //           401 means no valid session at all → /login
      if (status === 403) {
        window.location.hash = '#/unauthorized';
      } else {
        window.location.hash = '#/login';
      }
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const apiBase = getAPIBase();
      const response = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      
      // Use actual user data from API response
      const user: User = {
        id: data.user.id || 'user_001',
        email: data.user.email || email,
        name: data.user.name || 'Admin User',
        role: (data.user.role === 'super-admin' ? 'super_admin' : data.user.role) as UserRole,
        permissions: data.user.permissions || [],
        avatar: data.user.avatar,
        createdAt: data.user.createdAt || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };

      setUser(user);
      setToken(data.token);
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(user));
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    // Capture current token before clearing state
    const currentToken = token;

    // Clear local state immediately — the user is logged out from this point
    // regardless of whether the backend call succeeds
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');

    // Best-effort backend notification to allow server-side session invalidation
    if (currentToken) {
      try {
        const apiBase = getAPIBase();
        await fetch(`${apiBase}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Logout notification error:', error);
      }
    }
  };

  const hasPermission = (permission: string): boolean => {
    return user?.permissions.includes(permission) || false;
  };

  const hasRole = (role: UserRole): boolean => {
    if (!user) return false;
    return user.role === role;
  };

  const switchTenant = async (tenantId: string): Promise<void> => {
    if (user) {
      const updatedUser = { ...user, tenantId };
      setUser(updatedUser);
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user && !!token,
        token,
        login,
        logout,
        hasPermission,
        hasRole,
        switchTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
