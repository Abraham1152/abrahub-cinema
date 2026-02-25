import { useState, useEffect } from 'react';
import { Layers, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { StoryboardProject, StoryboardScene } from '@/hooks/useStoryboard';

export interface PendingSceneImage {
  imageId: string;
  imageUrl: string;
  prompt: string;
  sourceTimestamp: number;
}

interface SendToStoryboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingImage: PendingSceneImage;
  onSuccess: (projectId: string, sceneId: string) => void;
}

export function SendToStoryboardModal({
  open,
  onOpenChange,
  pendingImage,
  onSuccess,
}: SendToStoryboardModalProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<StoryboardProject[]>([]);
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [sceneRefs, setSceneRefs] = useState<Record<string, number>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingScenes, setLoadingScenes] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load projects when modal opens
  useEffect(() => {
    if (!open) return;
    setSelectedProjectId('');
    setSelectedSceneId('');
    setScenes([]);
    setSceneRefs({});
    setLoadingProjects(true);
    supabase
      .from('storyboard_projects')
      .select('id, title, updated_at, user_id, canvas_state, created_at')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setProjects((data as StoryboardProject[]) || []);
        setLoadingProjects(false);
      });
  }, [open]);

  // Load scenes and ref counts when project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      setScenes([]);
      setSceneRefs({});
      setSelectedSceneId('');
      return;
    }
    setLoadingScenes(true);
    setSelectedSceneId('');

    const fetchScenes = async () => {
      const { data: scenesData } = await supabase
        .from('storyboard_scenes')
        .select('id, title, sort_order, project_id, user_id, description, prompt_base, aspect_ratio, style_data, position_x, position_y, width, height, parent_scene_id, inherit_style, created_at, updated_at')
        .eq('project_id', selectedProjectId)
        .order('sort_order');

      const loadedScenes = (scenesData as StoryboardScene[]) || [];
      setScenes(loadedScenes);

      if (loadedScenes.length === 0) {
        // No scenes — auto-select sentinel so Confirm is enabled
        setSelectedSceneId('__new__');
      } else {
        const ids = loadedScenes.map(s => s.id);
        const { data: refData } = await supabase
          .from('storyboard_scene_references')
          .select('scene_id')
          .in('scene_id', ids);

        const counts: Record<string, number> = {};
        ids.forEach(id => (counts[id] = 0));
        (refData || []).forEach((r: { scene_id: string }) => {
          counts[r.scene_id] = (counts[r.scene_id] || 0) + 1;
        });
        setSceneRefs(counts);
      }
      setLoadingScenes(false);
    };

    fetchScenes();
  }, [selectedProjectId]);

  const handleClose = () => {
    localStorage.removeItem('abrahub_pending_scene_image');
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!selectedSceneId || !user) return;

    setSubmitting(true);

    let targetSceneId = selectedSceneId;

    // Auto-create scene if the project had none
    if (selectedSceneId === '__new__') {
      const { data: newScene, error: sceneError } = await supabase
        .from('storyboard_scenes')
        .insert({
          project_id: selectedProjectId,
          user_id: user.id,
          title: 'Cena 1',
          sort_order: 0,
          position_x: 100,
          position_y: 150,
          prompt_base: pendingImage.prompt || '',
          aspect_ratio: '16:9',
        })
        .select('id')
        .single();

      if (sceneError || !newScene) {
        toast.error('Erro ao criar cena');
        setSubmitting(false);
        return;
      }
      targetSceneId = newScene.id;
    } else {
      const refCount = sceneRefs[selectedSceneId] ?? 0;
      if (refCount >= 3) {
        toast.error('Esta cena já tem 3 referências (máximo)');
        setSubmitting(false);
        return;
      }

      const { data: existing } = await supabase
        .from('storyboard_scene_references')
        .select('id')
        .eq('scene_id', selectedSceneId)
        .eq('image_id', pendingImage.imageId)
        .maybeSingle();

      if (existing) {
        toast.error('Imagem já é referência desta cena');
        setSubmitting(false);
        return;
      }
    }

    const { error } = await supabase
      .from('storyboard_scene_references')
      .insert({
        scene_id: targetSceneId,
        image_id: pendingImage.imageId,
        user_id: user.id,
        sort_order: 0,
      });

    if (error) {
      toast.error('Erro ao adicionar referência');
      setSubmitting(false);
      return;
    }

    toast.success('Imagem adicionada ao storyboard!');
    localStorage.removeItem('abrahub_pending_scene_image');
    onSuccess(selectedProjectId, targetSceneId);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-violet-400" />
            Enviar ao Storyboard
          </DialogTitle>
        </DialogHeader>

        {/* Image preview */}
        <div className="flex gap-3 p-3 bg-secondary/50 rounded-lg">
          {pendingImage.imageUrl && (
            <img
              src={pendingImage.imageUrl}
              alt="Preview"
              className="h-14 w-20 object-cover rounded flex-shrink-0"
            />
          )}
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
            {pendingImage.prompt}
          </p>
        </div>

        <div className="space-y-4">
          {/* Project selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Projeto</label>
            {loadingProjects ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando projetos...
              </div>
            ) : projects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Nenhum projeto encontrado. Crie um projeto no Storyboard primeiro.
              </p>
            ) : (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Scene selector — only visible after project selected */}
          {selectedProjectId && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Cena</label>
              {loadingScenes ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando cenas...
                </div>
              ) : scenes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nenhuma cena encontrada — uma nova cena será criada automaticamente.
                </p>
              ) : (
                <Select value={selectedSceneId} onValueChange={setSelectedSceneId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma cena" />
                  </SelectTrigger>
                  <SelectContent>
                    {scenes.map(s => {
                      const count = sceneRefs[s.id] ?? 0;
                      const full = count >= 3;
                      return (
                        <SelectItem key={s.id} value={s.id} disabled={full}>
                          {s.title}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {full ? '(lotada)' : `(${count}/3)`}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedSceneId || submitting}
            className="gap-1.5"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
