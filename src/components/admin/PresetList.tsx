import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PresetAdminCard } from './PresetAdminCard';
import { type PresetWithPromptBlock } from '@/hooks/usePresets';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PresetListProps {
  type: 'camera' | 'focal' | 'aperture' | 'angle' | 'film_look';
  presets: PresetWithPromptBlock[];
  loading: boolean;
  onEdit: (preset: PresetWithPromptBlock) => void;
  onRefresh: () => Promise<void>;
}

export function PresetList({ type, presets, loading, onEdit, onRefresh }: PresetListProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingPreset, setDeletingPreset] = useState<PresetWithPromptBlock | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggleActive = async (preset: PresetWithPromptBlock) => {
    setTogglingId(preset.id);
    try {
      const { error } = await supabase
        .from('preset_configs')
        .update({ is_active: !preset.is_active })
        .eq('id', preset.id);

      if (error) throw error;

      toast.success(preset.is_active ? 'Preset desativado' : 'Preset ativado');
      await onRefresh();
    } catch (err) {
      toast.error('Erro ao alterar status do preset');
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingPreset) return;

    setIsDeleting(true);
    try {
      // Delete from storage if there's an image
      if (deletingPreset.preview_image_url?.includes('preset-images')) {
        const path = deletingPreset.preview_image_url.split('/preset-images/')[1];
        if (path) {
          await supabase.storage.from('preset-images').remove([path]);
        }
      }

      // Delete the preset (prompt_block will cascade delete)
      const { error } = await supabase
        .from('preset_configs')
        .delete()
        .eq('id', deletingPreset.id);

      if (error) throw error;

      toast.success('Preset excluído');
      await onRefresh();
    } catch (err) {
      toast.error('Erro ao excluir preset');
      console.error(err);
    } finally {
      setIsDeleting(false);
      setDeletingPreset(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[4/3] w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (presets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nenhum preset configurado para esta categoria.</p>
        <p className="text-sm mt-1">Clique em "Novo Preset" para adicionar.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {presets.map((preset) => (
          <PresetAdminCard
            key={preset.id}
            preset={preset}
            onEdit={() => onEdit(preset)}
            onToggleActive={() => handleToggleActive(preset)}
            onDelete={() => setDeletingPreset(preset)}
            isToggling={togglingId === preset.id}
          />
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPreset} onOpenChange={() => setDeletingPreset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir preset?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o preset "{deletingPreset?.label}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
