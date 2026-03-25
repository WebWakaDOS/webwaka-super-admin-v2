import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth from localStorage — validate token against /auth/me
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    // Validate token server-side — do not trust localStorage blindly
    const validateToken = async () => {
      try {
        const apiBase = getAPIBase();
        const response = await fetch(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (response.ok) {
          // Token is valid — restore session
          const data = await response.json();
          const restoredUser: User = storedUser
            ? JSON.parse(storedUser)
            : {
                id: data.data?.userId || 'unknown',
                email: data.data?.email || '',
                name: data.data?.email || 'Admin',
                role: (data.data?.role === 'SUPERADMIN' ? 'super_admin' : data.data?.role) as UserRole,
                permissions: data.data?.permissions || [],
                createdAt: new Date().toISOString(),
              };
          setToken(storedToken);
          setUser(restoredUser);
        } else {
          // Token is expired or invalid — clear storage
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        }
      } catch {
        // Network error — restore from storage optimistically (offline support)
        if (storedUser) {
          try {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          } catch {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
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

      const json = await response.json();

      // Workers wraps responses in { success, data: { token, user } }
      const payload = json.data || json;
      const rawUser = payload.user || {};
      const token = payload.token;

      if (!token) throw new Error('No token received from server');

      // Use actual user data from API response
      const user: User = {
        id: rawUser.id || 'user_001',
        email: rawUser.email || email,
        name: rawUser.name || rawUser.email || 'Admin User',
        role: (rawUser.role === 'super-admin' || rawUser.role === 'SUPERADMIN'
          ? 'super_admin'
          : rawUser.role || 'super_admin') as UserRole,
        permissions: rawUser.permissions || [],
        avatar: rawUser.avatar,
        tenantId: rawUser.tenantId,
        createdAt: rawUser.createdAt || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };

      setUser(user);
      setToken(token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        const apiBase = getAPIBase();
        await fetch(`${apiBase}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
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
