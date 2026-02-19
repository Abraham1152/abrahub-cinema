import { Pencil, Eye, EyeOff, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type PresetWithPromptBlock } from '@/hooks/usePresets';

interface PresetAdminCardProps {
  preset: PresetWithPromptBlock;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  isToggling?: boolean;
}

export function PresetAdminCard({
  preset,
  onEdit,
  onToggleActive,
  onDelete,
  isToggling = false,
}: PresetAdminCardProps) {
  const hasPromptConfig = preset.preset_type === 'camera'
    ? !!(preset.prompt_block?.camera_body || preset.prompt_block?.optics_behavior_text)
    : !!preset.prompt_block?.physics_description;

  return (
    <Card className={cn(
      'overflow-hidden transition-opacity',
      !preset.is_active && 'opacity-60'
    )}>
      {/* Preview Image */}
      <div className="aspect-[4/3] relative overflow-hidden bg-muted">
        {preset.preview_image_url ? (
          <img
            src={`${preset.preview_image_url.split('?')[0]}?v=${new Date(preset.updated_at || Date.now()).getTime()}`}
            alt={preset.label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <span className="text-sm">Sem imagem</span>
          </div>
        )}

        {/* Status Badge */}
        {!preset.is_active && (
          <Badge 
            className="absolute top-2 left-2" 
            variant="secondary"
          >
            Inativo
          </Badge>
        )}

        {/* Config Status */}
        {!hasPromptConfig && (
          <Badge 
            className="absolute top-2 right-2 bg-warning text-warning-foreground" 
            variant="outline"
          >
            Sem config
          </Badge>
        )}
      </div>

      {/* Info */}
      <CardContent className="p-3">
        <h4 className="font-semibold text-sm line-clamp-1">{preset.label}</h4>
        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
          {preset.description || 'Sem descrição'}
        </p>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          key: {preset.preset_key}
        </p>
        {preset.preset_type === 'camera' && preset.prompt_block?.camera_body && (
          <p className="text-xs text-muted-foreground mt-0.5">
            📷 {preset.prompt_block.camera_body}
          </p>
        )}
      </CardContent>

      {/* Actions */}
      <CardFooter className="p-3 pt-0 gap-1.5 flex-wrap">
        <Button size="sm" variant="outline" onClick={onEdit} className="flex-1 min-w-0">
          <Pencil className="h-3 w-3 mr-1" />
          Editar
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={onToggleActive}
          disabled={isToggling}
          className="px-2"
        >
          {isToggling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : preset.is_active ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={onDelete}
          className="px-2 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </CardFooter>
    </Card>
  );
}
