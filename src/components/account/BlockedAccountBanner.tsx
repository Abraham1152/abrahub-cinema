import { AlertTriangle, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface BlockedAccountBannerProps {
  reason?: string | null;
}

export function BlockedAccountBanner({ reason }: BlockedAccountBannerProps) {
  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
      <XCircle className="h-5 w-5" />
      <AlertTitle className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Conta Bloqueada
      </AlertTitle>
      <AlertDescription className="mt-2">
        {reason || 'Sua conta foi bloqueada devido a um chargeback ou reembolso de créditos.'}
        <br />
        <span className="text-sm opacity-80">
          Entre em contato com o suporte para mais informações.
        </span>
      </AlertDescription>
    </Alert>
  );
}
