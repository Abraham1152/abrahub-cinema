import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCookieConsent } from '@/hooks/useCookieConsent';
import { CookiePreferencesModal } from './CookiePreferencesModal';
import { cn } from '@/lib/utils';

export function CookieBanner() {
  const { hasResponded, isLoading, preferences, acceptAll, rejectNonEssential, updatePreferences } = useCookieConsent();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Don't render while loading or if user has already responded
  if (isLoading || hasResponded) {
    return null;
  }

  const handleAccept = () => {
    setIsClosing(true);
    setTimeout(() => {
      acceptAll();
    }, 200);
  };

  const handleReject = () => {
    setIsClosing(true);
    setTimeout(() => {
      rejectNonEssential();
    }, 200);
  };

  const handleSavePreferences = (prefs: Parameters<typeof updatePreferences>[0]) => {
    setIsClosing(true);
    setTimeout(() => {
      updatePreferences(prefs);
    }, 200);
  };

  return (
    <>
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6",
          "bg-background/95 backdrop-blur-xl border-t border-border",
          "shadow-[0_-4px_20px_rgba(0,0,0,0.3)]",
          "transition-all duration-300 ease-out",
          isClosing ? "translate-y-full opacity-0" : "translate-y-0 opacity-100",
          "animate-in slide-in-from-bottom-full duration-500"
        )}
        role="dialog"
        aria-label="Consentimento de cookies"
      >
        <div className="container max-w-5xl mx-auto">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Content */}
            <div className="flex gap-3 flex-1">
              <div className="hidden sm:flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
                <Cookie className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Cookie className="h-4 w-4 sm:hidden text-primary" />
                  Utilizamos cookies
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                  Este site usa cookies essenciais para funcionamento e opcionais para melhorar sua experiência. 
                  Saiba mais em nossa{' '}
                  <Link 
                    to="/privacy" 
                    className="text-primary hover:underline font-medium"
                  >
                    Política de Privacidade
                  </Link>.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreferencesOpen(true)}
                className="text-xs h-9"
              >
                Personalizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                className="text-xs h-9"
              >
                Rejeitar Opcionais
              </Button>
              <Button
                size="sm"
                onClick={handleAccept}
                className="text-xs h-9 glow-lime"
              >
                Aceitar Todos
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences Modal */}
      <CookiePreferencesModal
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        preferences={preferences}
        onSave={handleSavePreferences}
      />
    </>
  );
}
