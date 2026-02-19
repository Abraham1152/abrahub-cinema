import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Shield, BarChart3, Settings2, Lock } from 'lucide-react';
import type { CookiePreferences } from '@/hooks/useCookieConsent';

interface CookiePreferencesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: CookiePreferences;
  onSave: (prefs: Partial<Omit<CookiePreferences, 'essential'>>) => void;
}

export function CookiePreferencesModal({
  open,
  onOpenChange,
  preferences,
  onSave,
}: CookiePreferencesModalProps) {
  const [localPrefs, setLocalPrefs] = useState({
    functional: preferences.functional,
    analytics: preferences.analytics,
  });

  useEffect(() => {
    setLocalPrefs({
      functional: preferences.functional,
      analytics: preferences.analytics,
    });
  }, [preferences]);

  const handleSave = () => {
    onSave(localPrefs);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Preferências de Cookies
          </DialogTitle>
          <DialogDescription>
            Personalize quais tipos de cookies você permite. Cookies essenciais não podem ser desativados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Essential Cookies - Always on */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4 bg-secondary/30">
            <div className="flex gap-3">
              <div className="mt-0.5">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Cookies Essenciais</Label>
                <p className="text-xs text-muted-foreground">
                  Necessários para o funcionamento do site. Incluem autenticação e segurança.
                </p>
              </div>
            </div>
            <Switch checked disabled className="opacity-50" />
          </div>

          {/* Functional Cookies */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
            <div className="flex gap-3">
              <div className="mt-0.5">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="functional" className="text-sm font-medium cursor-pointer">
                  Cookies Funcionais
                </Label>
                <p className="text-xs text-muted-foreground">
                  Lembram suas preferências como tema, idioma e configurações de interface.
                </p>
              </div>
            </div>
            <Switch
              id="functional"
              checked={localPrefs.functional}
              onCheckedChange={(checked) => setLocalPrefs(prev => ({ ...prev, functional: checked }))}
            />
          </div>

          {/* Analytics Cookies */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
            <div className="flex gap-3">
              <div className="mt-0.5">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="analytics" className="text-sm font-medium cursor-pointer">
                  Cookies Analíticos
                </Label>
                <p className="text-xs text-muted-foreground">
                  Nos ajudam a entender como você usa o site para melhorar a experiência.
                </p>
              </div>
            </div>
            <Switch
              id="analytics"
              checked={localPrefs.analytics}
              onCheckedChange={(checked) => setLocalPrefs(prev => ({ ...prev, analytics: checked }))}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar Preferências
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
