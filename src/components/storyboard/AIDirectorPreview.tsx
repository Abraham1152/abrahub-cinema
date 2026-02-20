import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, RefreshCw, Loader2, Clock, Camera, ChevronDown, ChevronUp, Film, Copy } from 'lucide-react';
import { toast } from 'sonner';

export interface GeneratedScene {
  scene_number: number;
  name: string;
  objective: string;
  duration_seconds: number;
  visual_description: string;
  suggested_prompt_base: string;
  camera_suggestion: string;
  emotion: string;
  video_prompt?: string;
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

const EMOTION_COLORS: Record<string, string> = {
  alegria: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  tristeza: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  tensão: 'bg-red-500/20 text-red-300 border-red-500/30',
  esperança: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  nostalgia: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  suspense: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  euforia: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  melancolia: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  default: 'bg-white/10 text-white/60 border-white/20',
};

function getEmotionColor(emotion: string): string {
  const key = emotion?.toLowerCase().trim();
  return EMOTION_COLORS[key] || EMOTION_COLORS.default;
}

function SceneCard({ scene, index, total }: { scene: GeneratedScene; index: number; total: number }) {
  const [videoExpanded, setVideoExpanded] = useState(false);

  const copyVideoPrompt = () => {
    if (!scene.video_prompt) return;
    navigator.clipboard.writeText(scene.video_prompt);
    toast.success('Prompt de vídeo copiado!');
  };

  return (
    <div className="flex items-start gap-0 flex-shrink-0">
      {/* Scene card */}
      <div className="w-52 rounded-xl border border-white/10 bg-neutral-900 flex flex-col overflow-hidden">
        {/* Frame number bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-neutral-800/80 border-b border-white/5 flex-shrink-0">
          <span className="font-mono text-xs font-bold text-primary tracking-widest">
            {String(scene.scene_number).padStart(2, '0')}
          </span>
          <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider">frame</span>
        </div>

        {/* Content */}
        <div className="flex flex-col p-3 gap-2">
          {/* Scene name */}
          <p className="text-xs font-semibold text-white leading-tight line-clamp-1">
            {scene.name}
          </p>

          {/* Visual description */}
          <p className="text-[11px] text-white/50 leading-relaxed line-clamp-3">
            {scene.visual_description}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/8">
            <span className="flex items-center gap-1 text-[10px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/8">
              <Clock className="h-2.5 w-2.5" />
              {scene.duration_seconds}s
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getEmotionColor(scene.emotion)}`}>
              {scene.emotion}
            </span>
          </div>

          {/* Camera */}
          <div className="flex items-start gap-1 text-[10px] text-white/35">
            <Camera className="h-2.5 w-2.5 mt-0.5 shrink-0" />
            <span className="leading-tight line-clamp-2">{scene.camera_suggestion}</span>
          </div>

          {/* Video prompt */}
          {scene.video_prompt && (
            <div className="border-t border-white/8 pt-2">
              <button
                className="flex items-center justify-between w-full text-[10px] text-primary/80 hover:text-primary transition-colors"
                onClick={() => setVideoExpanded(v => !v)}
              >
                <span className="flex items-center gap-1 font-medium">
                  <Film className="h-2.5 w-2.5" />
                  Prompt de Vídeo
                </span>
                {videoExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
              </button>
              {videoExpanded && (
                <div className="mt-1.5 bg-black/30 rounded-lg p-2 relative">
                  <p className="text-[10px] font-mono text-white/50 leading-relaxed pr-5">
                    {scene.video_prompt}
                  </p>
                  <button
                    onClick={copyVideoPrompt}
                    className="absolute top-1.5 right-1.5 p-0.5 text-white/30 hover:text-white/70 transition-colors"
                    title="Copiar"
                  >
                    <Copy className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Arrow between cards */}
      {index < total - 1 && (
        <div className="flex items-center self-center px-1 text-white/20 flex-shrink-0">
          <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
            <path d="M0 6h22M22 6l-5-4M22 6l-5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

export function AIDirectorPreview({ structure, onConfirm, onRegenerate, canRegenerate, isRegenerating }: AIDirectorPreviewProps) {
  const totalDuration = structure.scenes.reduce((acc, s) => acc + s.duration_seconds, 0);

  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>
      {/* Fixed header — title + concept */}
      <div className="px-5 pb-3 flex-shrink-0">
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-white truncate">{structure.title}</h3>
              <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{structure.concept}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-[10px] text-white/30">Total</p>
              <p className="text-sm font-mono font-bold text-primary">{totalDuration}s</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable film strip — only this part scrolls */}
      <div className="overflow-x-auto flex-shrink-0 px-5 pb-3" style={{ scrollbarWidth: 'thin' }}>
        <div className="flex items-start gap-0 w-max py-1">
          {structure.scenes.map((scene, i) => (
            <SceneCard key={i} scene={scene} index={i} total={structure.scenes.length} />
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center gap-1.5 justify-center pb-4 flex-shrink-0">
        {structure.scenes.map((_, i) => (
          <div key={i} className="h-1 w-6 rounded-full bg-primary/30" />
        ))}
      </div>

      {/* Fixed footer — small centered buttons */}
      <div className="px-5 pb-5 flex-shrink-0 flex items-center justify-center gap-2 border-t border-white/8 pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={!canRegenerate || isRegenerating}
          className="gap-1.5 text-xs"
        >
          {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Regenerar
        </Button>
        <Button
          size="sm"
          onClick={onConfirm}
          className="gap-1.5 text-xs"
        >
          <Check className="h-3.5 w-3.5" />
          Criar {structure.scenes.length} cenas no canvas
        </Button>
      </div>
    </div>
  );
}
