import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function Unauthorized() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">{t('auth.unauthorized')}</h1>
        <p className="text-muted-foreground mb-6">
          {t('auth.unauthorizedMessage')}
        </p>
        <Button onClick={() => navigate('/')} className="w-full">
          {t('nav.dashboard')}
        </Button>
      </div>
    </div>
  );
}
