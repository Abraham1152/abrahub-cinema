import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Download, Maximize2, Trash2, Loader2, AlertCircle, Clock, Image as ImageIcon, Film, XCircle, Info, RotateCcw, Heart, Pencil, ShieldAlert, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatExpirationText, getDaysUntilExpiration, isExpired } from '@/lib/image-utils';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { GridSplitModal } from '@/components/storyboard/GridSplitModal';

// Download image as file with loading state
async function downloadImage(
  url: string, 
  filename: string,
  setDownloading?: (state: boolean) => void
) {
  try {
    setDownloading?.(true);
    toast.info('Baixando imagem...');
    
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
    
    const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
    toast.success(`Download concluído • ${sizeMB} MB`);
  } catch (error) {
    console.error('Download failed:', error);
    toast.error('Falha ao baixar imagem');
  } finally {
    setDownloading?.(false);
  }
}

// Check if generation is taking too long (>2 minutes = timeout)
const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

function isTimedOut(createdAt: string, status: string): boolean {
  if (status !== 'pending' && status !== 'generating') return false;
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return (now - created) > TIMEOUT_MS;
}

function getTimeElapsed(createdAt: string): string {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - created) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}min`;
}

export interface GalleryItem {
  id: string;
  type: 'image';
  url?: string;           // Single URL for everything (full quality)
  masterUrl?: string;     // Alias (same as url)
  thumbnailUrl?: string;  // Alias (same as url)
  prompt: string;
  model: string;
  modelLabel?: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
  errorMessage?: string;
  createdAt: string;
  creditsCost: number;
  liked?: boolean;
  // Image metadata from DB
  masterWidth?: number;
  masterHeight?: number;
  masterBytes?: number;
  is_story6?: boolean;
}

interface GalleryGridProps {
  items: GalleryItem[];
  onDelete?: (id: string) => void;
  onRetry?: (item: GalleryItem) => void;
  onCancelQueue?: (id: string) => void;
  onEdit?: (item: GalleryItem) => void;
  onToggleLike?: (id: string, liked: boolean) => void;
  onRefresh?: () => void;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  showExpiration?: boolean;
  expirationDays?: number;
  isPro?: boolean;
}

// Truncate prompt to first ~40 chars
function truncatePrompt(prompt: string, maxLength = 40): string {
  if (prompt.length <= maxLength) return prompt;
  return prompt.slice(0, maxLength).trim() + '...';
}

export function GalleryGrid({ 
  items, 
  onDelete,
  onRetry,
  onCancelQueue,
  onEdit,
  onToggleLike,
  onRefresh,
  emptyMessage = "Suas gerações aparecerão aqui",
  emptyIcon,
  showExpiration = true,
  expirationDays = 30,
  isPro = false
}: GalleryGridProps) {
  const [viewerItem, setViewerItem] = useState<GalleryItem | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [splitModalItem, setSplitModalItem] = useState<GalleryItem | null>(null);
  const [splitting, setSplitting] = useState(false);

  const handleImageError = useCallback((item: GalleryItem) => {
    // Hide broken image immediately
    setBrokenIds(prev => new Set(prev).add(item.id));
    // Auto-delete orphaned record from DB
    supabase.from('user_generated_images').delete().eq('id', item.id).then(({ error }) => {
      if (error) console.warn('[GalleryGrid] Failed to auto-delete orphaned image:', item.id, error);
      else console.log('[GalleryGrid] Auto-deleted orphaned image:', item.id);
    });
  }, []);
  
  // Handle split Story6 grid
  const handleConfirmSplit = useCallback(async (selectedPanels: number[]) => {
    if (!splitModalItem) return;
    const sourceItem = splitModalItem;
    setSplitModalItem(null);
    setViewerItem(null); // Close lightbox
    setSplitting(true);
    
    const sortedPanels = [...selectedPanels].sort((a, b) => a - b);
    const toastId = toast.loading(`Gerando painéis 0/${sortedPanels.length}...`);
    let successCount = 0;
    
    for (let i = 0; i < sortedPanels.length; i++) {
      toast.loading(`Gerando painel ${sortedPanels[i]}... (${i + 1}/${sortedPanels.length})`, { id: toastId });
      
      try {
        const fullUrl = sourceItem.masterUrl || sourceItem.url || '';
        // Extract storage path more robustly
        let storagePath = fullUrl;
        if (fullUrl.includes('storyboard-images/')) {
          storagePath = fullUrl.split('storyboard-images/')[1].split('?')[0];
        }

        const { data, error } = await supabase.functions.invoke('split-story6-grid', {
          body: {
            imageUrl: fullUrl,
            storagePath: storagePath,
            imageId: sourceItem.id,
            panels: [sortedPanels[i]],
            quality: '2K',
          },
        });
        
        if (error) {
          // Try to extract JSON error message if possible
          let errorMsg = error.message;
          try {
            const context = (error as any).context;
            if (context) {
              const body = await context.json();
              errorMsg = body.error || errorMsg;
            }
          } catch (e) {}
          
          console.error('[Split Error]', errorMsg);
          toast.error(`Erro no painel ${sortedPanels[i]}: ${errorMsg}`);
        } else if (data?.success) {
          successCount++;
          onRefresh?.();
        } else {
          toast.error(`Falha no painel ${sortedPanels[i]}: ${data?.error || 'Erro desconhecido'}`);
        }
      } catch (err) {
        console.error('[Split exception]', err);
        toast.error('Erro ao processar painel');
      }
    }
    
    setSplitting(false);
    if (successCount > 0) {
      toast.success(`${successCount} painel(is) gerado(s) com sucesso`, { id: toastId });
      onRefresh?.(); // Final refresh
    } else {
      toast.error('Nenhum painel foi gerado', { id: toastId });
    }
  }, [splitModalItem, onRefresh]);

  // Helper to format bytes to MB
  const formatMB = (bytes?: number) => bytes ? (bytes / (1024 * 1024)).toFixed(2) : null;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <div className="w-20 h-20 rounded-lg bg-white/5 flex items-center justify-center mb-6 border border-white/10">
          {emptyIcon || <Film className="h-10 w-10 text-muted-foreground" />}
        </div>
        <p className="text-lg text-muted-foreground mb-2">{emptyMessage}</p>
        <p className="text-sm text-muted-foreground/60">Selecione seu equipamento e descreva a cena ✨</p>
      </div>
    );
  }

  return (
    <>
      {/* Cinema Studio Grid - tight layout with gaps matching page background */}
      <div className="w-full rounded-lg overflow-hidden bg-transparent">
        <div 
          className="grid gap-2 p-2 bg-background"
          style={{ 
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          }}
        >
          {items.filter(item => !brokenIds.has(item.id)).map((item) => {
            const daysLeft = getDaysUntilExpiration(item.createdAt, expirationDays);
            const expired = isExpired(item.createdAt, expirationDays);
            const isUrgent = daysLeft <= 2 && daysLeft > 0;
            const canDelete = item.status === 'error' || item.status === 'ready';
            const timedOut = isTimedOut(item.createdAt, item.status);
            const isActive = item.status === 'pending' || item.status === 'generating';
            const showAsError = item.status === 'error' || timedOut;

            return (
              <div
                key={item.id}
                className="group relative overflow-hidden cursor-pointer"
                style={{ borderRadius: '6px' }}
                onClick={() => item.status === 'ready' && item.url && setViewerItem(item)}
              >
                {/* Image container - no padding, no border, no shadow */}
                <div className="aspect-[16/10] relative bg-neutral-900">
                  {/* Active queue item (pending/generating) - not timed out */}
                  {isActive && !timedOut ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800">
                      {/* Animated loading indicator */}
                      <div className="relative mb-3">
                        <div className="w-12 h-12 rounded-full border-2 border-primary/20" />
                        <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                        <ImageIcon className="absolute inset-0 m-auto h-5 w-5 text-primary/60" />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {item.status === 'pending' ? 'Processando...' : 'Gerando...'}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50 mt-0.5">
                        {getTimeElapsed(item.createdAt)}
                      </span>
                      <p className="text-[10px] text-muted-foreground/60 mt-1 px-4 text-center line-clamp-1">
                        {truncatePrompt(item.prompt, 30)}
                      </p>
                      
                      {/* Cancel button on hover for active items - only show if not a temp ID */}
                      {onCancelQueue && !item.id.startsWith('temp-') && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-red-600/80 text-white"
                          onClick={(e) => { e.stopPropagation(); onCancelQueue(item.id); }}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ) : showAsError ? (
                    /* Error or Timeout state - styled like the reference */
                    <div className="absolute inset-0 flex flex-col bg-neutral-900/95">
                      {/* Badges at top */}
                      <div className="flex items-center gap-2 p-3">
                        <Badge variant="destructive" className="gap-1.5 text-xs font-medium bg-neutral-800 border border-neutral-700 text-white">
                          <XCircle className="h-3 w-3" />
                          {timedOut ? 'Timeout' : 'Failed'}
                        </Badge>
                        <Badge variant="secondary" className="gap-1.5 text-xs font-medium bg-neutral-800 border border-neutral-700 text-white/70">
                          <Info className="h-3 w-3" />
                          Credits refunded
                        </Badge>
                      </div>
                      
                      {/* Spacer */}
                      <div className="flex-1" />
                      
                      {/* Error message + prompt + actions at bottom */}
                      <div className="p-3 space-y-2">
                        <div className="flex items-start gap-1.5">
                          {item.errorMessage?.includes('segurança') && (
                            <ShieldAlert className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                          )}
                          <p className="text-xs text-white/80 line-clamp-2">
                            {timedOut 
                              ? 'Generation timed out after 2 minutes...' 
                              : (item.errorMessage || 'Prompt or file includes unsupported cont...')}
                          </p>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 line-clamp-1">
                          {truncatePrompt(item.prompt, 40)}
                        </p>
                        
                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          {onRetry && (
                            <Button 
                              size="sm" 
                              variant="secondary"
                              className="h-8 text-xs bg-white text-black hover:bg-white/90 font-medium"
                              onClick={(e) => { e.stopPropagation(); onRetry(item); }}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                              Retry
                            </Button>
                          )}
                          {(onDelete || onCancelQueue) && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-8 text-xs bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (timedOut && onCancelQueue) {
                                  onCancelQueue(item.id);
                                } else if (onDelete) {
                                  onDelete(item.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img 
                      src={item.thumbnailUrl || item.url} 
                      alt={item.prompt}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={() => handleImageError(item)}
                    />
                  )}

                  {/* Grid badge */}
                  {item.status === 'ready' && item.is_story6 && (
                    <div className="absolute top-2 left-2 z-10">
                      <Badge className="bg-primary/90 text-primary-foreground text-[9px] px-1.5 py-0.5 gap-1">
                        <Grid3X3 className="h-2.5 w-2.5" />
                        Grid
                      </Badge>
                    </div>
                  )}

                  {/* Cinema Studio hover overlay */}
                  {item.status === 'ready' && item.url && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-end p-3">
                      {/* Prompt preview */}
                      <p className="text-xs text-white/90 font-medium leading-tight mb-1 line-clamp-2">
                        {truncatePrompt(item.prompt, 60)}
                      </p>
                      
                      {/* Rig + Expiration info */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/60 uppercase tracking-wide">
                          {item.modelLabel || item.model}
                        </span>
                        {showExpiration && (
                          <span className={`text-[10px] flex items-center gap-1 ${
                            expired 
                              ? 'text-red-400' 
                              : isUrgent 
                                ? 'text-amber-400' 
                                : 'text-white/50'
                          }`}>
                            <Clock className="h-2.5 w-2.5" />
                            {expired ? 'Expirado' : `${daysLeft}d`}
                          </span>
                        )}
                      </div>

                      {/* Quick action icons - top right */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Like button */}
                        {onToggleLike && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className={cn(
                              "h-7 w-7 transition-colors",
                              item.liked 
                                ? "bg-pink-600/80 hover:bg-pink-600 text-white" 
                                : "bg-black/50 hover:bg-pink-600/80 text-white"
                            )}
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              onToggleLike(item.id, !item.liked); 
                            }}
                          >
                            <Heart className={cn("h-3.5 w-3.5", item.liked && "fill-current")} />
                          </Button>
                        )}
                        {/* Edit/Variation button */}
                        {onEdit && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 bg-black/50 hover:bg-primary/80 text-white"
                            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                            title="Criar variação desta imagem"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 bg-black/50 hover:bg-black/70 text-white"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 bg-black/50 hover:bg-black/70 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Use masterUrl for download (high quality), fallback to url
                            const downloadUrl = item.masterUrl || item.url;
                            if (downloadUrl) {
                              downloadImage(downloadUrl, `abrahub-${item.id}.jpg`);
                            }
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {onDelete && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 bg-black/50 hover:bg-red-600/80 text-white"
                            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      
                      {/* Liked indicator - always visible if liked */}
                      {item.liked && (
                        <div className="absolute top-2 left-2 opacity-100 group-hover:opacity-0 transition-opacity">
                          <Heart className="h-4 w-4 text-pink-500 fill-pink-500" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lightbox Dialog - compact, no extra spacing */}
      <Dialog open={!!viewerItem} onOpenChange={(open) => !open && setViewerItem(null)}>
        <DialogContent className="max-w-6xl bg-neutral-950 border-neutral-800 p-0 overflow-hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Visualização de imagem</DialogTitle>
          {viewerItem && (
            <div className="flex flex-col">
              {/* Image - Use MASTER quality for lightbox */}
              <img 
                src={viewerItem.masterUrl || viewerItem.url} 
                alt={viewerItem.prompt}
                className="w-full max-h-[70vh] object-contain bg-neutral-950"
              />
              
              {/* Metadata - directly below image, no gap */}
              <div className="p-4 border-t border-neutral-800 space-y-3 bg-neutral-950">
                {/* Prompt */}
                <p className="text-sm text-white/90 leading-relaxed">{viewerItem.prompt}</p>
                
                {/* Metadata row */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <span className="text-white/40">
                      {new Date(viewerItem.createdAt).toLocaleString('pt-BR')}
                    </span>
                    <span className="text-primary font-medium">{viewerItem.creditsCost} créditos</span>
                    <span className="text-white/40 uppercase tracking-wide">
                      {viewerItem.modelLabel || viewerItem.model}
                    </span>
                    {showExpiration && (
                      <span className={`flex items-center gap-1 ${
                        isExpired(viewerItem.createdAt, expirationDays) 
                          ? 'text-red-400' 
                          : getDaysUntilExpiration(viewerItem.createdAt, expirationDays) <= 2 
                            ? 'text-amber-400' 
                            : 'text-white/40'
                      }`}>
                        <Clock className="h-3 w-3" />
                        {formatExpirationText(viewerItem.createdAt, expirationDays)}
                      </span>
                    )}
                    {/* Image metadata from DB - Resolution and Size */}
                    {viewerItem.masterWidth && viewerItem.masterHeight && (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" />
                        {viewerItem.masterWidth}×{viewerItem.masterHeight} • {formatMB(viewerItem.masterBytes)} MB
                      </span>
                    )}
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                      disabled={downloading}
                      onClick={() => {
                        const downloadUrl = viewerItem.masterUrl || viewerItem.url;
                        if (downloadUrl) {
                          downloadImage(downloadUrl, `abrahub-${viewerItem.id}.png`, setDownloading);
                        }
                      }}
                    >
                      {downloading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Baixando...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </>
                      )}
                    </Button>

                    {/* Partir Grid button - only for Story6 images */}
                    {viewerItem.is_story6 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary gap-1.5"
                        disabled={splitting}
                        onClick={() => {
                          setSplitModalItem(viewerItem);
                        }}
                      >
                        <Grid3X3 className="h-4 w-4" />
                        Partir Grid
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Grid Split Modal */}
      {splitModalItem && (
        <GridSplitModal
          open={!!splitModalItem}
          onOpenChange={(open) => !open && setSplitModalItem(null)}
          imageUrl={splitModalItem.masterUrl || splitModalItem.url || ''}
          imageId={splitModalItem.id}
          onConfirm={handleConfirmSplit}
          splitting={splitting}
        />
      )}
    </>
  );
}
