import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { apiClient } from '@/lib/api';

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
  // token is always null — the JWT now lives in an HttpOnly cookie and is
  // inaccessible to JavaScript. Field is kept for interface backward compatibility.
  token: string | null;
  login: (email: string, password: string) => Promise<{ requires_2fa?: boolean; session_token?: string }>;
  loginWithTotp: (sessionToken: string, code: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
  switchTenant: (tenantId: string) => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API base URL - use /api relative path so Vite proxy forwards to the backend.
function getAPIBase() {
  return '/api';
}

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending refresh timer
  const clearRefreshTimer = () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  // Schedule a token refresh based on the cookie's expiry timestamp (unix seconds).
  // Fires at (expiry - 60 min), or immediately if < 60 min remain.
  // The browser sends the HttpOnly cookie automatically on the refresh request.
  const scheduleTokenRefresh = (tokenExpiresAt: number) => {
    clearRefreshTimer();
    const nowSec = Math.floor(Date.now() / 1000);
    const msUntilRefresh = Math.max(0, (tokenExpiresAt - nowSec - 3600) * 1000);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.refreshToken();
        if (res.success && res.data?.tokenExpiresAt) {
          scheduleTokenRefresh(res.data.tokenExpiresAt);
        } else {
          // Refresh failed — force re-login
          window.dispatchEvent(new CustomEvent('auth:session-expired', { detail: { status: 401 } }));
        }
      } catch (err) {
        console.error('Token refresh error:', err);
      }
    }, msUntilRefresh);
  };

  // Initialize auth state by validating the HttpOnly cookie server-side.
  // No localStorage read for the token — the browser sends the cookie automatically.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        // Validate the cookie server-side — this is the source of truth.
        // credentials: 'include' is set on apiClient globally so the cookie is sent.
        const meRes = await apiClient.getMe();
        if (cancelled) return;

        if (!meRes.success || !meRes.data) {
          // No valid cookie — user must log in
          localStorage.removeItem('auth_user');
          if (!cancelled) setIsLoading(false);
          return;
        }

        const serverUser = meRes.data;
        const freshUser: User = {
          id: serverUser.id,
          email: serverUser.email,
          name: serverUser.name || serverUser.email?.split('@')[0] || 'Admin',
          role: (serverUser.role === 'super-admin' ? 'super_admin' : serverUser.role) as UserRole,
          permissions: serverUser.permissions || [],
          avatar: serverUser.avatar,
          createdAt: serverUser.createdAt || new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };

        apiClient.setUserId(freshUser.id);
        setUser(freshUser);
        localStorage.setItem('auth_user', JSON.stringify(freshUser));

        if (serverUser.tokenExpiresAt) {
          scheduleTokenRefresh(serverUser.tokenExpiresAt);
        }
      } catch (error) {
        if (cancelled) return;
        // Network failure or 401 — clear stale user cache
        console.error('Failed to restore auth state:', error);
        localStorage.removeItem('auth_user');
      }

      if (!cancelled) setIsLoading(false);
    };

    init();

    return () => {
      cancelled = true;
      clearRefreshTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle automatic session expiry triggered by 401/403 responses in the API client
  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const status = (event as CustomEvent<{ status: number }>).detail?.status;

      clearRefreshTimer();
      apiClient.setUserId(null);

      setUser(null);
      localStorage.removeItem('auth_user');

      // Redirect: 403 → /unauthorized, 401 → /login
      if (status === 403) {
        window.location.hash = '#/unauthorized';
      } else {
        window.location.hash = '#/login';
      }
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);

  // Called after a successful login or 2FA validation.
  // The JWT is now in the HttpOnly cookie set by the server — we only handle
  // the user profile and the refresh schedule here.
  const applyLoginData = (
    data: {
      tokenExpiresAt?: number;
      user: {
        id?: string;
        email?: string;
        name?: string;
        role?: string;
        permissions?: string[];
        avatar?: string;
        createdAt?: string;
        tenantId?: string;
      };
    },
    email: string
  ) => {
    const freshUser: User = {
      id: data.user.id || 'user_001',
      email: data.user.email || email,
      name: data.user.name || 'Admin User',
      role: (data.user.role === 'super-admin' ? 'super_admin' : data.user.role) as UserRole,
      permissions: data.user.permissions || [],
      avatar: data.user.avatar,
      createdAt: data.user.createdAt || new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    apiClient.setUserId(freshUser.id);
    setUser(freshUser);
    localStorage.setItem('auth_user', JSON.stringify(freshUser));
    if (data.tokenExpiresAt) {
      scheduleTokenRefresh(data.tokenExpiresAt);
    }
  };

  const login = async (email: string, password: string): Promise<{ requires_2fa?: boolean; session_token?: string }> => {
    setIsLoading(true);
    try {
      const apiBase = getAPIBase();
      // credentials: 'include' causes the browser to store the Set-Cookie from the response
      const response = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      // Response envelope: { success: true, data: { tokenExpiresAt, user } }
      const raw = await response.json();
      const data = raw.data ?? raw;

      if (data.requires_2fa) {
        return { requires_2fa: true, session_token: data.session_token };
      }

      applyLoginData(data, email);
      return {};
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithTotp = async (sessionToken: string, code: string): Promise<void> => {
    setIsLoading(true);
    try {
      const apiBase = getAPIBase();
      const response = await fetch(`${apiBase}/auth/2fa/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ session_token: sessionToken, code }),
      });

      if (!response.ok) {
        throw new Error('Invalid 2FA code');
      }

      const raw = await response.json();
      const data = raw.data ?? raw;
      applyLoginData(data, data.user?.email ?? '');
    } catch (error) {
      console.error('2FA error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    clearRefreshTimer();
    apiClient.setUserId(null);

    // Clear local state immediately
    setUser(null);
    localStorage.removeItem('auth_user');

    // Best-effort: ask the server to clear the HttpOnly cookie.
    // credentials: 'include' causes the browser to send the cookie so the server
    // can identify the session, and the server responds with Set-Cookie: Max-Age=0.
    try {
      const apiBase = getAPIBase();
      await fetch(`${apiBase}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout notification error:', error);
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
        // Authenticated when a valid user object exists (cookie validated server-side).
        isAuthenticated: !!user,
        // Always null — JWT lives in an HttpOnly cookie, not accessible to JS.
        token: null,
        login,
        loginWithTotp,
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
