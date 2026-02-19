import { useState } from 'react';
import { Camera, Aperture, Focus, Clapperboard, Check, Move3d, Film } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getOptimizedPresetUrl } from '@/lib/image-utils';
import { usePresets, type PresetWithPromptBlock } from '@/hooks/usePresets';
import { Skeleton } from '@/components/ui/skeleton';
import { FilmLookCard } from './FilmLookCard';

interface EquipmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPreset: string;
  selectedAngle: string;
  selectedFocalLength: string;
  selectedAperture: string;
  selectedFilmLook: string | null;
  onPresetChange: (id: string) => void;
  onAngleChange: (id: string) => void;
  onFocalLengthChange: (id: string) => void;
  onApertureChange: (id: string) => void;
  onFilmLookChange: (id: string | null) => void;
}

type TabType = 'preset' | 'angle' | 'focal' | 'aperture' | 'film_look';

export function EquipmentModal({
  open,
  onOpenChange,
  selectedPreset,
  selectedAngle,
  selectedFocalLength,
  selectedAperture,
  selectedFilmLook,
  onPresetChange,
  onAngleChange,
  onFocalLengthChange,
  onApertureChange,
  onFilmLookChange,
}: EquipmentModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('preset');
  const { presets, loading } = usePresets();

  const tabs = [
    { id: 'preset' as const, label: 'Câmera', icon: Clapperboard },
    { id: 'angle' as const, label: 'Ângulo', icon: Move3d },
    { id: 'focal' as const, label: 'Focal', icon: Focus },
    { id: 'aperture' as const, label: 'Abertura', icon: Aperture },
    { id: 'film_look' as const, label: 'Film Look', icon: Film },
  ];

  // Find current selections from database
  const currentPreset = presets.camera.find(p => p.preset_key === selectedPreset);
  const currentAngle = presets.angle.find(a => a.preset_key === selectedAngle);
  const currentFocal = presets.focal.find(f => f.preset_key === selectedFocalLength);
  const currentAperture = presets.aperture.find(a => a.preset_key === selectedAperture);
  const currentFilmLook = presets.film_look.find(f => f.preset_key === selectedFilmLook);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden bg-neutral-950 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-display flex items-center gap-2 text-white">
            <Camera className="h-5 w-5 text-primary" />
            Configuração de Câmera
          </DialogTitle>
          <p className="sr-only">Configure as opções de câmera, ângulo, distância focal, abertura e film look.</p>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="mt-4 overflow-y-auto max-h-[50vh] pr-2 -mr-2">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-lg bg-white/10" />
              ))}
            </div>
          ) : (
            <>
              {activeTab === 'preset' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {presets.camera.map((preset) => (
                    <PresetCard
                      key={preset.preset_key}
                      preset={preset}
                      selected={selectedPreset === preset.preset_key}
                      onClick={() => onPresetChange(preset.preset_key)}
                    />
                  ))}
                </div>
              )}

              {activeTab === 'angle' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {presets.angle.map((angle) => (
                    <AngleCard
                      key={angle.preset_key}
                      angle={angle}
                      selected={selectedAngle === angle.preset_key}
                      onClick={() => onAngleChange(angle.preset_key)}
                    />
                  ))}
                </div>
              )}

              {activeTab === 'focal' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {presets.focal.map((focal) => (
                    <FocalCard
                      key={focal.preset_key}
                      focal={focal}
                      selected={selectedFocalLength === focal.preset_key}
                      onClick={() => onFocalLengthChange(focal.preset_key)}
                    />
                  ))}
                </div>
              )}

              {activeTab === 'aperture' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {presets.aperture.map((aperture) => (
                    <ApertureCard
                      key={aperture.preset_key}
                      aperture={aperture}
                      selected={selectedAperture === aperture.preset_key}
                      onClick={() => onApertureChange(aperture.preset_key)}
                    />
                  ))}
                </div>
              )}

              {activeTab === 'film_look' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Option for no film look */}
                  <button
                    onClick={() => onFilmLookChange(null)}
                    className={cn(
                      'relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all duration-200 group text-left flex items-center justify-center',
                      !selectedFilmLook
                        ? 'border-primary ring-2 ring-primary/30 bg-primary/10'
                        : 'border-white/10 hover:border-primary/50 bg-white/5'
                    )}
                  >
                    <div className="text-center p-3">
                      <p className={cn(
                        'font-semibold text-sm uppercase tracking-wide',
                        !selectedFilmLook ? 'text-primary' : 'text-white/70'
                      )}>
                        Natural
                      </p>
                      <p className="text-white/50 text-xs mt-1">Sem color grading</p>
                    </div>
                    {!selectedFilmLook && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                  
                  {presets.film_look.map((filmLook) => (
                    <FilmLookCard
                      key={filmLook.preset_key}
                      film={filmLook}
                      selected={selectedFilmLook === filmLook.preset_key}
                      onClick={() => onFilmLookChange(filmLook.preset_key)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Summary */}
        <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
          <p className="text-xs text-white/50 mb-3">Configuração atual:</p>
          <div className="flex flex-wrap gap-2">
            <EquipmentBadge label={currentPreset?.label || 'Preset'} primary />
            <EquipmentBadge label={currentPreset?.prompt_block?.camera_body || ''} />
            <EquipmentBadge label={currentAngle?.label || 'Eye Level'} />
            <EquipmentBadge label={currentFocal?.label || ''} />
            <EquipmentBadge label={currentAperture?.label || ''} />
            {currentFilmLook && <EquipmentBadge label={`🎬 ${currentFilmLook.label}`} primary />}
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={() => onOpenChange(false)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PresetCardProps {
  preset: PresetWithPromptBlock;
  selected: boolean;
  onClick: () => void;
}

function PresetCard({ preset, selected, onClick }: PresetCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Optimize image with Supabase transformations + cache-busting
  const optimizedUrl = getOptimizedPresetUrl(preset.preview_image_url, { width: 400, quality: 70 });
  const separator = optimizedUrl.includes('?') ? '&' : '?';
  const imageSrc = preset.preview_image_url 
    ? `${optimizedUrl}${separator}v=${new Date(preset.updated_at || Date.now()).getTime()}`
    : '/placeholder.svg';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all duration-200 group text-left',
        selected
          ? 'border-primary ring-2 ring-primary/30'
          : 'border-white/10 hover:border-primary/50'
      )}
    >
      {/* Background Image */}
      <img
        src={imageSrc}
        alt={preset.label}
        className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      
      {/* Label (always visible) */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className={cn(
          'font-semibold text-sm uppercase tracking-wide line-clamp-1',
          selected ? 'text-primary' : 'text-white'
        )}>
          {preset.label}
        </p>
        <p className="text-white/60 text-xs mt-0.5 line-clamp-1">
          {preset.description}
        </p>
      </div>
      
      {/* Selection Check */}
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
          <Check className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
      
      {/* Hover Details */}
      {isHovered && (
        <div className="absolute inset-0 bg-black/95 p-4 flex flex-col justify-center transition-opacity animate-in fade-in duration-200">
          <p className="text-primary font-semibold text-sm mb-1">{preset.label}</p>
          <p className="text-white/70 text-xs mb-3 line-clamp-2">{preset.description}</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-white/40 shrink-0">Camera:</span>
              <span className="text-white/80">{preset.prompt_block?.camera_body || '-'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-white/40 shrink-0">Lente:</span>
              <span className="text-white/80">{preset.prompt_block?.lens_type || '-'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-white/40 shrink-0">Sensor:</span>
              <span className="text-white/80">{preset.prompt_block?.sensor_format || '-'}</span>
            </div>
          </div>
        </div>
      )}
    </button>
  );
}

interface AngleCardProps {
  angle: PresetWithPromptBlock;
  selected: boolean;
  onClick: () => void;
}

function AngleCard({ angle, selected, onClick }: AngleCardProps) {
  // Optimize image with Supabase transformations + cache-busting
  const optimizedUrl = getOptimizedPresetUrl(angle.preview_image_url, { width: 400, quality: 70 });
  const separator = optimizedUrl.includes('?') ? '&' : '?';
  const imageSrc = angle.preview_image_url 
    ? `${optimizedUrl}${separator}v=${new Date(angle.updated_at || Date.now()).getTime()}`
    : '/placeholder.svg';

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all duration-200 group text-left',
        selected
          ? 'border-primary ring-2 ring-primary/30'
          : 'border-white/10 hover:border-primary/50'
      )}
    >
      {/* Background Image */}
      <img
        src={imageSrc}
        alt={angle.label}
        className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      
      {/* Label */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className={cn(
          'font-semibold text-sm uppercase tracking-wide',
          selected ? 'text-primary' : 'text-white'
        )}>
          {angle.label}
        </p>
        <p className="text-white/60 text-xs mt-0.5 line-clamp-2">
          {angle.description}
        </p>
      </div>
      
      {/* Selection Check */}
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
          <Check className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}

interface FocalCardProps {
  focal: PresetWithPromptBlock;
  selected: boolean;
  onClick: () => void;
}

function FocalCard({ focal, selected, onClick }: FocalCardProps) {
  // Optimize image with Supabase transformations + cache-busting
  const optimizedUrl = getOptimizedPresetUrl(focal.preview_image_url, { width: 400, quality: 70 });
  const separator = optimizedUrl.includes('?') ? '&' : '?';
  const imageSrc = focal.preview_image_url 
    ? `${optimizedUrl}${separator}v=${new Date(focal.updated_at || Date.now()).getTime()}`
    : '/placeholder.svg';

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all duration-200 group text-left',
        selected
          ? 'border-primary ring-2 ring-primary/30'
          : 'border-white/10 hover:border-primary/50'
      )}
    >
      {/* Background Image */}
      <img
        src={imageSrc}
        alt={focal.label}
        className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      
      {/* Label */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className={cn(
          'font-bold text-2xl',
          selected ? 'text-primary' : 'text-white'
        )}>
          {focal.label}
        </p>
        <p className="text-white/60 text-xs mt-0.5">
          {focal.description}
        </p>
      </div>
      
      {/* Selection Check */}
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
          <Check className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}

interface ApertureCardProps {
  aperture: PresetWithPromptBlock;
  selected: boolean;
  onClick: () => void;
}

function ApertureCard({ aperture, selected, onClick }: ApertureCardProps) {
  // Optimize image with Supabase transformations + cache-busting
  const optimizedUrl = getOptimizedPresetUrl(aperture.preview_image_url, { width: 400, quality: 70 });
  const separator = optimizedUrl.includes('?') ? '&' : '?';
  const imageSrc = aperture.preview_image_url 
    ? `${optimizedUrl}${separator}v=${new Date(aperture.updated_at || Date.now()).getTime()}`
    : '/placeholder.svg';

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all duration-200 group text-left',
        selected
          ? 'border-primary ring-2 ring-primary/30'
          : 'border-white/10 hover:border-primary/50'
      )}
    >
      {/* Background Image */}
      <img
        src={imageSrc}
        alt={aperture.label}
        className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      
      {/* Label */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className={cn(
          'font-bold text-2xl',
          selected ? 'text-primary' : 'text-white'
        )}>
          {aperture.label}
        </p>
        <p className="text-white/60 text-xs mt-0.5">
          {aperture.description}
        </p>
      </div>
      
      {/* Selection Check */}
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
          <Check className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}

function EquipmentBadge({ label, primary }: { label: string; primary?: boolean }) {
  if (!label) return null;
  return (
    <span className={cn(
      'px-2 py-1 text-xs rounded-md border',
      primary 
        ? 'bg-primary/20 text-primary border-primary/30'
        : 'bg-white/10 text-white/70 border-white/10'
    )}>
      {label}
    </span>
  );
}
