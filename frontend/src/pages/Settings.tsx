import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { SettingsIcon, Lock, Bell, Eye, Key, Trash2, Copy, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
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
  {
    id: 'notif-1',
    name: 'System Alerts',
    enabled: true,
    description: 'Receive alerts for system issues and downtime',
  },
  {
    id: 'notif-2',
    name: 'Billing Notifications',
    enabled: true,
    description: 'Receive notifications about billing and invoices',
  },
  {
    id: 'notif-3',
    name: 'Tenant Activity',
    enabled: false,
    description: 'Receive notifications about tenant activities',
  },
  {
    id: 'notif-4',
    name: 'Security Alerts',
    enabled: true,
    description: 'Receive alerts for security-related events',
  },
];

const SYSTEM_SETTINGS: SystemSetting[] = [
  {
    id: 'setting-1',
    name: 'API Rate Limit',
    value: '1000',
    description: 'Maximum API requests per minute',
    type: 'number',
  },
  {
    id: 'setting-2',
    name: 'Session Timeout',
    value: '3600',
    description: 'Session timeout in seconds',
    type: 'number',
  },
  {
    id: 'setting-3',
    name: 'Enable Maintenance Mode',
    value: 'false',
    description: 'Put system in maintenance mode',
    type: 'boolean',
  },
  {
    id: 'setting-4',
    name: 'Max Tenant Count',
    value: '10000',
    description: 'Maximum number of tenants allowed',
    type: 'number',
  },
];

const AUDIT_LOGS = [
  {
    id: 1,
    action: 'API Key Created',
    user: 'admin@webwaka.com',
    timestamp: '2 hours ago',
    details: 'Created production API key',
  },
  {
    id: 2,
    action: 'Settings Updated',
    user: 'admin@webwaka.com',
    timestamp: '1 day ago',
    details: 'Updated API rate limit to 1000',
  },
  {
    id: 3,
    action: 'Tenant Provisioned',
    user: 'admin@webwaka.com',
    timestamp: '2 days ago',
    details: 'Provisioned new tenant: Acme Corp',
  },
  {
    id: 4,
    action: 'System Maintenance',
    user: 'system',
    timestamp: '3 days ago',
    details: 'Scheduled maintenance completed',
  },
];

export default function Settings() {
  const { t } = useTranslation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSetting[]>(SYSTEM_SETTINGS);
  const [notifications, setNotifications] = useState<NotificationSetting[]>(NOTIFICATION_SETTINGS);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/settings/api-keys');
        if (response.success) {
          setApiKeys((response.data as ApiKey[]) || []);
        } else {
          throw new Error('Failed to fetch API keys');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch API keys';
        setError(errorMessage);
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
    setNotifications(
      notifications.map((notif) =>
        notif.id === id ? { ...notif, enabled: !notif.enabled } : notif
      )
    );
    toast.success('Notification settings updated');
  };

  const handleSettingChange = (id: string, value: string) => {
    setSettings(
      settings.map((setting) =>
        setting.id === id ? { ...setting, value } : setting
      )
    );
  };

  const handleSaveSettings = () => {
    toast.success('System settings saved successfully');
  };

  const handleDeleteKey = async (id: string) => {
    try {
      const response = await apiClient.delete(`/settings/api-keys/${id}`);
      if (response.success) {
        setApiKeys(apiKeys.filter(key => key.id !== id));
        toast.success('API key deleted');
      } else {
        throw new Error('Failed to delete API key');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete API key';
      toast.error(errorMessage);
    }
  };

  const handleGenerateKey = async () => {
    try {
      const response = await apiClient.post('/settings/api-keys', {
        name: `API Key ${new Date().toLocaleDateString()}`,
      });
      if (response.success) {
        setApiKeys([...apiKeys, response.data as ApiKey]);
        toast.success('New API key generated');
      } else {
        throw new Error('Failed to generate API key');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate API key';
      toast.error(errorMessage);
    }
  };

  return (
    <div className="space-y-6" role="main">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
        <p className="text-gray-400 mt-1">Configure system settings, API keys, and notifications</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general">
          <Card className="p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5" />
                  System Configuration
                </h3>
              </div>

              {settings.map((setting) => (
                <div key={setting.id} className="border-b border-gray-700 pb-4 last:border-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Label className="text-base font-semibold">{setting.name}</Label>
                      <p className="text-sm text-gray-400 mt-1">{setting.description}</p>
                    </div>
                    {setting.type === 'boolean' ? (
                      <Switch
                        checked={setting.value === 'true'}
                        onCheckedChange={(checked) =>
                          handleSettingChange(setting.id, String(checked))
                        }
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

              <Button onClick={handleSaveSettings} className="w-full mt-6">
                Save Settings
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleGenerateKey}>Generate New Key</Button>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-400">Loading API keys...</p>
              </div>
            ) : error ? (
              <Card className="p-6 border-red-500 bg-red-500/10">
                <p className="text-red-400">Error: {error}</p>
              </Card>
            ) : apiKeys.length === 0 ? (
              <Card className="p-6">
                <p className="text-gray-400 text-center">No API keys created yet. Click "Generate New Key" to create one.</p>
              </Card>
            ) : null}

            {!loading && apiKeys.map((apiKey) => (
              <Card key={apiKey.id} className="p-4">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        {apiKey.name}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">Created: {apiKey.created}</p>
                      <p className="text-sm text-gray-400">Last used: {apiKey.lastUsed}</p>
                    </div>
                    <Badge variant="outline">Active</Badge>
                  </div>

                  <div className="flex items-center gap-2 bg-gray-900/50 p-3 rounded border border-gray-700">
                    <code className="text-sm font-mono text-gray-300 flex-1 truncate">
                      {apiKey.key}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyKey(apiKey.key, apiKey.id)}
                    >
                      {copiedKey === apiKey.id ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteKey(apiKey.id)}
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Key
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Preferences
              </h3>

              <div className="space-y-4">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="flex items-center justify-between p-4 border border-gray-700 rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{notif.name}</h4>
                      <p className="text-sm text-gray-400 mt-1">{notif.description}</p>
                    </div>
                    <Switch
                      checked={notif.enabled}
                      onCheckedChange={() => handleNotificationToggle(notif.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Audit Log
              </h3>

              <div className="space-y-3">
                {AUDIT_LOGS.map((log) => (
                  <div key={log.id} className="p-4 border border-gray-700 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold">{log.action}</h4>
                        <p className="text-sm text-gray-400 mt-1">{log.details}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
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
    </div>
  );
}
