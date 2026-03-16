import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { AlertCircle } from 'lucide-react';

export default function Unauthorized() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">
          You don't have permission to access this resource. If you believe this is an error, please contact your administrator.
        </p>
        <Button onClick={() => navigate('/')} className="w-full">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
