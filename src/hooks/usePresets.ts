import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PresetConfig {
  id: string;
  preset_type: 'camera' | 'focal' | 'aperture' | 'angle' | 'film_look';
  preset_key: string;
  label: string;
  description: string | null;
  preview_image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface PresetPromptBlock {
  id: string;
  preset_id: string;
  camera_body: string | null;
  lens_type: string | null;
  sensor_format: string | null;
  optics_behavior_text: string | null;
  color_science_text: string | null;
  sharpness_profile_text: string | null;
  realism_guard_text: string | null;
  physics_description: string | null;
}

export interface PresetWithPromptBlock extends PresetConfig {
  prompt_block?: PresetPromptBlock | null;
}

export function usePresets(includeInactive = false) {
  const [presets, setPresets] = useState<{
    camera: PresetWithPromptBlock[];
    focal: PresetWithPromptBlock[];
    aperture: PresetWithPromptBlock[];
    angle: PresetWithPromptBlock[];
    film_look: PresetWithPromptBlock[];
  }>({
    camera: [],
    focal: [],
    aperture: [],
    angle: [],
    film_look: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPresets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('preset_configs')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data: configs, error: configError } = await query;

      if (configError) throw configError;

      // Fetch prompt blocks for all presets
      const { data: promptBlocks, error: blockError } = await supabase
        .from('preset_prompt_blocks')
        .select('*');

      if (blockError) throw blockError;

      // Create a map of preset_id to prompt_block
      const blockMap = new Map<string, PresetPromptBlock>();
      promptBlocks?.forEach(block => {
        blockMap.set(block.preset_id, block);
      });

      // Group by type with prompt blocks attached
      const grouped: {
        camera: PresetWithPromptBlock[];
        focal: PresetWithPromptBlock[];
        aperture: PresetWithPromptBlock[];
        angle: PresetWithPromptBlock[];
        film_look: PresetWithPromptBlock[];
      } = {
        camera: [],
        focal: [],
        aperture: [],
        angle: [],
        film_look: [],
      };

      configs?.forEach(config => {
        const presetWithBlock: PresetWithPromptBlock = {
          ...config,
          preset_type: config.preset_type as 'camera' | 'focal' | 'aperture' | 'angle' | 'film_look',
          prompt_block: blockMap.get(config.id) || null,
        };

        if (config.preset_type === 'camera') {
          grouped.camera.push(presetWithBlock);
        } else if (config.preset_type === 'focal') {
          grouped.focal.push(presetWithBlock);
        } else if (config.preset_type === 'aperture') {
          grouped.aperture.push(presetWithBlock);
        } else if (config.preset_type === 'angle') {
          grouped.angle.push(presetWithBlock);
        } else if (config.preset_type === 'film_look') {
          grouped.film_look.push(presetWithBlock);
        }
      });

      setPresets(grouped);
    } catch (err) {
      console.error('Error fetching presets:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar presets');
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  return {
    presets,
    loading,
    error,
    refetch: fetchPresets,
  };
}

// Helper to get a single preset by key (for EquipmentModal)
export function usePresetByKey(type: 'camera' | 'focal' | 'aperture' | 'angle' | 'film_look', key: string) {
  const { presets, loading, error } = usePresets();
  
  const preset = presets[type].find(p => p.preset_key === key);
  
  return { preset, loading, error };
}

// Format preset for display in EquipmentModal (compatible with existing interface)
export function formatPresetForDisplay(preset: PresetWithPromptBlock) {
  if (preset.preset_type === 'camera') {
    return {
      id: preset.preset_key,
      label: preset.label,
      description: preset.description || '',
      cameraBody: preset.prompt_block?.camera_body || '',
      lensType: preset.prompt_block?.lens_type || '',
      sensorFormat: preset.prompt_block?.sensor_format || '',
      previewImage: preset.preview_image_url || '/placeholder.svg',
      opticsBehaviorText: preset.prompt_block?.optics_behavior_text || '',
      colorScienceText: preset.prompt_block?.color_science_text || '',
      sharpnessProfileText: preset.prompt_block?.sharpness_profile_text || '',
      realismGuardText: preset.prompt_block?.realism_guard_text || '',
    };
  }

  return {
    id: preset.preset_key,
    label: preset.label,
    description: preset.description || '',
    previewImage: preset.preview_image_url || '/placeholder.svg',
    physicsDescription: preset.prompt_block?.physics_description || '',
  };
}
