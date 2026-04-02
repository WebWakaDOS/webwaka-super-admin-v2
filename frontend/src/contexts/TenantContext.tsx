import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '@/lib/api';
import { deleteCacheData } from '@/lib/db';

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
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CHURNED';
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

export const VALID_TRANSITIONS: Record<TenantConfig['status'], TenantConfig['status'][]> = {
  TRIAL:     ['ACTIVE', 'CHURNED'],
  ACTIVE:    ['SUSPENDED', 'CHURNED'],
  SUSPENDED: ['ACTIVE', 'CHURNED'],
  CHURNED:   [],
};

export function isValidStatusTransition(
  from: TenantConfig['status'],
  to: TenantConfig['status']
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function normaliseStatus(raw: string): TenantConfig['status'] {
  const s = raw.toUpperCase();
  if (s === 'ACTIVE') return 'ACTIVE';
  if (s === 'SUSPENDED') return 'SUSPENDED';
  if (s === 'TRIAL') return 'TRIAL';
  if (s === 'CHURNED') return 'CHURNED';
  // Map legacy values from pre-012 migrations
  if (s === 'PROVISIONING') return 'TRIAL';
  if (s === 'ARCHIVED') return 'CHURNED';
  return 'ACTIVE';
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

// Merge only the fields that PUT /tenants/:id actually returns
// (id, name, email, status, industry, domain, updated_at).
// This avoids clobbering existing fields (plan, branding, createdAt, etc.)
// that are omitted from the partial SELECT in the PUT handler.
function mergePartialRow(
  existing: TenantConfig,
  row: ApiTenantRow
): TenantConfig {
  return {
    ...existing,
    name: row.name ?? existing.name,
    email: row.email ?? existing.email,
    status: normaliseStatus(row.status ?? existing.status),
    industry: row.industry ?? existing.industry,
    domain: row.domain ?? existing.domain,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
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
    status: normaliseStatus(raw.status || 'ACTIVE'),
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
    setIsLoading(true);
    setError(null);
    try {
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
      const newTenant = mapApiTenant(res.data);
      // Refresh the full list so pagination and server-assigned fields are current.
      // If the refresh fails, the caller still gets the new tenant object and
      // the list will be refreshed on next mount.
      await fetchTenants();
      deleteCacheData('tenants:list').catch(() => {});
      apiClient.logAuditEvent('CREATE_TENANT', 'tenant', newTenant.id);
      return newTenant;
    } finally {
      setIsLoading(false);
    }
  };

  const updateTenant = async (tenantId: string, updates: Partial<TenantConfig>) => {
    setIsLoading(true);
    setError(null);
    try {
      if (updates.status !== undefined) {
        const existing = tenants.find((t) => t.id === tenantId);
        if (existing && !isValidStatusTransition(existing.status, updates.status!)) {
          const msg = `Invalid status transition: ${existing.status} → ${updates.status}`;
          setError(msg);
          setIsLoading(false);
          throw new Error(msg);
        }
      }
      const payload = toApiUpdatePayload(updates);
      const res = await apiClient.put<ApiTenantRow>(`/tenants/${tenantId}`, payload);
      if (!res.success) {
        const msg = res.error || 'Failed to update tenant';
        setError(msg);
        throw new Error(msg);
      }
      // Use mergePartialRow so only the fields the PUT response actually returns
      // (name, email, status, industry, domain, updated_at) are changed; rich
      // fields like plan/branding/createdAt are preserved from existing state.
      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenantId
            ? res.data
              ? mergePartialRow(t, res.data)
              : { ...t, ...updates, updatedAt: new Date().toISOString() }
            : t
        )
      );
      if (currentTenant?.id === tenantId) {
        setCurrentTenant((prev) =>
          prev
            ? res.data
              ? mergePartialRow(prev, res.data)
              : { ...prev, ...updates, updatedAt: new Date().toISOString() }
            : null
        );
      }
      deleteCacheData('tenants:list').catch(() => {});
      deleteCacheData(`tenants:${tenantId}`).catch(() => {});
      apiClient.logAuditEvent('UPDATE_TENANT', 'tenant', tenantId);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTenant = async (tenantId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.delete(`/tenants/${tenantId}`);
      if (!res.success) {
        const msg = res.error || 'Failed to delete tenant';
        setError(msg);
        throw new Error(msg);
      }
      // Use functional update so setTenants reads the freshest queued state,
      // not the closed-over snapshot. Derive the fallback from the same filter
      // applied to the current snapshot (consistent within a single sync call).
      setTenants((prev) => prev.filter((t) => t.id !== tenantId));
      if (currentTenant?.id === tenantId) {
        const next = tenants.filter((t) => t.id !== tenantId);
        setCurrentTenant(next[0] || null);
      }
      deleteCacheData('tenants:list').catch(() => {});
      deleteCacheData(`tenants:${tenantId}`).catch(() => {});
      apiClient.logAuditEvent('DELETE_TENANT', 'tenant', tenantId);
    } finally {
      setIsLoading(false);
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
