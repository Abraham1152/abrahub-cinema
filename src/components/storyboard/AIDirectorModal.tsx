import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Clapperboard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AIDirectorPreview, type GeneratedStructure } from './AIDirectorPreview';
import { cn } from '@/lib/utils';

interface AIDirectorModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (structure: GeneratedStructure, format: string) => void;
}

// Toggle pill button
function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-white/5 text-white/50 border-white/10 hover:border-white/25 hover:text-white/75'
      )}
    >
      {label}
    </button>
  );
}

// Format visual button (shows aspect ratio as rectangle)
function FormatButton({
  value,
  label,
  active,
  onClick,
}: {
  value: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const isLandscape = value === '16:9';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg border transition-all',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-white/10 bg-white/5 text-white/40 hover:border-white/25 hover:text-white/60'
      )}
    >
      {/* Visual rectangle */}
      <div
        className={cn(
          'rounded border-2 transition-colors',
          active ? 'border-primary' : 'border-current'
        )}
        style={isLandscape ? { width: 32, height: 18 } : { width: 18, height: 32 }}
      />
      <span className="text-[10px] font-mono">{label}</span>
    </button>
  );
}

const TYPES = [
  { value: 'campanha', label: '🎬 Campanha' },
  { value: 'curta', label: '📽️ Curta' },
  { value: 'teaser', label: '⚡ Teaser' },
  { value: 'comercial', label: '📺 Comercial' },
  { value: 'social', label: '📱 Social' },
];

const DURATIONS = [
  { value: '10s', label: '10s' },
  { value: '30s', label: '30s' },
  { value: '60s', label: '60s' },
];

const TONES = [
  { value: 'cinematografico', label: '🎥 Cinematográfico' },
  { value: 'emocional', label: '💙 Emocional' },
  { value: 'humor', label: '😄 Humor' },
  { value: 'dramatico', label: '🎭 Dramático' },
  { value: 'epico', label: '⚡ Épico' },
];

export function AIDirectorModal({ open, onClose, onConfirm }: AIDirectorModalProps) {
  const [objective, setObjective] = useState('');
  const [type, setType] = useState('campanha');
  const [duration, setDuration] = useState('30s');
  const [format, setFormat] = useState('16:9');
  const [tone, setTone] = useState('cinematografico');
  const [loading, setLoading] = useState(false);
  const [structure, setStructure] = useState<GeneratedStructure | null>(null);

  // Rate limit: max 3 per minute
  const regenTimestamps = useRef<number[]>([]);

  const canRegenerate = () => {
    const now = Date.now();
    regenTimestamps.current = regenTimestamps.current.filter(t => now - t < 60000);
    return regenTimestamps.current.length < 3;
  };

  const handleGenerate = async () => {
    if (!objective.trim()) {
      toast.error('Descreva o objetivo do projeto');
      return;
    }
    if (!canRegenerate()) {
      toast.error('Máximo de 3 gerações por minuto. Aguarde.');
      return;
    }

    setLoading(true);
    regenTimestamps.current.push(Date.now());

    try {
      const { data, error } = await supabase.functions.invoke('storyboard-generate-structure', {
        body: { objective: objective.trim(), type, duration, format, tone },
      });

      if (error) {
        const msg = typeof error === 'object' && error.message ? error.message : 'Erro ao gerar estrutura';
        toast.error(msg);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setStructure(data as GeneratedStructure);
    } catch {
      toast.error('Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!structure) return;
    onConfirm(structure, format);
    setStructure(null);
    setObjective('');
    onClose();
  };

  const handleClose = () => {
    setStructure(null);
    onClose();
  };

  // Preview state
  if (structure) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-neutral-950 border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Clapperboard className="h-5 w-5 text-primary" />
              AI Director — Estrutura da Campanha
            </DialogTitle>
          </DialogHeader>
          <AIDirectorPreview
            structure={structure}
            onConfirm={handleConfirm}
            onRegenerate={handleGenerate}
            canRegenerate={canRegenerate()}
            isRegenerating={loading}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Input form
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-neutral-950 border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Clapperboard className="h-5 w-5 text-primary" />
            AI Director
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {/* Objective */}
          <div>
            <label className="text-xs font-medium text-white/60 mb-2 block uppercase tracking-wider">
              Objetivo do projeto
            </label>
            <Textarea
              value={objective}
              onChange={e => setObjective(e.target.value)}
              placeholder="Ex: Campanha cinematográfica para o lançamento do novo iPhone, mostrando tecnologia + emoção humana..."
              className="min-h-[72px] resize-none bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm"
              maxLength={500}
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-medium text-white/60 mb-2 block uppercase tracking-wider">
              Tipo
            </label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(t => (
                <Pill key={t.value} label={t.label} active={type === t.value} onClick={() => setType(t.value)} />
              ))}
            </div>
          </div>

          {/* Duration + Format in a row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-white/60 mb-2 block uppercase tracking-wider">
                Duração
              </label>
              <div className="flex gap-2">
                {DURATIONS.map(d => (
                  <Pill key={d.value} label={d.label} active={duration === d.value} onClick={() => setDuration(d.value)} />
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-white/60 mb-2 block uppercase tracking-wider">
                Formato
              </label>
              <div className="flex gap-2">
                <FormatButton value="16:9" label="16:9" active={format === '16:9'} onClick={() => setFormat('16:9')} />
                <FormatButton value="9:16" label="9:16" active={format === '9:16'} onClick={() => setFormat('9:16')} />
              </div>
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="text-xs font-medium text-white/60 mb-2 block uppercase tracking-wider">
              Tom
            </label>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <Pill key={t.value} label={t.label} active={tone === t.value} onClick={() => setTone(t.value)} />
              ))}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !objective.trim()}
            className="w-full gap-2 mt-1"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
            {loading ? 'Gerando estrutura...' : 'Gerar Estrutura'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
