import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '@/lib/api';

export interface TenantConfig {
  id: string;
  name: string;
  email?: string;
  domain: string;
  status: 'active' | 'suspended' | 'provisioning' | 'archived';
  plan: 'starter' | 'professional' | 'enterprise';
  industry?: string;
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
  error: string | null;
  switchTenant: (tenantId: string) => void;
  createTenant: (config: Partial<TenantConfig>) => Promise<TenantConfig>;
  updateTenant: (tenantId: string, updates: Partial<TenantConfig>) => Promise<void>;
  deleteTenant: (tenantId: string) => Promise<void>;
  fetchTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

function normaliseStatus(raw: string): TenantConfig['status'] {
  const s = raw.toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'suspended') return 'suspended';
  if (s === 'provisioning') return 'provisioning';
  if (s === 'archived') return 'archived';
  return 'active';
}

function normalisePlan(raw: string | undefined): TenantConfig['plan'] {
  const p = (raw || 'starter').toLowerCase();
  if (p === 'professional' || p === 'pro') return 'professional';
  if (p === 'enterprise') return 'enterprise';
  return 'starter';
}

function mapApiTenant(raw: any): TenantConfig {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    domain: raw.domain || `${raw.id}.webwaka.app`,
    status: normaliseStatus(raw.status || 'active'),
    plan: normalisePlan(raw.plan),
    industry: raw.industry,
    enabledModules: raw.enabled_modules ? JSON.parse(raw.enabled_modules) : [],
    branding: raw.branding ? (typeof raw.branding === 'string' ? JSON.parse(raw.branding) : raw.branding) : {},
    settings: {
      timezone: raw.timezone || 'Africa/Lagos',
      currency: raw.currency || 'NGN',
      language: raw.language || 'en',
    },
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updated_at || raw.updatedAt || new Date().toISOString(),
    owner: raw.owner || {
      id: raw.owner_id || '',
      email: raw.email || '',
      name: raw.owner_name || raw.name || '',
    },
  };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<TenantConfig | null>(null);
  const [tenants, setTenants] = useState<TenantConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ tenants: any[]; pagination: any }>('/tenants?limit=100');
      if (res.success && res.data) {
        const mapped = (res.data.tenants || []).map(mapApiTenant);
        setTenants(mapped);

        const savedId = localStorage.getItem('current_tenant_id');
        const found = savedId ? mapped.find((t) => t.id === savedId) : null;
        setCurrentTenant(found || mapped[0] || null);
      } else {
        setError(res.error || 'Failed to load tenants');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants');
      console.error('Failed to fetch tenants:', err);
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
    const res = await apiClient.post('/tenants', {
      name: config.name,
      email: config.email,
      industry: config.industry,
      domain: config.domain,
    });
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to create tenant');
    }
    const newTenant = mapApiTenant(res.data);
    setTenants((prev) => [newTenant, ...prev]);
    return newTenant;
  };

  const updateTenant = async (tenantId: string, updates: Partial<TenantConfig>) => {
    const res = await apiClient.put(`/tenants/${tenantId}`, updates);
    if (!res.success) {
      throw new Error(res.error || 'Failed to update tenant');
    }
    setTenants((prev) =>
      prev.map((t) =>
        t.id === tenantId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      )
    );
    if (currentTenant?.id === tenantId) {
      setCurrentTenant((prev) =>
        prev ? { ...prev, ...updates, updatedAt: new Date().toISOString() } : null
      );
    }
  };

  const deleteTenant = async (tenantId: string) => {
    const res = await apiClient.delete(`/tenants/${tenantId}`);
    if (!res.success) {
      throw new Error(res.error || 'Failed to delete tenant');
    }
    setTenants((prev) => prev.filter((t) => t.id !== tenantId));
    if (currentTenant?.id === tenantId) {
      setCurrentTenant(tenants.find((t) => t.id !== tenantId) || null);
    }
  };

  const value: TenantContextType = {
    currentTenant,
    tenants,
    isLoading,
    error,
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

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
