import { useState, useRef, useCallback } from 'react';
import { Camera, Sparkles, Plus, X, Loader2, ImagePlus, Minus, Diamond, Monitor, Key, Film, Upload, Images, User, MapPin, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  ASPECT_RATIO_OPTIONS, 
  FOCAL_LENGTH_OPTIONS,
  APERTURE_OPTIONS
} from '@/config/cinema-equipment';
import { CINEMA_PRESETS } from '@/config/cinema-presets';
import { EquipmentModal } from './EquipmentModal';
import { ImagePickerModal } from '@/components/storyboard/ImagePickerModal';

const MAX_IMAGE_SIZE_MB = 10;

export type QualityOption = '2K' | '4K';

export const QUALITY_OPTIONS: { id: QualityOption; label: string; creditMultiplier: number }[] = [
  { id: '2K', label: '2K', creditMultiplier: 1 },
  { id: '4K', label: '4K', creditMultiplier: 1.5 },
];

interface RealismFloatingBarProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  selectedAspectRatio: string;
  onAspectRatioChange: (ratio: string) => void;
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
  onGenerate: () => void;
  isGenerating: boolean;
  creditCost: number;
  availableCredits: number;
  referenceImages: string[];
  onReferenceImagesChange: (images: string[]) => void;
  maxReferenceImages?: number;
  batchSize: number;
  onBatchSizeChange: (size: number) => void;
  selectedQuality: QualityOption;
  onQualityChange: (quality: QualityOption) => void;
  useOwnKey: boolean;
  onUseOwnKeyChange: (value: boolean) => void;
  hasValidApiKey: boolean;
  sequenceMode: boolean;
  onSequenceModeChange: (value: boolean) => void;
  sequenceKeepCharacter: boolean;
  onSequenceKeepCharacterChange: (value: boolean) => void;
  sequenceKeepScenery: boolean;
  onSequenceKeepSceneryChange: (value: boolean) => void;
  storyboard6Mode: boolean;
  onStoryboard6ModeChange: (value: boolean) => void;
}

export function RealismFloatingBar({
  prompt,
  onPromptChange,
  selectedAspectRatio,
  onAspectRatioChange,
  selectedPreset,
  selectedFilmLook,
  onFilmLookChange,
  selectedAngle,
  selectedFocalLength,
  selectedAperture,
  onPresetChange,
  onAngleChange,
  onFocalLengthChange,
  onApertureChange,
  onGenerate,
  isGenerating,
  creditCost,
  availableCredits,
  referenceImages,
  onReferenceImagesChange,
  maxReferenceImages = 3,
  batchSize,
  onBatchSizeChange,
  selectedQuality,
  onQualityChange,
  useOwnKey,
  onUseOwnKeyChange,
  hasValidApiKey,
  sequenceMode,
  onSequenceModeChange,
  sequenceKeepCharacter,
  onSequenceKeepCharacterChange,
  sequenceKeepScenery,
  onSequenceKeepSceneryChange,
  storyboard6Mode,
  onStoryboard6ModeChange,
}: RealismFloatingBarProps) {
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: FileList) => {
    if (referenceImages.length >= maxReferenceImages) {
      toast.error(`Máximo ${maxReferenceImages} imagens de referência`);
      return;
    }

    setIsProcessingImages(true);
    const newImages: string[] = [];
    const remainingSlots = maxReferenceImages - referenceImages.length;

    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const fileSizeMB = file.size / (1024 * 1024);

      // Validate size limit - no compression, just reject if too large
      if (fileSizeMB > MAX_IMAGE_SIZE_MB) {
        toast.error(`Imagem ${i + 1} excede o limite de ${MAX_IMAGE_SIZE_MB}MB. Por favor, use uma imagem menor.`);
        continue;
      }

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
        newImages.push(base64);
      } catch (error) {
        console.error('Error processing image:', error);
        toast.error(`Erro ao processar imagem ${i + 1}`);
      }
    }

    if (newImages.length > 0) {
      onReferenceImagesChange([...referenceImages, ...newImages]);
      toast.success(`${newImages.length} imagem(ns) adicionada(s)`);
    }
    setIsProcessingImages(false);
  }, [referenceImages, maxReferenceImages, onReferenceImagesChange]);

  // Handle paste from clipboard (Ctrl+V / Cmd+V)
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault(); // Prevent pasting image as text
      const dt = new DataTransfer();
      imageFiles.forEach(f => dt.items.add(f));
      processFiles(dt.files);
    }
  }, [processFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeReferenceImage = (index: number) => {
    const newImages = referenceImages.filter((_, i) => i !== index);
    onReferenceImagesChange(newImages);
  };

  // Get current preset info
  const currentPreset = CINEMA_PRESETS.find(p => p.id === selectedPreset);
  const currentFocal = FOCAL_LENGTH_OPTIONS.find(f => f.id === selectedFocalLength);
  const currentAperture = APERTURE_OPTIONS.find(a => a.id === selectedAperture);

  const presetLabel = currentPreset?.label.split(' ').slice(0, 2).join(' ') || 'Camera Rig';
  const lensInfo = currentPreset && currentFocal && currentAperture
    ? `${currentPreset.lensType.split(' ')[0]}, ${currentFocal.label}, ${currentAperture.label}`
    : '';

  return (
    <>
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 p-4 transition-all',
          isDragging && 'bg-primary/10'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm border-2 border-dashed border-primary rounded-t-2xl">
            <div className="text-center">
              <ImagePlus className="h-10 w-10 text-primary mx-auto mb-2" />
              <p className="text-primary font-medium">Solte as imagens de referência</p>
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto">
          <div className="bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4">
            {/* Reference Images Row */}
            <div className="flex items-center gap-2 mb-3">
              {/* Reference image slots */}
              {Array.from({ length: maxReferenceImages }).map((_, idx) => {
                const img = referenceImages[idx];
                return img ? (
                  <div key={idx} className="relative group">
                    <img 
                      src={img} 
                      alt={`Referência ${idx + 1}`} 
                      className="w-16 h-16 rounded-lg object-cover border border-white/10" 
                    />
                    <button 
                      onClick={() => removeReferenceImage(idx)} 
                      className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : idx === referenceImages.length ? (
                  <Popover key={idx} open={addMenuOpen} onOpenChange={setAddMenuOpen}>
                    <PopoverTrigger asChild>
                      <button
                        disabled={isProcessingImages}
                        className="w-16 h-16 rounded-lg border border-dashed border-white/20 bg-white/5 flex items-center justify-center hover:border-white/40 hover:bg-white/10 transition-all"
                      >
                        {isProcessingImages ? (
                          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                        ) : (
                          <Plus className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1" side="top" align="start">
                      <button
                        className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                        onClick={() => {
                          setAddMenuOpen(false);
                          fileInputRef.current?.click();
                        }}
                      >
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        Enviar do dispositivo
                      </button>
                      <button
                        className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                        onClick={() => {
                          setAddMenuOpen(false);
                          setGalleryOpen(true);
                        }}
                      >
                        <Images className="h-4 w-4 text-muted-foreground" />
                        Minhas gerações
                      </button>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div
                    key={idx}
                    className="w-16 h-16 rounded-lg border border-dashed border-white/10 bg-white/5 opacity-50"
                  />
                );
              })}
              <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*" 
                multiple 
                className="hidden" 
                onChange={handleFileSelect} 
              />
            </div>

            {/* Prompt Input */}
            <div className="mb-3">
              <Textarea 
                value={prompt} 
                onChange={(e) => onPromptChange(e.target.value)} 
                placeholder="Cole uma imagem (Ctrl+V) ou descreva a cena..." 
                className="min-h-[48px] max-h-[100px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm text-white/90 placeholder:text-white/40 p-0" 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const canGenerate = prompt.trim() || (storyboard6Mode && referenceImages.length > 0);
                    if (!isGenerating && canGenerate) onGenerate();
                  }
                }}
                onPaste={handlePaste}
              />
            </div>

            {/* Controls Row */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">

              {/* Aspect ratio */}
              <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-3 py-1.5">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedAspectRatio} onValueChange={onAspectRatioChange}>
                  <SelectTrigger className="w-14 h-6 border-0 bg-transparent p-0 text-sm text-white focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIO_OPTIONS.map((ratio) => (
                      <SelectItem key={ratio.id} value={ratio.id}>
                        <span className="font-medium">{ratio.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quality selector */}
              <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-3 py-1.5">
                <Diamond className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedQuality} onValueChange={(v) => onQualityChange(v as QualityOption)}>
                  <SelectTrigger className="w-12 h-6 border-0 bg-transparent p-0 text-sm text-white focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALITY_OPTIONS.map((quality) => (
                      <SelectItem key={quality.id} value={quality.id}>
                        <span className="font-medium">{quality.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sequence toggle with popover sub-options */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
                      sequenceMode 
                        ? "bg-[#CCFF00] text-black border border-[#CCFF00]/60" 
                        : "bg-white/5 text-muted-foreground hover:bg-white/10"
                    )}
                    title={sequenceMode ? "Modo Sequência ativo" : "Configurar modo Sequência"}
                  >
                    <Film className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Sequência</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2 bg-[#1a1a1a] border border-white/10" side="top" align="start">
                  <div className="space-y-2">
                    <button
                    onClick={() => {
                      const newValue = !sequenceMode;
                      onSequenceModeChange(newValue);
                      if (newValue && storyboard6Mode) {
                        onStoryboard6ModeChange(false);
                      }
                    }}
                      className={cn(
                        "flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors",
                        sequenceMode
                          ? "bg-[#CCFF00]/20 text-[#CCFF00] font-medium"
                          : "text-white hover:bg-white/10"
                      )}
                    >
                      <Film className="h-4 w-4" />
                      {sequenceMode ? "Sequência ativa" : "Ativar Sequência"}
                    </button>
                    {sequenceMode && (
                      <>
                        <div className="border-t border-white/10" />
                        <p className="text-[10px] text-muted-foreground px-2">Manter da referência:</p>
                        <button
                          onClick={() => onSequenceKeepSceneryChange(!sequenceKeepScenery)}
                          className={cn(
                            "flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors",
                            sequenceKeepScenery
                              ? "bg-[#CCFF00]/20 text-[#CCFF00] font-medium"
                              : "text-white/70 hover:bg-white/10"
                          )}
                        >
                          <MapPin className="h-4 w-4" />
                          Cenário
                        </button>
                        <button
                          onClick={() => onSequenceKeepCharacterChange(!sequenceKeepCharacter)}
                          className={cn(
                            "flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors",
                            sequenceKeepCharacter
                              ? "bg-[#CCFF00]/20 text-[#CCFF00] font-medium"
                              : "text-white/70 hover:bg-white/10"
                          )}
                        >
                          <User className="h-4 w-4" />
                          Personagem
                        </button>
                        {!sequenceKeepScenery && !sequenceKeepCharacter && (
                          <p className="text-[10px] text-white/40 px-2">Apenas estilo visual</p>
                        )}
                      </>
                    )}
                    {sequenceMode && referenceImages.length === 0 && (
                      <p className="text-[10px] text-yellow-400/80 px-2">⚠ Adicione uma imagem de referência</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Grid toggle */}
              <button
                onClick={() => {
                  const newValue = !storyboard6Mode;
                  onStoryboard6ModeChange(newValue);
                  if (newValue && sequenceMode) {
                    onSequenceModeChange(false);
                  }
                }}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
                  storyboard6Mode 
                    ? "bg-[#CCFF00] text-black border border-[#CCFF00]/60" 
                    : "bg-white/5 text-muted-foreground hover:bg-white/10"
                )}
                title={storyboard6Mode ? "Grid ativo" : "Gerar painel com 6 cenas em grid"}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              {storyboard6Mode && referenceImages.length === 0 && (
                <span className="text-[10px] text-yellow-400/80">⚠ Ref</span>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Equipment/Preset button */}
              <button 
                onClick={() => setEquipmentOpen(true)} 
                className="hidden md:flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 border border-primary/30 hover:border-primary/50 transition-all shrink-0"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Camera className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">{presetLabel}</p>
                  {lensInfo && (
                    <p className="text-xs text-white/50">{lensInfo}</p>
                  )}
                </div>
              </button>

              {/* Mobile equipment button */}
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setEquipmentOpen(true)} 
                className="md:hidden shrink-0 h-10 w-10 border border-primary/50 text-primary bg-white/5"
              >
                <Camera className="h-5 w-5" />
              </Button>

              {/* Generate button */}
              <Button 
                onClick={onGenerate} 
                disabled={isGenerating || (!prompt.trim() && !(storyboard6Mode && referenceImages.length > 0))}
                className="shrink-0 bg-[#CCFF00] text-black hover:bg-[#DFFF33] font-black px-8 h-12 rounded-xl text-lg shadow-[0_0_20px_rgba(204,255,0,0.4)] transition-all active:scale-95"
              >
                {isGenerating ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <span className="mr-2">GENERATE</span>
                    <Sparkles className="h-5 w-5 fill-current" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <EquipmentModal 
        open={equipmentOpen} 
        onOpenChange={setEquipmentOpen} 
        selectedPreset={selectedPreset}
        selectedAngle={selectedAngle}
        selectedFocalLength={selectedFocalLength} 
        selectedAperture={selectedAperture}
        selectedFilmLook={selectedFilmLook}
        onPresetChange={onPresetChange}
        onAngleChange={onAngleChange}
        onFocalLengthChange={onFocalLengthChange} 
        onApertureChange={onApertureChange}
        onFilmLookChange={onFilmLookChange}
      />
      <ImagePickerModal
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onSelectImage={async (img) => {
          const imageUrl = img.master_url || img.preview_url;
          if (!imageUrl) {
            toast.error('Imagem sem URL disponível');
            return;
          }
          if (referenceImages.length >= maxReferenceImages) {
            toast.error(`Máximo ${maxReferenceImages} imagens de referência`);
            return;
          }
          try {
            setIsProcessingImages(true);
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.onerror = () => reject(new Error('Failed to convert'));
              reader.readAsDataURL(blob);
            });
            onReferenceImagesChange([...referenceImages, base64]);
            toast.success('Imagem adicionada como referência');
          } catch (error) {
            console.error('Error converting gallery image:', error);
            toast.error('Erro ao carregar imagem da galeria');
          } finally {
            setIsProcessingImages(false);
          }
        }}
      />
    </>
  );
}
