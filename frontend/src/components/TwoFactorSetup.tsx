import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, ShieldCheck, ShieldX, QrCode, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface TotpSetupData {
  secret: string;
  qr_url: string;
  backup_codes: string[];
}

interface TwoFactorSetupProps {
  enabled: boolean;
  onStatusChange: (enabled: boolean) => void;
}

export function TwoFactorSetup({ enabled, onStatusChange }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'disable'>('idle');
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStartSetup = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<TotpSetupData>('/auth/2fa/setup', {});
      if (res.success && res.data) {
        setSetupData(res.data);
        setStep('setup');
      } else {
        toast.error(res.error || 'Failed to start 2FA setup');
      }
    } catch {
      toast.error('Failed to start 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/2fa/verify', { code, secret: setupData?.secret });
      if (res.success) {
        toast.success('Two-factor authentication enabled');
        onStatusChange(true);
        setStep('idle');
        setCode('');
        setSetupData(null);
        apiClient.logAuditEvent('ENABLE_2FA', 'auth');
      } else {
        toast.error(res.error || 'Invalid code — please try again');
      }
    } catch {
      toast.error('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (code.length !== 6) {
      toast.error('Please enter your current 6-digit code to disable 2FA');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/2fa/disable', { code });
      if (res.success) {
        toast.success('Two-factor authentication disabled');
        onStatusChange(false);
        setStep('idle');
        setCode('');
        apiClient.logAuditEvent('DISABLE_2FA', 'auth');
      } else {
        toast.error(res.error || 'Invalid code — please try again');
      }
    } catch {
      toast.error('Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setStep('idle');
    setCode('');
    setSetupData(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {enabled ? (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          ) : (
            <Shield className="h-5 w-5 text-muted-foreground" />
          )}
          Two-Factor Authentication
          <Badge variant={enabled ? 'default' : 'secondary'} className="ml-2">
            {enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </CardTitle>
        <CardDescription>
          Add an extra layer of security using a TOTP authenticator app (Google Authenticator, Authy, etc.)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {step === 'idle' && (
          <div className="flex items-center gap-3">
            {enabled ? (
              <Button variant="destructive" size="sm" onClick={() => setStep('disable')}>
                <ShieldX className="h-4 w-4 mr-2" />
                Disable 2FA
              </Button>
            ) : (
              <Button size="sm" onClick={handleStartSetup} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
                Enable 2FA
              </Button>
            )}
          </div>
        )}

        {step === 'setup' && setupData && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <p className="text-sm font-medium">1. Scan the QR code with your authenticator app</p>
              <div className="flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qr_url)}`}
                  alt="TOTP QR Code"
                  className="rounded-md border"
                  width={180}
                  height={180}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Can't scan? Manual key: <code className="font-mono bg-background px-1 py-0.5 rounded text-xs select-all">{setupData.secret}</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="totp-code">2. Enter the 6-digit code from your app</Label>
              <div className="flex gap-2">
                <Input
                  id="totp-code"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-36 text-center font-mono tracking-widest"
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                />
                <Button onClick={handleVerify} disabled={loading || code.length !== 6}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Enable'}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </div>

            {setupData.backup_codes?.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">Save these backup codes in a safe place:</p>
                <div className="grid grid-cols-2 gap-1">
                  {setupData.backup_codes.map((c, i) => (
                    <code key={i} className="text-xs font-mono">{c}</code>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'disable' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter your current 6-digit authenticator code to confirm.</p>
            <div className="flex gap-2">
              <Input
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-36 text-center font-mono tracking-widest"
                onKeyDown={(e) => e.key === 'Enter' && handleDisable()}
              />
              <Button variant="destructive" onClick={handleDisable} disabled={loading || code.length !== 6}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disable 2FA'}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={loading}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
