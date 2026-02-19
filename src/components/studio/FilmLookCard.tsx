import { Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getOptimizedPresetUrl } from '@/lib/image-utils';
import type { PresetWithPromptBlock } from '@/hooks/usePresets';

interface FilmLookCardProps {
  film: PresetWithPromptBlock;
  selected: boolean;
  onClick: () => void;
}

export function FilmLookCard({ film, selected, onClick }: FilmLookCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border transition-all duration-200',
        'bg-background/80 hover:bg-accent/50 hover:border-primary/50',
        selected && 'ring-2 ring-primary border-primary bg-primary/10'
      )}
    >
      {/* Preview Image or Icon */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted/30">
        {film.preview_image_url ? (
          <img
            src={getOptimizedPresetUrl(film.preview_image_url, { width: 300, quality: 70 })}
            alt={film.label}
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
        
        {/* Selected Overlay */}
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
            <div className="rounded-full bg-primary p-1.5">
              <svg className="h-4 w-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="flex flex-col gap-0.5 p-2">
        <span className={cn(
          'text-xs font-medium truncate',
          selected ? 'text-primary' : 'text-foreground'
        )}>
          {film.label}
        </span>
        {film.description && (
          <span className="text-[10px] text-muted-foreground line-clamp-2">
            {film.description}
          </span>
        )}
      </div>
    </button>
  );
}
