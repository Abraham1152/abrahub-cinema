import { useState, useEffect, useRef } from 'react';
import { Upload, Loader2, ImagePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { type PresetWithPromptBlock } from '@/hooks/usePresets';

interface PresetFormModalProps {
  open: boolean;
  preset: PresetWithPromptBlock | null;
  type: 'camera' | 'focal' | 'aperture' | 'angle' | 'film_look';
  onClose: () => void;
  onSave: () => void;
}

interface FormData {
  preset_key: string;
  label: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  preview_image_url: string;
  // Camera-specific prompt fields
  camera_body: string;
  lens_type: string;
  sensor_format: string;
  optics_behavior_text: string;
  color_science_text: string;
  sharpness_profile_text: string;
  realism_guard_text: string;
  // Focal/Aperture prompt field
  physics_description: string;
}

const initialFormData: FormData = {
  preset_key: '',
  label: '',
  description: '',
  sort_order: 0,
  is_active: true,
  preview_image_url: '',
  camera_body: '',
  lens_type: '',
  sensor_format: '',
  optics_behavior_text: '',
  color_science_text: '',
  sharpness_profile_text: '',
  realism_guard_text: '',
  physics_description: '',
};

export function PresetFormModal({
  open,
  preset,
  type,
  onClose,
  onSave,
}: PresetFormModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Populate form when editing
  useEffect(() => {
    if (preset) {
      setFormData({
        preset_key: preset.preset_key,
        label: preset.label,
        description: preset.description || '',
        sort_order: preset.sort_order,
        is_active: preset.is_active,
        preview_image_url: preset.preview_image_url || '',
        camera_body: preset.prompt_block?.camera_body || '',
        lens_type: preset.prompt_block?.lens_type || '',
        sensor_format: preset.prompt_block?.sensor_format || '',
        optics_behavior_text: preset.prompt_block?.optics_behavior_text || '',
        color_science_text: preset.prompt_block?.color_science_text || '',
        sharpness_profile_text: preset.prompt_block?.sharpness_profile_text || '',
        realism_guard_text: preset.prompt_block?.realism_guard_text || '',
        physics_description: preset.prompt_block?.physics_description || '',
      });
      // Cache-busting: force browser to reload image when opening modal
      const existingUrl = preset.preview_image_url;
      if (existingUrl) {
        const baseUrl = existingUrl.split('?')[0];
        setPreviewUrl(`${baseUrl}?v=${Date.now()}`);
      } else {
        setPreviewUrl('');
      }
    } else {
      setFormData(initialFormData);
      setPreviewUrl('');
    }
    setPreviewFile(null);
  }, [preset, open]);

  const handleChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }

    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!previewFile) return formData.preview_image_url || null;

    setIsUploading(true);
    try {
      const fileExt = previewFile.name.split('.').pop();
      const fileName = `${type}/${formData.preset_key}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('preset-images')
        .upload(fileName, previewFile, { upsert: true });

      if (uploadError) throw uploadError;

    // Get public URL with cache-busting timestamp
    const { data: urlData } = supabase.storage
      .from('preset-images')
      .getPublicUrl(fileName);

    // Add cache-busting parameter to force browser refresh
    return `${urlData.publicUrl}?v=${Date.now()}`;
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao fazer upload da imagem');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.preset_key.trim()) {
      toast.error('A chave do preset é obrigatória');
      return;
    }

    if (!formData.label.trim()) {
      toast.error('O nome do preset é obrigatório');
      return;
    }

    // Validate preset_key format
    if (!/^[a-z0-9-]+$/.test(formData.preset_key)) {
      toast.error('A chave deve conter apenas letras minúsculas, números e hífens');
      return;
    }

    setIsSaving(true);
    try {
      // Upload image if there's a new one
      const imageUrl = await uploadImage();

      if (preset) {
        // Update existing preset
        const { error: configError } = await supabase
          .from('preset_configs')
          .update({
            preset_key: formData.preset_key,
            label: formData.label,
            description: formData.description || null,
            sort_order: formData.sort_order,
            is_active: formData.is_active,
            preview_image_url: imageUrl,
            updated_by: user?.id,
          })
          .eq('id', preset.id);

        if (configError) throw configError;

        // Update or insert prompt block
        const promptBlockData = type === 'camera'
          ? {
              preset_id: preset.id,
              camera_body: formData.camera_body || null,
              lens_type: formData.lens_type || null,
              sensor_format: formData.sensor_format || null,
              optics_behavior_text: formData.optics_behavior_text || null,
              color_science_text: formData.color_science_text || null,
              sharpness_profile_text: formData.sharpness_profile_text || null,
              realism_guard_text: formData.realism_guard_text || null,
            }
          : {
              preset_id: preset.id,
              physics_description: formData.physics_description || null,
            };

        const { error: blockError } = await supabase
          .from('preset_prompt_blocks')
          .upsert(promptBlockData, { onConflict: 'preset_id' });

        if (blockError) throw blockError;

        toast.success('Preset atualizado');
      } else {
        // Create new preset
        const { data: newConfig, error: configError } = await supabase
          .from('preset_configs')
          .insert({
            preset_type: type,
            preset_key: formData.preset_key,
            label: formData.label,
            description: formData.description || null,
            sort_order: formData.sort_order,
            is_active: formData.is_active,
            preview_image_url: imageUrl,
            updated_by: user?.id,
          })
          .select()
          .single();

        if (configError) throw configError;

        // Create prompt block
        const promptBlockData = type === 'camera'
          ? {
              preset_id: newConfig.id,
              camera_body: formData.camera_body || null,
              lens_type: formData.lens_type || null,
              sensor_format: formData.sensor_format || null,
              optics_behavior_text: formData.optics_behavior_text || null,
              color_science_text: formData.color_science_text || null,
              sharpness_profile_text: formData.sharpness_profile_text || null,
              realism_guard_text: formData.realism_guard_text || null,
            }
          : {
              preset_id: newConfig.id,
              physics_description: formData.physics_description || null,
            };

        const { error: blockError } = await supabase
          .from('preset_prompt_blocks')
          .insert(promptBlockData);

        if (blockError) throw blockError;

        toast.success('Preset criado');
      }

      onSave();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Erro ao salvar preset');
    } finally {
      setIsSaving(false);
    }
  };

  const typeLabels: Record<string, string> = {
    camera: 'Camera Rig',
    angle: 'Ângulo',
    focal: 'Focal Length',
    aperture: 'Abertura',
    film_look: 'Film Look',
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {preset ? 'Editar' : 'Novo'} Preset de {typeLabels[type]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* === BASIC INFO === */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm border-b pb-2">Informações Básicas</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preset_key">Chave única (slug)</Label>
                <Input
                  id="preset_key"
                  value={formData.preset_key}
                  onChange={(e) => handleChange('preset_key', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="arri-natural"
                  disabled={!!preset} // Can't change key when editing
                />
                <p className="text-xs text-muted-foreground">
                  Identificador interno, sem espaços
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">Nome de exibição</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => handleChange('label', e.target.value)}
                  placeholder="ARRI Natural Narrative"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição curta</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Narrativa cinematográfica orgânica"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sort_order">Ordem de exibição</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => handleChange('sort_order', parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Ativo</Label>
                  <p className="text-xs text-muted-foreground">
                    Presets inativos não aparecem para usuários
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => handleChange('is_active', checked)}
                />
              </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Imagem de Preview</Label>
              <div className="flex items-start gap-4">
                <div className="w-40 h-30 rounded-lg overflow-hidden bg-muted border flex-shrink-0">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <ImagePlus className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {previewUrl ? 'Substituir' : 'Upload'} Imagem
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Recomendado: 800x600px, máx 5MB
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* === CAMERA PROMPT CONFIG === */}
          {type === 'camera' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm border-b pb-2">
                Configuração do Prompt (enviado para a API)
              </h3>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="camera_body">Camera Body</Label>
                  <Input
                    id="camera_body"
                    value={formData.camera_body}
                    onChange={(e) => handleChange('camera_body', e.target.value)}
                    placeholder="ARRI Alexa Mini LF"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lens_type">Lens Type</Label>
                  <Input
                    id="lens_type"
                    value={formData.lens_type}
                    onChange={(e) => handleChange('lens_type', e.target.value)}
                    placeholder="Cooke S4"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sensor_format">Sensor Format</Label>
                  <Input
                    id="sensor_format"
                    value={formData.sensor_format}
                    onChange={(e) => handleChange('sensor_format', e.target.value)}
                    placeholder="Large Format"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="optics_behavior_text">Optics Behavior Text</Label>
                <Textarea
                  id="optics_behavior_text"
                  value={formData.optics_behavior_text}
                  onChange={(e) => handleChange('optics_behavior_text', e.target.value)}
                  rows={3}
                  placeholder="natural depth of field consistent with large-format cinema sensors..."
                />
                <p className="text-xs text-muted-foreground">
                  Descreve o comportamento óptico da lente
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color_science_text">Color Science Text</Label>
                <Textarea
                  id="color_science_text"
                  value={formData.color_science_text}
                  onChange={(e) => handleChange('color_science_text', e.target.value)}
                  rows={3}
                  placeholder="ARRI Alexa color science, soft highlight roll-off..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sharpness_profile_text">Sharpness Profile Text</Label>
                <Textarea
                  id="sharpness_profile_text"
                  value={formData.sharpness_profile_text}
                  onChange={(e) => handleChange('sharpness_profile_text', e.target.value)}
                  rows={2}
                  placeholder="moderate sharpness, organic micro-texture..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="realism_guard_text">Realism Guard Text</Label>
                <Textarea
                  id="realism_guard_text"
                  value={formData.realism_guard_text}
                  onChange={(e) => handleChange('realism_guard_text', e.target.value)}
                  rows={2}
                  placeholder="cinematic photorealism, real optics behavior..."
                />
                <p className="text-xs text-muted-foreground">
                  Instruções para evitar "AI look"
                </p>
              </div>
            </div>
          )}

          {/* === FOCAL/APERTURE/ANGLE/FILM_LOOK PROMPT TEXT === */}
          {(type === 'focal' || type === 'aperture' || type === 'angle' || type === 'film_look') && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm border-b pb-2">
                Texto do Prompt (enviado para a API)
              </h3>

              <div className="space-y-2">
                <Label htmlFor="physics_description">Physics Description</Label>
                <Textarea
                  id="physics_description"
                  value={formData.physics_description}
                  onChange={(e) => handleChange('physics_description', e.target.value)}
                  rows={5}
                  placeholder={
                    type === 'focal'
                      ? "natural wide perspective, classic cinematography standard, minimal distortion"
                      : type === 'aperture'
                      ? "cinema standard depth of field, natural background softness, professional focus falloff"
                      : type === 'angle'
                      ? "low angle perspective looking up, conveying power and dominance, dramatic foreshortening"
                      : "orange-teal color palette, atmospheric haze, volumetric lighting, anamorphic lens flares"
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {type === 'focal'
                    ? "Descreve as características físicas desta distância focal"
                    : type === 'aperture'
                    ? "Descreve o comportamento de profundidade de campo desta abertura"
                    : type === 'angle'
                    ? "Descreve a perspectiva e composição deste ângulo de câmera"
                    : "Descreve a estética visual, paleta de cores e atmosfera deste look cinematográfico"
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              preset ? 'Salvar Alterações' : 'Criar Preset'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
