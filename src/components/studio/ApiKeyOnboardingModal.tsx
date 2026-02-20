import { useState } from 'react';
import { Key, ExternalLink, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface ApiKeyOnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKeyValidated: () => void;
}

export function ApiKeyOnboardingModal({ open, onOpenChange, onKeyValidated }: ApiKeyOnboardingModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleClose = () => {
    localStorage.setItem('byok_onboarding_seen', 'true');
    onOpenChange(false);
  };

  const handleValidate = async () => {
    if (!apiKey.trim() || apiKey.trim().length < 10) {
      setStatus('error');
      setErrorMessage('API key muito curta. Verifique e tente novamente.');
      return;
    }

    setStatus('validating');
    setErrorMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('validate-api-key', {
        body: { apiKey: apiKey.trim() },
      });

      if (error) {
        // Para FunctionsHttpError, a mensagem amigável está no corpo da resposta
        let msg = 'Erro ao validar. Tente novamente.';
        try {
          const errorBody = await error.context?.json();
          msg = errorBody?.error || msg;
        } catch {
          msg = error.message || msg;
        }
        setStatus('error');
        setErrorMessage(msg);
        return;
      }

      if (data?.success) {
        setStatus('success');
        localStorage.setItem('byok_onboarding_seen', 'true');
        onKeyValidated();
        setTimeout(() => onOpenChange(false), 1500);
      } else {
        setStatus('error');
        setErrorMessage(data?.error || 'API key inválida.');
      }
    } catch (err) {
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Erro ao validar. Tente novamente.';
      setErrorMessage(errorMessage);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#1a1a1a] border-white/10">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Key className="h-5 w-5 text-emerald-400" />
            </div>
            <DialogTitle className="text-lg text-white">
              Gere imagens ilimitadas com sua própria API
            </DialogTitle>
          </div>
          <DialogDescription className="text-white/60">
            Cole sua API key do Google AI Studio para desbloquear gerações ilimitadas sem gastar créditos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Cole sua API key aqui..."
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                if (status === 'error') setStatus('idle');
              }}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              disabled={status === 'validating' || status === 'success'}
            />

            {status === 'error' && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <XCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {status === 'success' && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>API key validada e salva com sucesso!</span>
              </div>
            )}

            <a
              href="https://youtu.be/0vuCSv0pJxM"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors"
            >
              Tutorial passo-a-passo →
            </a>
          </div>

          <Button
            onClick={handleValidate}
            disabled={!apiKey.trim() || status === 'validating' || status === 'success'}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {status === 'validating' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Validando...
              </>
            ) : status === 'success' ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Salvo!
              </>
            ) : (
              'Validar e Salvar'
            )}
          </Button>

          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Obter API key gratuita
          </a>

          <Button
            variant="ghost"
            onClick={handleClose}
            className="w-full text-white/40 hover:text-white/70 hover:bg-white/5"
          >
            Pular por agora
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
