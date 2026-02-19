import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, Check, Film, Clock, Camera, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { StoryboardScene } from '@/hooks/useStoryboard';

interface AnimationPrompt {
  scene_number: number;
  camera_movement: string;
  motion_description: string;
  lighting: string;
  duration: string;
  full_animation_prompt: string;
}

interface AnimationBatchModalProps {
  open: boolean;
  onClose: () => void;
  scenes: StoryboardScene[];
}

export function AnimationBatchModal({ open, onClose, scenes }: AnimationBatchModalProps) {
  const [loading, setLoading] = useState(false);
  const [prompts, setPrompts] = useState<AnimationPrompt[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (scenes.length === 0) {
      toast.error('Nenhuma cena disponível');
      return;
    }

    setLoading(true);
    try {
      const scenesPayload = scenes.map(s => ({
        id: s.id,
        title: s.title,
        prompt_base: s.prompt_base,
        description: s.description,
        duration: 5,
        aspect_ratio: s.aspect_ratio,
      }));

      const { data, error } = await supabase.functions.invoke('storyboard-generate-animation-batch', {
        body: { scenes: scenesPayload, format: scenes[0]?.aspect_ratio || '16:9' },
      });

      if (error) {
        const msg = typeof error === 'object' && error.message ? error.message : 'Erro ao gerar prompts';
        toast.error(msg);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setPrompts(data?.animation_prompts || []);
      toast.success('Prompts de animação gerados!');
    } catch {
      toast.error('Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success('Prompt copiado!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            Prompts de Animação
          </DialogTitle>
        </DialogHeader>

        {prompts.length === 0 ? (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Gere prompts de animação compatíveis com Kling/Veo para todas as {scenes.length} cenas do projeto.
            </p>
            <div className="space-y-1">
              {scenes.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/30">
                  <span className="font-bold text-primary">{i + 1}</span>
                  <span className="truncate">{s.title}</span>
                </div>
              ))}
            </div>
            <Button onClick={handleGenerate} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
              {loading ? 'Gerando prompts...' : 'Gerar Prompts de Animação'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {prompts.map((p, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-background">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Cena {p.scene_number}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => handleCopy(p.full_animation_prompt, i)}
                  >
                    {copiedIndex === i ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedIndex === i ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded">
                    <Camera className="h-3 w-3" /> {p.camera_movement}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded">
                    <Clock className="h-3 w-3" /> {p.duration}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded">
                    <Lightbulb className="h-3 w-3" /> {p.lighting}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-2 rounded">
                  {p.full_animation_prompt}
                </p>
              </div>
            ))}
            <Button variant="outline" onClick={() => setPrompts([])} className="w-full">
              Gerar novamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
