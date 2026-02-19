import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Grid3X3, Check, Sparkles } from 'lucide-react';

interface GridPanelSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onConfirm: (selectedPanels: number[]) => void;
  generating: boolean;
}

export function GridPanelSelector({ open, onOpenChange, imageUrl, onConfirm, generating }: GridPanelSelectorProps) {
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Gerar Prompts de Animação
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Selecione os painéis do Grid para gerar um prompt de animação cinematográfico para cada um. A IA vai analisar cada painel e sugerir o melhor movimento de câmera.
        </p>

        <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-secondary">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0 || generating} className="gap-2">
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Gerar {selected.size} {selected.size === 1 ? 'prompt' : 'prompts'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
