import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Grid3X3, Check } from 'lucide-react';

interface GridSplitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  imageId: string;
  onConfirm: (selectedPanels: number[]) => void;
  splitting: boolean;
}

export function GridSplitModal({ open, onOpenChange, imageUrl, imageId, onConfirm, splitting }: GridSplitModalProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6]));

  const togglePanel = (panel: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(panel)) next.delete(panel);
      else next.add(panel);
      return next;
    });
  };

  const handleConfirm = () => {
    if (selected.size === 0) return;
    onConfirm(Array.from(selected).sort());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            Dividir Grid em Cenas
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Selecione os painéis que deseja isolar. Cada painel será gerado em alta resolução via IA e adicionado como cena individual na mesma coluna.
        </p>

        {/* Grid overlay on the image */}
        <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-secondary">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          
          {/* 3x2 grid overlay */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-2">
            {[1, 2, 3, 4, 5, 6].map(panel => (
              <button
                key={panel}
                onClick={() => togglePanel(panel)}
                className={`relative border transition-all ${
                  selected.has(panel)
                    ? 'border-primary/80 bg-primary/20'
                    : 'border-white/20 bg-black/30 hover:bg-black/10'
                }`}
              >
                <div className={`absolute top-1 left-1 flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold ${
                  selected.has(panel)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-black/50 text-white/70'
                }`}>
                  {selected.has(panel) ? <Check className="h-3 w-3" /> : panel}
                </div>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={splitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0 || splitting} className="gap-2">
            {splitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Grid3X3 className="h-4 w-4" />
            )}
            Criar {selected.size} {selected.size === 1 ? 'cena' : 'cenas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
