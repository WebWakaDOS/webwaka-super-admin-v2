import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '@/lib/api';

// Shape returned by GET /tenants (workers/src/index.ts)
interface ApiTenantRow {
  id: string;
  name: string;
  email: string;
  status: string;
  industry?: string;
  domain?: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
  // Optional enriched fields that may be present in future API versions
  plan?: string;
  enabled_modules?: string;
  branding?: string | Record<string, unknown>;
  timezone?: string;
  currency?: string;
  language?: string;
  owner_id?: string;
  owner_name?: string;
}

interface TenantsApiResponse {
  tenants: ApiTenantRow[];
  pagination: { page: number; limit: number; total: number };
}

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

// Map frontend TenantConfig fields → API snake_case/uppercase for PUT /tenants/:id
// Only sends fields the backend TenantUpdateSchema accepts.
function toApiUpdatePayload(updates: Partial<TenantConfig>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.email !== undefined) payload.email = updates.email;
  if (updates.industry !== undefined) payload.industry = updates.industry;
  if (updates.domain !== undefined) payload.domain = updates.domain;
  if (updates.status !== undefined) payload.status = updates.status.toUpperCase();
  return payload;
}

function mapApiTenant(raw: ApiTenantRow): TenantConfig {
  const branding: TenantConfig['branding'] =
    raw.branding == null
      ? {}
      : typeof raw.branding === 'string'
      ? (JSON.parse(raw.branding) as TenantConfig['branding'])
      : (raw.branding as TenantConfig['branding']);

  const enabledModules: string[] = raw.enabled_modules
    ? (JSON.parse(raw.enabled_modules) as string[])
    : [];

  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    domain: raw.domain ?? `${raw.id}.webwaka.app`,
    status: normaliseStatus(raw.status || 'active'),
    plan: normalisePlan(raw.plan),
    industry: raw.industry,
    enabledModules,
    branding,
    settings: {
      timezone: raw.timezone ?? 'Africa/Lagos',
      currency: raw.currency ?? 'NGN',
      language: raw.language ?? 'en',
    },
    createdAt: raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updated_at ?? new Date().toISOString(),
    owner: {
      id: raw.owner_id ?? '',
      email: raw.email,
      name: raw.owner_name ?? raw.name,
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
      const res = await apiClient.get<TenantsApiResponse>('/tenants?limit=100');
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
    setError(null);
    const res = await apiClient.post<ApiTenantRow>('/tenants', {
      name: config.name,
      email: config.email,
      industry: config.industry,
      domain: config.domain,
    });
    if (!res.success || !res.data) {
      const msg = res.error || 'Failed to create tenant';
      setError(msg);
      throw new Error(msg);
    }
    // Refresh the full list so pagination and server-assigned fields are current.
    await fetchTenants();
    return mapApiTenant(res.data);
  };

  const updateTenant = async (tenantId: string, updates: Partial<TenantConfig>) => {
    setError(null);
    const payload = toApiUpdatePayload(updates);
    const res = await apiClient.put<ApiTenantRow>(`/tenants/${tenantId}`, payload);
    if (!res.success) {
      const msg = res.error || 'Failed to update tenant';
      setError(msg);
      throw new Error(msg);
    }
    // Merge server-returned row over existing state; fall back to optimistic
    // merge if the API returns no data body (e.g. bare 200 OK).
    const serverData: Partial<TenantConfig> = res.data
      ? mapApiTenant(res.data)
      : { ...updates, updatedAt: new Date().toISOString() };
    setTenants((prev) =>
      prev.map((t) => (t.id === tenantId ? { ...t, ...serverData } : t))
    );
    if (currentTenant?.id === tenantId) {
      setCurrentTenant((prev) => (prev ? { ...prev, ...serverData } : null));
    }
  };

  const deleteTenant = async (tenantId: string) => {
    setError(null);
    const res = await apiClient.delete(`/tenants/${tenantId}`);
    if (!res.success) {
      const msg = res.error || 'Failed to delete tenant';
      setError(msg);
      throw new Error(msg);
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
