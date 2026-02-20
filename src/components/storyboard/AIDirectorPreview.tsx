import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, RefreshCw, Loader2, Clock, Film, Copy, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';

export interface GeneratedScene {
  scene_number: number;
  name: string;
  objective: string;
  duration_seconds: number;
  visual_description: string;
  suggested_prompt_base: string;
  preset_id?: string;
  focal_length?: string;
  aperture?: string;
  camera_angle?: string;
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
  onRegenerate: (suggestions?: string) => void;
  onStructureChange: (s: GeneratedStructure) => void;
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

function SceneCard({ scene, onUpdate }: { scene: GeneratedScene; onUpdate: (u: Partial<GeneratedScene>) => void }) {
  const [videoExpanded, setVideoExpanded] = useState(false);

  return (
    <div className="w-[300px] shrink-0 h-full flex flex-col rounded-xl border border-white/10 bg-neutral-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-neutral-800/80 border-b border-white/5 shrink-0">
        <span className="font-mono text-sm font-bold text-primary tracking-widest w-6 shrink-0">
          {String(scene.scene_number).padStart(2, '0')}
        </span>
        <input
          value={scene.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-white border-none outline-none focus:bg-white/5 rounded px-1 py-0.5 transition-colors"
        />
        <span className="flex items-center gap-1 text-xs text-white/40 font-mono shrink-0">
          <Clock className="h-3 w-3" />
          {scene.duration_seconds}s
        </span>
      </div>

      {/* Emotion badge */}
      <div className="px-3 pt-2 shrink-0">
        <span className={`inline-flex text-xs px-2 py-0.5 rounded-full border ${getEmotionColor(scene.emotion)}`}>
          {scene.emotion}
        </span>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3" style={{ scrollbarWidth: 'thin' }}>
        {/* Objective — read-only */}
        {scene.objective && (
          <p className="text-xs text-white/40 italic leading-relaxed border-l-2 border-white/10 pl-2">
            {scene.objective}
          </p>
        )}

        {/* Visual description */}
        <div>
          <label className="text-[10px] font-medium text-white/30 uppercase tracking-wider block mb-1">
            Descrição Visual
          </label>
          <textarea
            value={scene.visual_description}
            onChange={e => onUpdate({ visual_description: e.target.value })}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white/70 leading-relaxed resize-none outline-none focus:border-primary/40 transition-colors"
          />
        </div>

        {/* Prompt base */}
        <div>
          <label className="text-[10px] font-medium text-white/30 uppercase tracking-wider block mb-1">
            Prompt de Imagem
          </label>
          <textarea
            value={scene.suggested_prompt_base}
            onChange={e => onUpdate({ suggested_prompt_base: e.target.value })}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white/70 font-mono leading-relaxed resize-none outline-none focus:border-primary/40 transition-colors"
          />
        </div>

        {/* Camera badges */}
        {(scene.preset_id || scene.focal_length || scene.camera_angle) && (
          <div className="flex flex-wrap gap-1.5">
            {[scene.preset_id, scene.focal_length, scene.camera_angle].filter(Boolean).map(v => (
              <span key={v} className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/30 bg-white/5">
                {v}
              </span>
            ))}
          </div>
        )}

        {/* Video prompt */}
        {scene.video_prompt && (
          <div className="border-t border-white/8 pt-2">
            <button
              className="flex items-center justify-between w-full text-xs text-primary/60 hover:text-primary/90 transition-colors"
              onClick={() => setVideoExpanded(v => !v)}
            >
              <span className="flex items-center gap-1 font-medium">
                <Film className="h-3 w-3" />
                Prompt de Vídeo
              </span>
              {videoExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {videoExpanded && (
              <div className="mt-1.5 bg-black/30 rounded-lg p-2 relative">
                <p className="text-xs font-mono text-white/40 leading-relaxed pr-6">{scene.video_prompt}</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(scene.video_prompt!); toast.success('Copiado!'); }}
                  className="absolute top-1.5 right-1.5 p-0.5 text-white/20 hover:text-white/60 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AIDirectorPreview({
  structure, onConfirm, onRegenerate, onStructureChange, canRegenerate, isRegenerating,
}: AIDirectorPreviewProps) {
  const [suggestions, setSuggestions] = useState('');
  const totalDuration = structure.scenes.reduce((acc, s) => acc + s.duration_seconds, 0);

  const updateScene = (index: number, updates: Partial<GeneratedScene>) => {
    const newScenes = [...structure.scenes];
    newScenes[index] = { ...newScenes[index], ...updates };
    onStructureChange({ ...structure, scenes: newScenes });
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>
      {/* Briefing */}
      <div className="px-5 pb-3 flex-shrink-0">
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <input
              value={structure.title}
              onChange={e => onStructureChange({ ...structure, title: e.target.value })}
              className="flex-1 bg-transparent text-sm font-bold text-white border-none outline-none focus:bg-white/5 rounded px-1 py-0.5"
            />
            <div className="shrink-0 text-right">
              <p className="text-xs text-white/30">Total</p>
              <p className="text-sm font-mono font-bold text-primary">{totalDuration}s · {structure.scenes.length} cenas</p>
            </div>
          </div>
          <textarea
            value={structure.concept}
            onChange={e => onStructureChange({ ...structure, concept: e.target.value })}
            rows={2}
            className="w-full bg-transparent text-xs text-white/50 border-none outline-none focus:bg-white/5 rounded px-1 py-0.5 resize-none leading-relaxed"
          />
        </div>
      </div>

      {/* Horizontal film strip */}
      <div
        className="overflow-x-auto px-5 pb-3"
        style={{ scrollbarWidth: 'thin', height: '420px', flexShrink: 0 }}
      >
        <div className="flex gap-3 h-full" style={{ minWidth: 'max-content' }}>
          {structure.scenes.map((scene, i) => (
            <SceneCard key={i} scene={scene} onUpdate={u => updateScene(i, u)} />
          ))}
        </div>
      </div>

      {/* Suggestions */}
      <div className="px-5 pb-3 flex-shrink-0">
        <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-3 space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-white/40 uppercase tracking-wider">
            <Lightbulb className="h-3.5 w-3.5" />
            Sugestões para regenerar
          </label>
          <Textarea
            value={suggestions}
            onChange={e => setSuggestions(e.target.value)}
            placeholder="Ex: Quero que a cena 2 seja mais dramática, adicione uma cena de transição entre 3 e 4, tom mais épico no final..."
            className="min-h-[52px] resize-none text-xs bg-white/5 border-white/10 text-white/70 placeholder:text-white/20 focus-visible:ring-primary/30"
            rows={2}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 flex-shrink-0 flex items-center justify-center gap-2 border-t border-white/8 pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRegenerate(suggestions.trim() || undefined)}
          disabled={!canRegenerate || isRegenerating}
          className="gap-1.5 text-xs"
        >
          {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {suggestions.trim() ? 'Regenerar com sugestões' : 'Regenerar'}
        </Button>
        <Button size="sm" onClick={onConfirm} className="gap-1.5 text-xs">
          <Check className="h-3.5 w-3.5" />
          Criar {structure.scenes.length} cenas no canvas
        </Button>
      </div>
    </div>
  );
}
