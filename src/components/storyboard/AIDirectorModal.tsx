import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Clapperboard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AIDirectorPreview, type GeneratedStructure } from './AIDirectorPreview';

interface AIDirectorModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (structure: GeneratedStructure, format: string) => void;
}

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
    } catch (err) {
      toast.error('Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!structure) return;
    onConfirm(structure, format);
    // Reset
    setStructure(null);
    setObjective('');
    onClose();
  };

  const handleClose = () => {
    setStructure(null);
    onClose();
  };

  // If we have a structure, show preview
  if (structure) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clapperboard className="h-5 w-5 text-primary" />
              AI Director — Preview
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-primary" />
            AI Director
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Objetivo do projeto</label>
            <Textarea
              value={objective}
              onChange={e => setObjective(e.target.value)}
              placeholder="Ex: Campanha cinematográfica para o lançamento do novo iPhone..."
              className="min-h-[80px] resize-none"
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tipo</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="campanha">Campanha</SelectItem>
                  <SelectItem value="curta">Curta</SelectItem>
                  <SelectItem value="teaser">Teaser</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Duração total</label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10s">10 segundos</SelectItem>
                  <SelectItem value="30s">30 segundos</SelectItem>
                  <SelectItem value="60s">60 segundos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Formato</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                  <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tom</label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cinematografico">Cinematográfico</SelectItem>
                  <SelectItem value="emocional">Emocional</SelectItem>
                  <SelectItem value="humor">Humor</SelectItem>
                  <SelectItem value="dramatico">Dramático</SelectItem>
                  <SelectItem value="epico">Épico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={loading || !objective.trim()} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
            {loading ? 'Gerando estrutura...' : 'Gerar Estrutura'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
