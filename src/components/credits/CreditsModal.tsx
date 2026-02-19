import { useState } from 'react';
import { Zap, AlertCircle, Crown, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { BuyCreditsModal } from './BuyCreditsModal';

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditsNeeded: number;
  currentCredits: number;
}

export function CreditsModal({ isOpen, onClose, creditsNeeded, currentCredits }: CreditsModalProps) {
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const deficit = creditsNeeded - currentCredits;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 border border-warning/20">
                <AlertCircle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <DialogTitle className="font-display text-xl">Créditos Insuficientes</DialogTitle>
                <DialogDescription>
                  Você precisa de mais créditos para esta ação
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Credits Display */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Seus créditos</p>
                  <p className="text-2xl font-bold">{currentCredits}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Necessário</p>
                <p className="text-2xl font-bold text-warning">{creditsNeeded}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Você precisa de mais <span className="text-warning font-semibold">{deficit} crédito{deficit > 1 ? 's' : ''}</span> para realizar esta ação.
            </p>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button 
                variant="studio" 
                className="w-full gap-2" 
                onClick={() => {
                  onClose();
                  setShowBuyCredits(true);
                }}
              >
                <ShoppingCart className="h-4 w-4" />
                Comprar Créditos Avulsos
              </Button>
              <Button variant="outline" className="w-full gap-2" asChild>
                <Link to="/pricing">
                  <Crown className="h-4 w-4" />
                  Fazer Upgrade para PRO
                </Link>
              </Button>
              <Button variant="ghost" className="w-full" onClick={onClose}>
                Voltar
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Créditos avulsos a partir de R$ 39 • PRO: 10 • PRO+: 100 créditos/mês
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <BuyCreditsModal 
        open={showBuyCredits} 
        onOpenChange={setShowBuyCredits} 
      />
    </>
  );
}