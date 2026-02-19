import { Copy, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface AnimationPrompt {
  panel?: number;
  shot?: number;
  prompt: string;
  duration?: number;
}

interface AnimationPromptCardProps {
  prompt: AnimationPrompt;
  index: number;
  onRemove: (index: number) => void;
}

export function AnimationPromptCard({ prompt, index, onRemove }: AnimationPromptCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(prompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="bg-secondary/40 border border-border rounded-lg p-2.5 text-xs space-y-1.5 group"
      data-no-drag
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
          {prompt.panel ? `Painel ${prompt.panel}` : prompt.shot ? `Shot ${prompt.shot}` : `Shot ${index + 2}`}
          {prompt.duration ? ` · ${prompt.duration}s` : ''}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-destructive/60 hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onRemove(index); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
        {prompt.prompt}
      </p>
    </div>
  );
}
