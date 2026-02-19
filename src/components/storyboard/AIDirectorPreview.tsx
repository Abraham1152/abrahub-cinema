import { Button } from '@/components/ui/button';
import { Check, RefreshCw, Loader2, Clock, Camera, Sparkles } from 'lucide-react';

export interface GeneratedScene {
  scene_number: number;
  name: string;
  objective: string;
  duration_seconds: number;
  visual_description: string;
  suggested_prompt_base: string;
  camera_suggestion: string;
  emotion: string;
}

export interface GeneratedStructure {
  title: string;
  concept: string;
  scenes: GeneratedScene[];
}

interface AIDirectorPreviewProps {
  structure: GeneratedStructure;
  onConfirm: () => void;
  onRegenerate: () => void;
  canRegenerate: boolean;
  isRegenerating: boolean;
}

export function AIDirectorPreview({ structure, onConfirm, onRegenerate, canRegenerate, isRegenerating }: AIDirectorPreviewProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-3 rounded-lg bg-muted/50 border border-border">
        <h3 className="font-semibold text-sm">{structure.title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{structure.concept}</p>
      </div>

      {/* Scenes */}
      <div className="space-y-2">
        {structure.scenes.map((scene, i) => (
          <div key={i} className="p-3 rounded-lg border border-border bg-background hover:border-primary/20 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    {scene.scene_number}
                  </span>
                  <span className="text-sm font-medium truncate">{scene.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{scene.objective}</p>
                <p className="text-xs leading-relaxed">{scene.visual_description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" /> {scene.duration_seconds}s
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Camera className="h-3 w-3" /> {scene.camera_suggestion}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Sparkles className="h-3 w-3" /> {scene.emotion}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button onClick={onConfirm} className="flex-1 gap-2">
          <Check className="h-4 w-4" />
          Criar Cenas no Canvas
        </Button>
        <Button
          variant="outline"
          onClick={onRegenerate}
          disabled={!canRegenerate || isRegenerating}
          className="gap-2"
        >
          {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Regenerar
        </Button>
      </div>
    </div>
  );
}
