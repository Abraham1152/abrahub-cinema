import { useState, useRef, useCallback, useEffect, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, GripHorizontal, Plus, X, Loader2, Star, Download, Image as ImageIcon, Sparkles, Upload, Copy, Link2Off, Link2, Film, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ImagePickerModal } from './ImagePickerModal';
import { ImageViewerModal } from './ImageViewerModal';
import { StoryboardEquipmentBar } from './StoryboardEquipmentBar';
import type { StoryboardScene, StoryboardSceneImage, SceneReference } from '@/hooks/useStoryboard';

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '21:9', label: '21:9' },
];

interface SceneBlockProps {
  scene: StoryboardScene;
  images: StoryboardSceneImage[];
  references: SceneReference[];
  index: number;
  isDraggable: boolean;
  zoom: number;
  computedPosition?: { x: number; y: number };
  isGenerating: boolean;
  onUpdate: (id: string, updates: Partial<StoryboardScene>) => void;
  onDelete: (id: string) => void;
  onAddReference: (sceneId: string, imageId: string, previewUrl?: string, prompt?: string) => void;
  onRemoveReference: (sceneId: string, refId: string) => void;
  onGenerateImage: (sceneId: string) => void;
  onSetPrimary: (sceneId: string, imageId: string) => void;
  onRemoveImage: (imageId: string, sceneId: string) => void;
  onUploadFileAsReference: (sceneId: string, file: File) => void;
  onCreateFromScene: (sceneId: string) => void;
  // Connection ports
  onStartConnectionDrag: (sceneId: string, e: React.MouseEvent) => void;
  onDropConnection: (toSceneId: string) => void;
  isDraggingConnection: boolean;
  draggingFromId: string | null;
}

// Read-only video prompt section with copy button
function VideoPromptSection({ videoPrompt }: { videoPrompt: string }) {
  const [expanded, setExpanded] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(videoPrompt);
    toast.success('Prompt de vídeo copiado!');
  };

  return (
    <div className="mx-3 mb-2 rounded-lg border border-primary/15 bg-primary/5" data-no-drag>
      <button
        className="flex items-center justify-between w-full px-2.5 py-1.5 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-primary/70">
          <Film className="h-3 w-3" />
          Prompt de Vídeo
        </span>
        {expanded
          ? <ChevronUp className="h-3 w-3 text-primary/50" />
          : <ChevronDown className="h-3 w-3 text-primary/50" />
        }
      </button>
      {expanded && (
        <div className="px-2.5 pb-2.5 relative">
          <p className="text-[10px] font-mono text-muted-foreground leading-relaxed pr-5 select-text">
            {videoPrompt}
          </p>
          <button
            onClick={handleCopy}
            className="absolute top-0 right-2 p-0.5 text-muted-foreground/40 hover:text-primary transition-colors"
            title="Copiar prompt de vídeo"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function SceneBlock({
  scene, images, references, index, isDraggable, zoom, computedPosition, isGenerating,
  onUpdate, onDelete, onAddReference, onRemoveReference,
  onGenerateImage, onSetPrimary, onRemoveImage, onUploadFileAsReference,
  onCreateFromScene,
  onStartConnectionDrag, onDropConnection, isDraggingConnection, draggingFromId,
}: SceneBlockProps) {
  const navigate = useNavigate();
  const [localPrompt, setLocalPrompt] = useState(scene.prompt_base || '');
  const [viewerImage, setViewerImage] = useState<{ full: string; download?: string; id?: string; prompt?: string } | null>(null);
  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalPrompt(scene.prompt_base || ''); }, [scene.id, scene.prompt_base]);

  // Debounced prompt save
  const handlePromptChange = useCallback((value: string) => {
    setLocalPrompt(value);
    if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    promptTimerRef.current = setTimeout(() => {
      onUpdate(scene.id, { prompt_base: value } as any);
    }, 500);
  }, [scene.id, onUpdate]);

  // Drag handling — direct DOM manipulation for zero-lag movement, persist only on drop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isDraggable) return;
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    if ((e.target as HTMLElement).closest('[data-connection-port]')) return;
    e.stopPropagation();
    const origX = (scene.position_x !== 0 || scene.position_y !== 0) ? scene.position_x : (computedPosition?.x ?? scene.position_x);
    const origY = (scene.position_x !== 0 || scene.position_y !== 0) ? scene.position_y : (computedPosition?.y ?? scene.position_y);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX, origY };

    // Target the absolute-positioned wrapper (parent of this component)
    const wrapperEl = blockRef.current?.parentElement as HTMLElement | null;
    if (wrapperEl) {
      wrapperEl.style.willChange = 'transform';
      wrapperEl.style.zIndex = '50';
    }
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current || !wrapperEl) return;
      const dx = (ev.clientX - dragRef.current.startX) / zoom;
      const dy = (ev.clientY - dragRef.current.startY) / zoom;
      // GPU-accelerated visual feedback — no React re-renders, no DB calls
      wrapperEl.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const handleMouseUp = (ev: MouseEvent) => {
      if (dragRef.current) {
        const dx = (ev.clientX - dragRef.current.startX) / zoom;
        const dy = (ev.clientY - dragRef.current.startY) / zoom;
        // Reset visual transform before state update
        if (wrapperEl) {
          wrapperEl.style.transform = '';
          wrapperEl.style.willChange = '';
          wrapperEl.style.zIndex = '';
        }
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        // Single state + DB persist on drop
        onUpdate(scene.id, { position_x: dragRef.current.origX + dx, position_y: dragRef.current.origY + dy });
      }
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [scene.id, scene.position_x, scene.position_y, computedPosition, zoom, onUpdate, isDraggable]);

  const generatedImages = images.filter(i => i.role !== 'inherited');
  const inheritedImages = images.filter(i => i.role === 'inherited');
  const primaryImage = generatedImages.find(i => i.is_primary);

  // Is this scene a valid drop target for the current connection drag?
  const isValidDropTarget = isDraggingConnection && draggingFromId && draggingFromId !== scene.id;
  const hasParent = !!scene.parent_scene_id;

  return (
    <div
      ref={blockRef}
      className="relative bg-background/95 backdrop-blur-md border-2 border-border rounded-xl shadow-xl transition-shadow w-[360px]"
      onMouseDown={handleMouseDown}
    >
      {/* OUTPUT PORT - Right side (drag to start connection) */}
      <div
        data-connection-port
        className="absolute -right-3 top-[36px] z-10 group cursor-crosshair"
        onMouseDown={(e) => onStartConnectionDrag(scene.id, e)}
        title="Arraste para conectar a outra cena"
      >
        <div className="w-6 h-6 rounded-full border-2 border-primary/40 bg-background flex items-center justify-center transition-all group-hover:border-primary group-hover:scale-125 group-hover:shadow-[0_0_8px_hsl(var(--primary)/0.4)]">
          <div className="w-2.5 h-2.5 rounded-full bg-primary/50 group-hover:bg-primary transition-colors" />
        </div>
      </div>

      {/* INPUT PORT - Left side (drop target) */}
      <div
        data-connection-port
        className={`absolute -left-3 top-[36px] z-10 transition-all ${
          isValidDropTarget ? 'scale-125' : ''
        }`}
        onMouseUp={() => {
          if (isValidDropTarget) onDropConnection(scene.id);
        }}
      >
        <div className={`w-6 h-6 rounded-full border-2 bg-background flex items-center justify-center transition-all ${
          isValidDropTarget
            ? 'border-primary scale-110 shadow-[0_0_12px_hsl(var(--primary)/0.5)] cursor-pointer'
            : 'border-muted-foreground/30'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
            isValidDropTarget ? 'bg-primary animate-pulse' : 'bg-muted-foreground/20'
          }`} />
        </div>
      </div>

      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b border-border ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}>
        {isDraggable && <GripHorizontal className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
          {index + 1}
        </div>
        <Input
          data-no-drag
          value={scene.title}
          onChange={e => onUpdate(scene.id, { title: e.target.value })}
          className="h-7 text-sm font-medium border-none bg-transparent px-1 focus-visible:ring-0 max-w-[120px]"
        />
        {/* Aspect ratio */}
        <div className="ml-auto shrink-0" data-no-drag>
          <Select
            value={scene.aspect_ratio || '16:9'}
            onValueChange={v => onUpdate(scene.id, { aspect_ratio: v } as any)}
          >
            <SelectTrigger className="h-7 w-[70px] text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map(r => (
                <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          data-no-drag
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-destructive/60 hover:text-destructive"
          onClick={() => onDelete(scene.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Equipment Bar - Read-only: params chosen automatically by AI Director */}
      <StoryboardEquipmentBar
        styleData={(scene.style_data as any) || {}}
        readOnly
        onChange={() => {}}
      />

      {/* Inheritance Controls - child scenes */}
      {hasParent && (
        <div className="border-b border-border">
          <div className="flex flex-col gap-1 px-3 py-1.5 bg-secondary/30" data-no-drag>
            <div className="flex items-center gap-1.5 mb-0.5">
              {scene.inherit_style ? (
                <Link2 className="h-3 w-3 text-primary shrink-0" />
              ) : (
                <Link2Off className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                Herança
              </span>
              <Switch
                checked={scene.inherit_style}
                onCheckedChange={(checked) => onUpdate(scene.id, { inherit_style: checked } as any)}
                className="scale-75 ml-auto"
              />
            </div>
            {scene.inherit_style && (
              <div className="flex gap-3 pl-4">
                <label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox
                    checked={((scene.style_data as any)?.inherit_character) !== false}
                    onCheckedChange={(checked) => {
                      const current = (scene.style_data as any) || {};
                      onUpdate(scene.id, { style_data: { ...current, inherit_character: !!checked } } as any);
                    }}
                    className="h-3 w-3"
                  />
                  <span className="text-[9px] text-muted-foreground">Personagem</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox
                    checked={((scene.style_data as any)?.inherit_environment) !== false}
                    onCheckedChange={(checked) => {
                      const current = (scene.style_data as any) || {};
                      onUpdate(scene.id, { style_data: { ...current, inherit_environment: !!checked } } as any);
                    }}
                    className="h-3 w-3"
                  />
                  <span className="text-[9px] text-muted-foreground">Cenário</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox
                    checked={true}
                    disabled
                    className="h-3 w-3 opacity-60"
                  />
                  <span className="text-[9px] text-muted-foreground opacity-60">Estilo</span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prompt Base */}
      <div className="px-3 py-2" data-no-drag>
        <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
          Prompt Base
        </label>
        <Textarea
          placeholder="Descreva a cena que quer gerar..."
          value={localPrompt}
          onChange={e => handlePromptChange(e.target.value)}
          className="min-h-[60px] text-xs resize-none border-border bg-secondary/30 focus-visible:ring-1 focus-visible:ring-primary"
          rows={3}
        />
      </div>


      {/* References */}
      <div
        className="px-3 pb-2"
        data-no-drag
        onDragOver={(e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          if (references.length < 3) setIsDragOver(true);
        }}
        onDragLeave={(e: DragEvent) => {
          e.preventDefault();
          setIsDragOver(false);
        }}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith('image/')) {
            onUploadFileAsReference(scene.id, file);
          }
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
            Referências ({references.length}/3)
          </span>
          {references.length < 3 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => setRefPickerOpen(true)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
        {references.length > 0 ? (
          <div className="flex gap-1.5">
            {references.map(ref => (
              <div key={ref.id} className="relative group w-16 h-16">
                <div
                  className="w-full h-full rounded-md overflow-hidden border border-border bg-secondary cursor-pointer"
                  onClick={() => ref.preview_url && setViewerImage({ full: ref.preview_url })}
                >
                  {ref.preview_url ? (
                    <img src={ref.preview_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-3 w-3 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-1 -right-1 h-4 w-4 bg-background/90 border border-border rounded-full opacity-0 group-hover:opacity-100"
                  onClick={() => onRemoveReference(scene.id, ref.id)}
                >
                  <X className="h-2.5 w-2.5" />
                </Button>
              </div>
            ))}
            {references.length < 3 && (
              <div
                className={`w-16 h-16 rounded-md border-2 border-dashed flex items-center justify-center transition-colors cursor-pointer ${
                  isDragOver ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setRefPickerOpen(true)}
              >
                <Upload className="h-3 w-3 text-muted-foreground/40" />
              </div>
            )}
          </div>
        ) : (
          <div
            className={`border-2 border-dashed rounded-md p-3 text-center cursor-pointer transition-colors ${
              isDragOver ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
            }`}
            onClick={() => setRefPickerOpen(true)}
          >
            <Upload className="h-4 w-4 mx-auto mb-1 text-muted-foreground/40" />
            <span className="text-[9px] text-muted-foreground/60">
              {isDragOver ? 'Solte a imagem aqui' : 'Arraste imagens ou clique para adicionar'}
            </span>
          </div>
        )}
      </div>

      {/* Video Prompt — read-only, generated by AI Director */}
      {scene.style_data?.video_prompt && (
        <VideoPromptSection videoPrompt={scene.style_data.video_prompt} />
      )}

      {/* Generate */}
      <div className="px-3 pb-2" data-no-drag>
        <Button
          className="w-full gap-1.5 text-xs"
          size="sm"
          onClick={() => onGenerateImage(scene.id)}
          disabled={isGenerating || !localPrompt.trim()}
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {isGenerating ? 'Gerando...' : 'Gerar Imagem'}
        </Button>
      </div>

      {/* Generated Images Grid */}
      {generatedImages.length > 0 && (
        <div className="px-3 pb-3 border-t border-border pt-2" data-no-drag>
          <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Imagens geradas ({generatedImages.length})
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {generatedImages.map(img => (
              <div key={img.id} className="relative group aspect-square">
                {/* Clickable image layer */}
                <div
                  className={`w-full h-full rounded-md overflow-hidden border-2 cursor-pointer transition-colors ${
                    img.is_primary ? 'border-primary' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => {
                    const fullUrl = img.master_url || img.image_url;
                    if (fullUrl) setViewerImage({ full: fullUrl, download: img.master_url || undefined, id: img.id, prompt: (img as any).prompt });
                  }}
                >
                  {img.image_url ? (
                    <img src={img.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary">
                      <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                {/* Actions overlay - only the buttons are clickable */}
                <div className="absolute inset-x-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-b-md bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center gap-1 pb-1 pt-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-white hover:text-yellow-400"
                    onClick={e => { e.stopPropagation(); onSetPrimary(scene.id, img.id); }}
                    title="Marcar como principal"
                  >
                    <Star className={`h-3 w-3 ${img.is_primary ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  </Button>
                  {img.master_url && (
                    <a
                      href={img.master_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-white hover:text-blue-400" title="Download">
                        <Download className="h-3 w-3" />
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-white hover:text-red-400"
                    onClick={e => { e.stopPropagation(); onRemoveImage(img.id, scene.id); }}
                    title="Remover"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reference Picker Modal */}
      <ImagePickerModal
        open={refPickerOpen}
        onOpenChange={setRefPickerOpen}
        onSelectImage={(img) => {
          onAddReference(scene.id, img.id, img.preview_url || img.master_url || undefined, img.prompt);
        }}
      />

      {/* Full-res Image Viewer */}
      <ImageViewerModal
        open={!!viewerImage}
        imageUrl={viewerImage?.full || null}
        downloadUrl={viewerImage?.download || null}
        onClose={() => setViewerImage(null)}
        onAddAsReference={viewerImage?.id && references.length < 3 ? () => {
          onAddReference(scene.id, viewerImage.id!, viewerImage.full, viewerImage.prompt);
          setViewerImage(null);
        } : undefined}
        onSendToStudioAsGrid={viewerImage?.full ? () => {
          localStorage.setItem('abrahub_pending_grid_image', JSON.stringify({
            imageUrl: viewerImage.full,
            prompt: viewerImage.prompt || '',
            sourceTimestamp: Date.now(),
          }));
          setViewerImage(null);
          toast.success('Enviando para Studio em modo Grid...');
          navigate('/');
        } : undefined}
      />
    </div>
  );
}