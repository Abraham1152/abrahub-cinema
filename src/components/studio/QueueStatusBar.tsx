import { Loader2, Clock, CheckCircle2, AlertCircle, ListOrdered } from 'lucide-react';
import { QueueItem } from '@/hooks/useGenerationQueue';
import { cn } from '@/lib/utils';

interface QueueStatusBarProps {
  items: QueueItem[];
  className?: string;
}

function getStatusIcon(status: QueueItem['status']) {
  switch (status) {
    case 'queued':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
  }
}

function getStatusText(item: QueueItem): string {
  switch (item.status) {
    case 'queued':
      if (item.position > 1) {
        return `Na fila (posição ${item.position}) • ~${Math.ceil(item.estimatedWaitSeconds / 60)} min`;
      }
      return 'Aguardando processamento...';
    case 'processing':
      return 'Gerando imagem...';
    case 'completed':
      return 'Concluído!';
    case 'failed':
      return item.errorMessage || 'Falhou';
  }
}

function truncatePrompt(prompt: string, maxLength: number = 40): string {
  if (prompt.length <= maxLength) return prompt;
  return prompt.slice(0, maxLength) + '...';
}

export function QueueStatusBar({ items, className }: QueueStatusBarProps) {
  const activeItems = items.filter(
    item => item.status === 'queued' || item.status === 'processing'
  );

  if (activeItems.length === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-28 left-1/2 -translate-x-1/2 z-40",
      "bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-lg",
      "px-4 py-3 max-w-lg w-full mx-4",
      className
    )}>
      <div className="flex items-center gap-2 mb-2">
        <ListOrdered className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          Fila de Geração ({activeItems.length} {activeItems.length === 1 ? 'item' : 'itens'})
        </span>
      </div>

      <div className="space-y-2">
        {activeItems.slice(0, 3).map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-2 bg-muted/50 rounded-md"
          >
            {getStatusIcon(item.status)}
            
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {truncatePrompt(item.prompt)}
              </p>
              <p className="text-xs font-medium text-foreground">
                {getStatusText(item)}
              </p>
            </div>

            {item.status === 'processing' && (
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
              </div>
            )}
          </div>
        ))}

        {activeItems.length > 3 && (
          <p className="text-xs text-muted-foreground text-center">
            +{activeItems.length - 3} mais na fila
          </p>
        )}
      </div>
    </div>
  );
}
