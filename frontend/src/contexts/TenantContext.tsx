import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types
export interface TenantConfig {
  id: string;
  name: string;
  domain: string;
  status: 'active' | 'suspended' | 'provisioning' | 'archived';
  plan: 'starter' | 'professional' | 'enterprise';
  enabledModules: string[];
  branding: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  settings: {
    timezone: string;
    currency: string;
    language: string;
  };
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    email: string;
    name: string;
  };
}

export interface TenantContextType {
  currentTenant: TenantConfig | null;
  tenants: TenantConfig[];
  isLoading: boolean;
  switchTenant: (tenantId: string) => void;
  createTenant: (config: Partial<TenantConfig>) => Promise<TenantConfig>;
  updateTenant: (tenantId: string, updates: Partial<TenantConfig>) => Promise<void>;
  deleteTenant: (tenantId: string) => Promise<void>;
  fetchTenants: () => Promise<void>;
}

// Create context
const TenantContext = createContext<TenantContextType | undefined>(undefined);

// Provider component
export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<TenantConfig | null>(null);
  const [tenants, setTenants] = useState<TenantConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load tenants on mount
  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    setIsLoading(true);
    try {
      // Mock data for demonstration
      const mockTenants: TenantConfig[] = [
        {
          id: 'tenant_001',
          name: 'Retail Store A',
          domain: 'retail-a.webwaka.app',
          status: 'active',
          plan: 'professional',
          enabledModules: ['COM-1', 'COM-2', 'COM-3', 'XCT-1', 'XCT-2'],
          branding: {
            logo: undefined,
            primaryColor: '#3B82F6',
            secondaryColor: '#10B981',
          },
          settings: {
            timezone: 'Africa/Lagos',
            currency: 'NGN',
            language: 'en',
          },
          createdAt: '2026-01-15T10:00:00Z',
          updatedAt: '2026-03-15T12:00:00Z',
          owner: {
            id: 'user_101',
            email: 'owner@retaila.com',
            name: 'John Doe',
          },
        },
        {
          id: 'tenant_002',
          name: 'Transport Company B',
          domain: 'transport-b.webwaka.app',
          status: 'active',
          plan: 'enterprise',
          enabledModules: ['TRN-1', 'TRN-2', 'TRN-3', 'TRN-4', 'LOG-1', 'LOG-2'],
          branding: {
            logo: undefined,
            primaryColor: '#DC2626',
            secondaryColor: '#F59E0B',
          },
          settings: {
            timezone: 'Africa/Lagos',
            currency: 'NGN',
            language: 'en',
          },
          createdAt: '2026-02-01T08:30:00Z',
          updatedAt: '2026-03-14T15:45:00Z',
          owner: {
            id: 'user_102',
            email: 'owner@transportb.com',
            name: 'Jane Smith',
          },
        },
      ];

      setTenants(mockTenants);
      if (mockTenants.length > 0) {
        setCurrentTenant(mockTenants[0]);
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const switchTenant = (tenantId: string) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (tenant) {
      setCurrentTenant(tenant);
      localStorage.setItem('current_tenant_id', tenantId);
    }
  };

  const createTenant = async (config: Partial<TenantConfig>): Promise<TenantConfig> => {
    const newTenant: TenantConfig = {
      id: 'tenant_' + Date.now(),
      name: config.name || 'New Tenant',
      domain: config.domain || `tenant-${Date.now()}.webwaka.app`,
      status: 'provisioning',
      plan: config.plan || 'starter',
      enabledModules: config.enabledModules || [],
      branding: config.branding || {},
      settings: config.settings || {
        timezone: 'Africa/Lagos',
        currency: 'NGN',
        language: 'en',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      owner: config.owner || {
        id: 'user_unknown',
        email: 'unknown@example.com',
        name: 'Unknown',
      },
    };

    setTenants([...tenants, newTenant]);
    return newTenant;
  };

  const updateTenant = async (tenantId: string, updates: Partial<TenantConfig>) => {
    setTenants(
      tenants.map((t) =>
        t.id === tenantId
          ? { ...t, ...updates, updatedAt: new Date().toISOString() }
          : t
      )
    );

    if (currentTenant?.id === tenantId) {
      setCurrentTenant({
        ...currentTenant,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const deleteTenant = async (tenantId: string) => {
    setTenants(tenants.filter((t) => t.id !== tenantId));
    if (currentTenant?.id === tenantId) {
      setCurrentTenant(tenants[0] || null);
    }
  };

  const value: TenantContextType = {
    currentTenant,
    tenants,
    isLoading,
    switchTenant,
    createTenant,
    updateTenant,
    deleteTenant,
    fetchTenants,
  };

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

// Hook to use tenant context
export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
