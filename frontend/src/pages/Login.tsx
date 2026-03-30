import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { useState } from 'react';
import { Mail, Lock, Loader2, ShieldCheck } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function Login() {
  const { t } = useTranslation();
  const { login, loginWithTotp, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [totpRequired, setTotpRequired] = useState(false);
  const [totpSessionToken, setTotpSessionToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const handleLogin = async () => {
    if (isSubmitting || isLoading) return;
    setIsSubmitting(true);
    setError('');
    try {
      const result = await login(email, password);
      if (result.requires_2fa && result.session_token) {
        setTotpRequired(true);
        setTotpSessionToken(result.session_token);
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Invalid email or password';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTotpSubmit = async () => {
    if (isSubmitting || isLoading) return;
    if (totpCode.length !== 6) { setError('Please enter a 6-digit code'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      await loginWithTotp(totpSessionToken, totpCode);
      navigate('/');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid authentication code';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      totpRequired ? handleTotpSubmit() : handleLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-lg mb-4">
            <span className="text-white font-bold text-lg">W</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">WebWaka</h1>
          <p className="text-slate-400">{t('auth.platformSubtitle')}</p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {totpRequired && <ShieldCheck className="h-5 w-5 text-blue-400" />}
              {totpRequired ? 'Two-Factor Verification' : t('auth.welcomeBack')}
            </CardTitle>
            <CardDescription>
              {totpRequired
                ? 'Enter the 6-digit code from your authenticator app'
                : t('auth.signInSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                  {error}
                </div>
              )}

              {!totpRequired ? (
                <>
                  {/* Email Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">
                      {t('auth.emailAddress')}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type="email"
                        placeholder="admin@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 text-white placeholder:text-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting || isLoading}
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-200">
                        {t('auth.password')}
                      </label>
                      <button
                        type="button"
                        onClick={() => navigate('/forgot-password')}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 text-white placeholder:text-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting || isLoading}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={isSubmitting || isLoading}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    {isSubmitting || isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('auth.signingIn')}
                      </>
                    ) : (
                      t('auth.signIn')
                    )}
                  </button>
                </>
              ) : (
                <>
                  {/* TOTP Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Authentication Code</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="000000"
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                        onKeyPress={handleKeyPress}
                        className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 text-white placeholder:text-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono tracking-widest text-lg"
                        disabled={isSubmitting || isLoading}
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTotpSubmit}
                    disabled={isSubmitting || isLoading || totpCode.length !== 6}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    {isSubmitting || isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify & Sign In'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setTotpRequired(false); setTotpCode(''); setError(''); }}
                    className="w-full px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    Back to login
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-slate-400 text-sm mt-6">
          © 2026 WebWaka. All rights reserved.
        </p>
      </div>
    </div>
  );
}
