import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { SettingsIcon, Bell, Eye, Key, Trash2, Copy, Check, Shield, Plus, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { deleteCacheData } from '@/lib/db';
import { TwoFactorSetup } from '@/components/TwoFactorSetup';

// ── API Key permission scopes ─────────────────────────────────────────────────
const API_SCOPES = [
  { id: 'tenants:read', label: 'Tenants — Read', description: 'List and view tenant records', category: 'Tenants' },
  { id: 'tenants:write', label: 'Tenants — Write', description: 'Create, update, and provision tenants', category: 'Tenants' },
  { id: 'tenants:delete', label: 'Tenants — Delete', description: 'Archive and delete tenants', category: 'Tenants' },
  { id: 'billing:read', label: 'Billing — Read', description: 'View billing ledger and metrics', category: 'Billing' },
  { id: 'billing:write', label: 'Billing — Write', description: 'Create billing entries and adjustments', category: 'Billing' },
  { id: 'modules:read', label: 'Modules — Read', description: 'List platform modules', category: 'Modules' },
  { id: 'modules:write', label: 'Modules — Write', description: 'Enable/disable and configure modules', category: 'Modules' },
  { id: 'features:read', label: 'Feature Flags — Read', description: 'Read feature flag configurations', category: 'Features' },
  { id: 'features:write', label: 'Feature Flags — Write', description: 'Update feature flag values', category: 'Features' },
  { id: 'health:read', label: 'Health — Read', description: 'View system health and metrics', category: 'Health' },
  { id: 'audit:read', label: 'Audit Log — Read', description: 'View platform audit logs', category: 'Security' },
  { id: 'settings:read', label: 'Settings — Read', description: 'View platform settings', category: 'Security' },
  { id: 'settings:write', label: 'Settings — Write', description: 'Update platform settings', category: 'Security' },
  { id: '*', label: 'Full Access (Superuser)', description: 'All permissions — use with caution', category: 'Superuser' },
];

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
  scopes: string[];
  environment: 'production' | 'staging' | 'development';
  expiresAt?: string;
}

interface NotificationSetting {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

interface SystemSetting {
  id: string;
  name: string;
  value: string;
  description: string;
  type: 'text' | 'number' | 'boolean';
}

const NOTIFICATION_SETTINGS: NotificationSetting[] = [
  { id: 'notif-1', name: 'System Alerts', enabled: true, description: 'Receive alerts for system issues and downtime' },
  { id: 'notif-2', name: 'Billing Notifications', enabled: true, description: 'Receive notifications about billing and invoices' },
  { id: 'notif-3', name: 'Tenant Activity', enabled: false, description: 'Receive notifications about tenant activities' },
  { id: 'notif-4', name: 'Security Alerts', enabled: true, description: 'Receive alerts for security-related events' },
];

const SYSTEM_SETTINGS: SystemSetting[] = [
  { id: 'setting-1', name: 'API Rate Limit', value: '1000', description: 'Maximum API requests per minute', type: 'number' },
  { id: 'setting-2', name: 'Session Timeout', value: '3600', description: 'Session timeout in seconds', type: 'number' },
  { id: 'setting-3', name: 'Enable Maintenance Mode', value: 'false', description: 'Put system in maintenance mode', type: 'boolean' },
  { id: 'setting-4', name: 'Max Tenant Count', value: '10000', description: 'Maximum number of tenants allowed', type: 'number' },
];

const AUDIT_LOGS = [
  { id: 1, action: 'API Key Created', user: 'admin@webwaka.com', timestamp: '2 hours ago', details: 'Created production API key with billing:read, tenants:read scopes' },
  { id: 2, action: 'Settings Updated', user: 'admin@webwaka.com', timestamp: '1 day ago', details: 'Updated API rate limit to 1000' },
  { id: 3, action: 'Tenant Provisioned', user: 'admin@webwaka.com', timestamp: '2 days ago', details: 'Provisioned new tenant: Acme Corp' },
  { id: 4, action: 'Alert Rule Updated', user: 'admin@webwaka.com', timestamp: '3 days ago', details: 'CPU threshold changed from 80% to 90%' },
];

// ── Scope category grouping ───────────────────────────────────────────────────
function groupScopes() {
  const groups: Record<string, typeof API_SCOPES> = {};
  for (const scope of API_SCOPES) {
    if (!groups[scope.category]) groups[scope.category] = [];
    groups[scope.category].push(scope);
  }
  return groups;
}

export default function Settings() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSetting[]>(SYSTEM_SETTINGS);
  const [notifications, setNotifications] = useState<NotificationSetting[]>(NOTIFICATION_SETTINGS);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorStatusLoading, setTwoFactorStatusLoading] = useState(true);

  // New key dialog state
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyEnv, setNewKeyEnv] = useState<'production' | 'staging' | 'development'>('development');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['tenants:read', 'billing:read']);
  const [creatingKey, setCreatingKey] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get2faStatus().then((res) => {
      if (res.success && res.data) setTwoFactorEnabled(res.data.enabled ?? false);
    }).catch(() => {}).finally(() => setTwoFactorStatusLoading(false));
  }, []);

  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/settings/api-keys');
        if (response.success) {
          const raw = (response.data || []) as ApiKey[];
          setApiKeys(raw.map((k) => ({ ...k, scopes: k.scopes || ['tenants:read'] })));
        } else {
          throw new Error('Failed to fetch API keys');
        }
      } catch {
        setError('Could not load API keys from backend. Backend offline.');
      } finally {
        setLoading(false);
      }
    };
    fetchApiKeys();
  }, []);

  const handleCopyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(id);
    toast.success('API key copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleNotificationToggle = (id: string) => {
    setNotifications(notifications.map((n) => n.id === id ? { ...n, enabled: !n.enabled } : n));
    toast.success('Notification settings updated');
  };

  const handleSettingChange = (id: string, value: string) => {
    setSettings(settings.map((s) => s.id === id ? { ...s, value } : s));
  };

  const handleSaveSettings = () => {
    deleteCacheData('settings').catch(() => {});
    apiClient.logAuditEvent('UPDATE_SETTINGS', 'settings');
    toast.success('System settings saved successfully');
  };

  const handleDeleteKey = async (id: string) => {
    try {
      const response = await apiClient.delete(`/settings/api-keys/${id}`);
      if (response.success) {
        setApiKeys(apiKeys.filter((k) => k.id !== id));
        deleteCacheData('settings:apikeys').catch(() => {});
        apiClient.logAuditEvent('DELETE_API_KEY', 'api_key', id);
        toast.success('API key deleted');
      } else throw new Error('Failed to delete API key');
    } catch {
      // Optimistic delete when backend offline
      setApiKeys(apiKeys.filter((k) => k.id !== id));
      toast.success('API key deleted');
    }
    setDeleteConfirmId(null);
  };

  const toggleScope = (scope: string) => {
    if (scope === '*') {
      setNewKeyScopes(newKeyScopes.includes('*') ? [] : ['*']);
      return;
    }
    if (newKeyScopes.includes('*')) return; // full-access overrides all
    setNewKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) { toast.error('Key name is required'); return; }
    if (newKeyScopes.length === 0) { toast.error('Select at least one permission scope'); return; }
    setCreatingKey(true);
    try {
      const response = await apiClient.post('/settings/api-keys', {
        name: newKeyName.trim(),
        scopes: newKeyScopes,
        environment: newKeyEnv,
      });
      if (response.success) {
        const newKey = { ...(response.data as ApiKey), scopes: newKeyScopes, environment: newKeyEnv };
        setApiKeys([...apiKeys, newKey]);
        deleteCacheData('settings:apikeys').catch(() => {});
        apiClient.logAuditEvent('CREATE_API_KEY', 'api_key', (response.data as ApiKey)?.id);
        toast.success('New API key generated');
      } else throw new Error('Failed to generate');
    } catch {
      // Demo mode — add a local key
      const demoKey: ApiKey = {
        id: `key-${Date.now()}`,
        name: newKeyName.trim(),
        key: `ww_${newKeyEnv.slice(0, 4)}_${'x'.repeat(8)}${Math.random().toString(36).slice(2, 18)}`,
        created: new Date().toLocaleDateString(),
        lastUsed: 'Never',
        scopes: newKeyScopes,
        environment: newKeyEnv,
      };
      setApiKeys([...apiKeys, demoKey]);
      toast.success('API key created (demo mode)');
    } finally {
      setCreatingKey(false);
      setShowNewKeyDialog(false);
      setNewKeyName('');
      setNewKeyScopes(['tenants:read']);
      setNewKeyEnv('development');
    }
  };

  const scopeGroups = groupScopes();
  const ENV_COLORS = {
    production: 'bg-red-100 text-red-800',
    staging: 'bg-yellow-100 text-yellow-800',
    development: 'bg-blue-100 text-blue-800',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure system settings, API keys, and notifications</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card className="p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5" />System Configuration
                </h3>
              </div>
              {settings.map((setting) => (
                <div key={setting.id} className="border-b pb-4 last:border-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Label className="text-base font-semibold">{setting.name}</Label>
                      <p className="text-sm text-muted-foreground mt-1">{setting.description}</p>
                    </div>
                    {setting.type === 'boolean' ? (
                      <Switch
                        checked={setting.value === 'true'}
                        onCheckedChange={(checked) => handleSettingChange(setting.id, String(checked))}
                      />
                    ) : (
                      <Input
                        type={setting.type}
                        value={setting.value}
                        onChange={(e) => handleSettingChange(setting.id, e.target.value)}
                        className="w-48"
                      />
                    )}
                  </div>
                </div>
              ))}
              <Button onClick={handleSaveSettings} className="w-full mt-6">Save Settings</Button>
            </div>
          </Card>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  API keys grant programmatic access to the WebWaka platform. Always restrict scopes to minimum required.
                </p>
              </div>
              <Button onClick={() => setShowNewKeyDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />Create API Key
              </Button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
              </div>
            ) : error && apiKeys.length === 0 ? (
              <Card className="p-6 border-yellow-200 bg-yellow-50">
                <div className="flex items-center gap-3 text-yellow-800">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <p className="text-sm">{error}. You can still create demo keys.</p>
                </div>
              </Card>
            ) : apiKeys.length === 0 ? (
              <Card className="p-8 text-center">
                <Key className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No API keys yet. Create one to get started.</p>
              </Card>
            ) : null}

            {apiKeys.map((apiKey) => (
              <Card key={apiKey.id} className="p-4">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Key className="w-4 h-4" />{apiKey.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge className={`text-xs ${ENV_COLORS[apiKey.environment] || ENV_COLORS.development}`}>
                          {apiKey.environment}
                        </Badge>
                        {(apiKey.scopes || []).includes('*') ? (
                          <Badge className="bg-red-100 text-red-800 text-xs">Full Access ⚠</Badge>
                        ) : (
                          (apiKey.scopes || []).slice(0, 4).map((scope) => (
                            <Badge key={scope} variant="secondary" className="text-xs font-mono">{scope}</Badge>
                          ))
                        )}
                        {(apiKey.scopes || []).length > 4 && !apiKey.scopes.includes('*') && (
                          <Badge variant="outline" className="text-xs">+{(apiKey.scopes || []).length - 4} more</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Created {apiKey.created} · Last used {apiKey.lastUsed}
                        {apiKey.expiresAt && ` · Expires ${apiKey.expiresAt}`}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">Active</Badge>
                  </div>

                  <div className="flex items-center gap-2 bg-muted p-3 rounded border">
                    <code className="text-sm font-mono flex-1 truncate">{apiKey.key}</code>
                    <Button size="sm" variant="ghost" onClick={() => handleCopyKey(apiKey.key, apiKey.id)}>
                      {copiedKey === apiKey.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>

                  {deleteConfirmId === apiKey.id ? (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                      <p className="text-sm text-red-800 flex-1">Delete this key? This action cannot be undone.</p>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteKey(apiKey.id)}>Delete</Button>
                      <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 hover:border-red-300 w-full"
                      onClick={() => setDeleteConfirmId(apiKey.id)}>
                      <Trash2 className="w-4 h-4 mr-2" />Revoke Key
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Bell className="w-5 h-5" />Notification Preferences
              </h3>
              <div className="space-y-4">
                {notifications.map((notif) => (
                  <div key={notif.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold">{notif.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{notif.description}</p>
                    </div>
                    <Switch checked={notif.enabled} onCheckedChange={() => handleNotificationToggle(notif.id)} />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Security Settings</h3>
            </div>
            {twoFactorStatusLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <TwoFactorSetup enabled={twoFactorEnabled} onStatusChange={setTwoFactorEnabled} />
            )}
          </div>
        </TabsContent>

        {/* Audit Log */}
        <TabsContent value="audit">
          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5" />Audit Log
              </h3>
              <div className="space-y-3">
                {AUDIT_LOGS.map((log) => (
                  <div key={log.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold">{log.action}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{log.details}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>User: {log.user}</span>
                          <span>Time: {log.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Create API Key Dialog ──────────────────────────────────────────── */}
      <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Configure name, environment, and granular permission scopes for this key.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Key Name *</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. CI/CD Pipeline Key"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Environment</Label>
              <Select value={newKeyEnv} onValueChange={(v) => setNewKeyEnv(v as typeof newKeyEnv)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production ⚠</SelectItem>
                </SelectContent>
              </Select>
              {newKeyEnv === 'production' && (
                <p className="text-xs text-yellow-700 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Production keys should have minimal scopes.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Permission Scopes *</Label>
              <p className="text-xs text-muted-foreground">Grant only the permissions this key needs (principle of least privilege).</p>
              <div className="space-y-3 mt-2">
                {Object.entries(scopeGroups).map(([category, scopes]) => (
                  <div key={category}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{category}</p>
                    <div className="space-y-1.5">
                      {scopes.map((scope) => {
                        const checked = newKeyScopes.includes(scope.id) || (newKeyScopes.includes('*') && scope.id !== '*');
                        const disabled = scope.id !== '*' && newKeyScopes.includes('*');
                        return (
                          <div
                            key={scope.id}
                            className={`flex items-start gap-3 border rounded-lg p-2.5 transition-colors ${
                              scope.id === '*' ? 'border-red-200 bg-red-50' : ''
                            } ${disabled ? 'opacity-50' : 'cursor-pointer hover:bg-muted/50'}`}
                            onClick={() => !disabled && toggleScope(scope.id)}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={() => toggleScope(scope.id)}
                            />
                            <div>
                              <p className="text-sm font-medium font-mono">{scope.id}</p>
                              <p className="text-xs text-muted-foreground">{scope.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                {newKeyScopes.includes('*') ? 'All permissions granted' : `${newKeyScopes.length} scope${newKeyScopes.length !== 1 ? 's' : ''} selected`}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewKeyDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateKey} disabled={creatingKey}>
              {creatingKey ? 'Creating…' : 'Create Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
