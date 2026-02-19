import { useState } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface AddCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (amount: number, description: string) => void;
  userName: string;
}

export function AddCreditsModal({
  isOpen,
  onClose,
  onSubmit,
  userName,
}: AddCreditsModalProps) {
  const [amount, setAmount] = useState<number>(10);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit(amount, description || `Créditos adicionados pelo admin`);
      setAmount(10);
      setDescription('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-display text-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            Adicionar Créditos
          </DialogTitle>
          <p className="sr-only">Adicione créditos manualmente para um usuário.</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="p-3 rounded-lg bg-secondary/30 border border-border">
            <p className="text-sm text-muted-foreground">Usuário:</p>
            <p className="font-medium">{userName}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Quantidade de Créditos</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              max="1000"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              className="h-12"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Motivo (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Bônus de boas-vindas, compensação, etc."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="studio" disabled={isSubmitting || amount <= 0}>
              {isSubmitting ? 'Adicionando...' : `Adicionar ${amount} Créditos`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
