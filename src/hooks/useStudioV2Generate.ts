import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface V2GenerationRequest {
  prompt: string;
  aspectRatio: string;
  quality: '2K' | '4K';
  presetId: string;
  focalLength: string;
  aperture: string;
  cameraAngle?: string;
  filmLook?: string | null;
  referenceImages?: string[];
  useOwnKey?: boolean;
}

export interface V2GenerationResult {
  imageId: string | null;
  base64: string;
  mimeType: string;
  prompt: string;
  modelLabel: string;
  creditsCost: number;
}

export function useStudioV2Generate() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (request: V2GenerationRequest): Promise<V2GenerationResult | null> => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('studio-v2-generate', {
        body: request,
      });

      if (error) {
        // Try to parse error body
        const errMsg = typeof error === 'object' && error.message ? error.message : 'Erro na geração';
        toast.error(errMsg);
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      if (!data?.success || !data?.base64) {
        toast.error('Resposta inesperada do servidor');
        return null;
      }

      return {
        imageId: data.imageId,
        base64: data.base64,
        mimeType: data.mimeType,
        prompt: data.prompt,
        modelLabel: data.modelLabel,
        creditsCost: data.creditsCost,
      };
    } catch (err) {
      console.error('[useStudioV2Generate] Error:', err);
      toast.error(err instanceof Error ? err.message : 'Erro inesperado');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generate, isGenerating };
}
