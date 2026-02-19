import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';

interface PromptOutputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  sceneTitle: string;
}

export function PromptOutput({ open, onOpenChange, prompt, sceneTitle }: PromptOutputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Prompt de Animação — {sceneTitle}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <div className="bg-secondary/50 rounded-lg p-4 pb-10 text-sm leading-relaxed whitespace-pre-wrap max-h-[50vh] overflow-y-auto border border-border">
            {prompt || 'Nenhum prompt gerado.'}
          </div>
          {prompt && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
