import { Camera, Focus, Aperture, Move3D } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePresets } from '@/hooks/usePresets';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface StyleData {
  presetId?: string;
  focalLength?: string;
  aperture?: string;
  cameraAngle?: string;
  filmLook?: string;
}

interface StoryboardEquipmentBarProps {
  styleData: StyleData;
  onChange: (updates: Partial<StyleData>) => void;
  readOnly?: boolean;
}

export function StoryboardEquipmentBar({ styleData, onChange, readOnly = false }: StoryboardEquipmentBarProps) {
  const { presets, loading } = usePresets();

  const currentCamera = presets.camera.find(p => p.preset_key === (styleData.presetId || 'arri-natural'));
  const currentFocal = presets.focal.find(p => p.preset_key === (styleData.focalLength || '35mm'));
  const currentAperture = presets.aperture.find(p => p.preset_key === (styleData.aperture || 'f2.8'));
  const currentAngle = presets.angle.find(p => p.preset_key === (styleData.cameraAngle || 'eye-level'));

  if (readOnly) {
    return (
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-secondary/30 flex-wrap" data-no-drag>
        <Camera className="h-3 w-3 text-primary/60 shrink-0" />
        <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
          {currentCamera?.label || styleData.presetId || 'ARRI'}
        </Badge>
        <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 bg-secondary text-muted-foreground">
          {currentFocal?.label || styleData.focalLength || '35mm'}
        </Badge>
        <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 bg-secondary text-muted-foreground">
          {currentAperture?.label || styleData.aperture || 'f/2.8'}
        </Badge>
        <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 bg-secondary text-muted-foreground">
          {currentAngle?.label || styleData.cameraAngle || 'Eye Level'}
        </Badge>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border" data-no-drag>
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1.5 px-3 py-2 border-b border-border bg-secondary/20" data-no-drag>
      {/* Camera */}
      <Select
        value={styleData.presetId || 'arri-natural'}
        onValueChange={v => onChange({ presetId: v })}
      >
        <SelectTrigger className="h-6 text-[9px] gap-1 px-1.5">
          <Camera className="h-3 w-3 text-primary/60 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.camera.map(p => (
            <SelectItem key={p.preset_key} value={p.preset_key} className="text-[10px]">
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Focal */}
      <Select
        value={styleData.focalLength || '35mm'}
        onValueChange={v => onChange({ focalLength: v })}
      >
        <SelectTrigger className="h-6 text-[9px] gap-1 px-1.5">
          <Focus className="h-3 w-3 text-primary/60 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.focal.map(p => (
            <SelectItem key={p.preset_key} value={p.preset_key} className="text-[10px]">
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Aperture */}
      <Select
        value={styleData.aperture || 'f2.8'}
        onValueChange={v => onChange({ aperture: v })}
      >
        <SelectTrigger className="h-6 text-[9px] gap-1 px-1.5">
          <Aperture className="h-3 w-3 text-primary/60 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.aperture.map(p => (
            <SelectItem key={p.preset_key} value={p.preset_key} className="text-[10px]">
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Angle */}
      <Select
        value={styleData.cameraAngle || 'eye-level'}
        onValueChange={v => onChange({ cameraAngle: v })}
      >
        <SelectTrigger className="h-6 text-[9px] gap-1 px-1.5">
          <Move3D className="h-3 w-3 text-primary/60 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.angle.map(p => (
            <SelectItem key={p.preset_key} value={p.preset_key} className="text-[10px]">
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
