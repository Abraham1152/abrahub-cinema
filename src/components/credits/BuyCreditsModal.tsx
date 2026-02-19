import { useState } from 'react';
import { Zap, Check, Loader2, ShoppingCart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CREDIT_PACKAGES, CREDIT_PACKAGE_IDS, type CreditPackageId } from '@/config/credit-packages';
import { cn } from '@/lib/utils';

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyCreditsModal({ open, onOpenChange }: BuyCreditsModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<CreditPackageId>('pack_50');
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-credits-checkout', {
        body: { packageId: selectedPackage },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        onOpenChange(false);
      } else {
        throw new Error('URL de checkout não retornada');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Erro ao criar checkout. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const selected = CREDIT_PACKAGES[selectedPackage];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <ShoppingCart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl">Comprar Créditos</DialogTitle>
              <DialogDescription>
                Escolha um pacote de créditos avulsos
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Package Selection Grid */}
          <div className="grid grid-cols-2 gap-3">
            {CREDIT_PACKAGE_IDS.map((pkgId) => {
              const pkg = CREDIT_PACKAGES[pkgId];
              const isSelected = selectedPackage === pkgId;

              return (
                <button
                  key={pkgId}
                  onClick={() => setSelectedPackage(pkgId)}
                  className={cn(
                    "relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200",
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50"
                  )}
                >
                  {pkg.popular && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                        <Sparkles className="h-3 w-3" />
                        Popular
                      </span>
                    </div>
                  )}

                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{pkg.credits}</span>
                  </div>
                  <span className="text-xs text-muted-foreground mb-2">créditos</span>

                  <span className="text-lg font-semibold">{pkg.priceDisplay}</span>
                  <span className="text-xs text-muted-foreground">{pkg.pricePerCredit}/crédito</span>

                  {pkg.discount && (
                    <span className="mt-2 text-xs font-medium text-primary">
                      {pkg.discount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Package Summary */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Pacote selecionado</p>
                <p className="font-semibold">{selected.credits} créditos</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-xl font-bold text-primary">{selected.priceDisplay}</p>
            </div>
          </div>

          {/* Purchase Button */}
          <Button
            variant="studio"
            className="w-full gap-2"
            onClick={handlePurchase}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Comprar {selected.priceDisplay}
              </>
            )}
          </Button>

          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Pagamento único via Stripe • Créditos não expiram
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
