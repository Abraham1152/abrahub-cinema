// Cinema equipment configurations for ABRAhub Realism

export interface CameraOption {
  id: string;
  label: string;
  description: string;
  promptInjection: string;
  icon?: string;
}

export interface LensOption {
  id: string;
  label: string;
  description: string;
  promptInjection: string;
}

export interface FocalLengthOption {
  id: string;
  label: string;
  value: number;
  description: string;
  previewImage: string;
}

export interface ApertureOption {
  id: string;
  label: string;
  value: string;
  description: string;
  previewImage: string;
}

// Camera bodies
export const CAMERA_OPTIONS: CameraOption[] = [
  {
    id: 'imax',
    label: 'IMAX Film Camera',
    description: 'Grão pesado, épico',
    promptInjection: 'Shot on IMAX 70mm film camera, heavy film grain, epic cinematic scale, IMAX format, theatrical presentation',
  },
  {
    id: 'arri-alexa',
    label: 'ARRI Alexa 65',
    description: 'Digital limpo, cores ricas',
    promptInjection: 'Shot on ARRI Alexa 65, clean digital image, rich natural colors, wide dynamic range, Hollywood production quality',
  },
  {
    id: 'red-raptor',
    label: 'Red V-Raptor',
    description: 'Moderno, nítido',
    promptInjection: 'Shot on RED V-Raptor 8K VV, extremely sharp modern digital, high resolution, pristine image quality',
  },
  {
    id: 'leica-m',
    label: 'Leica M-System',
    description: 'Fotografia de rua clássica',
    promptInjection: 'Shot on Leica M11 rangefinder, classic street photography look, subtle tones, documentary style',
  },
];

// Lens options
export const LENS_OPTIONS: LensOption[] = [
  {
    id: 'cooke-anamorphic',
    label: 'Cooke Anamorphic',
    description: 'Lens flare horizontal, bokeh oval',
    promptInjection: 'Cooke Anamorphic lens, horizontal lens flares, oval bokeh, distinctive anamorphic distortion, cinematic widescreen look',
  },
  {
    id: 'leica-summilux',
    label: 'Leica Summilux',
    description: 'Desfoque cremoso',
    promptInjection: 'Leica Summilux lens, creamy smooth bokeh, beautiful out-of-focus rendering, classic Leica glow',
  },
  {
    id: 'canon-k35',
    label: 'Vintage Canon K-35',
    description: 'Look retrô',
    promptInjection: 'Vintage Canon K-35 lens, retro film look, warm organic colors, subtle flaring, classic 70s cinema aesthetic',
  },
  {
    id: 'zeiss-master',
    label: 'Zeiss Master Prime',
    description: 'Ultra nítido, moderno',
    promptInjection: 'Zeiss Master Prime lens, ultra sharp, clinical precision, modern optical excellence, minimal distortion',
  },
];

// Focal length options
export const FOCAL_LENGTH_OPTIONS: FocalLengthOption[] = [
  {
    id: '14mm',
    label: '14mm',
    value: 14,
    description: 'Ultra-wide • Perspectiva dramática',
    previewImage: '/presets/focal-14mm.jpg',
  },
  {
    id: '24mm',
    label: '24mm',
    value: 24,
    description: 'Wide • Contexto ambiental',
    previewImage: '/presets/focal-24mm.jpg',
  },
  {
    id: '35mm',
    label: '35mm',
    value: 35,
    description: 'Standard • Visão natural',
    previewImage: '/presets/focal-35mm.jpg',
  },
  {
    id: '50mm',
    label: '50mm',
    value: 50,
    description: 'Normal • Como o olho humano',
    previewImage: '/presets/focal-50mm.jpg',
  },
  {
    id: '85mm',
    label: '85mm',
    value: 85,
    description: 'Portrait • Compressão facial',
    previewImage: '/presets/focal-85mm.jpg',
  },
  {
    id: '135mm',
    label: '135mm',
    value: 135,
    description: 'Tele • Isolamento máximo',
    previewImage: '/presets/focal-135mm.jpg',
  },
];

// Aperture options
export const APERTURE_OPTIONS: ApertureOption[] = [
  {
    id: 'f1.4',
    label: 'f/1.4',
    value: 'f1.4',
    description: 'DoF mínima • Bokeh extremo',
    previewImage: '/presets/aperture-f14.jpg',
  },
  {
    id: 'f2.0',
    label: 'f/2.0',
    value: 'f2.0',
    description: 'DoF rasa • Low light',
    previewImage: '/presets/aperture-f20.jpg',
  },
  {
    id: 'f2.8',
    label: 'f/2.8',
    value: 'f2.8',
    description: 'Profissional • Balanceado',
    previewImage: '/presets/aperture-f28.jpg',
  },
  {
    id: 'f4.0',
    label: 'f/4.0',
    value: 'f4.0',
    description: 'Contexto • Mais nitidez',
    previewImage: '/presets/aperture-f40.jpg',
  },
  {
    id: 'f5.6',
    label: 'f/5.6',
    value: 'f5.6',
    description: 'DoF profunda • Grupos',
    previewImage: '/presets/aperture-f56.jpg',
  },
  {
    id: 'f8.0',
    label: 'f/8.0',
    value: 'f8.0',
    description: 'Tudo nítido • Arquitetura',
    previewImage: '/presets/aperture-f80.jpg',
  },
];

// Aspect ratio options for cinema - ordered by cinematic priority
export const ASPECT_RATIO_OPTIONS = [
  { id: '21:9', label: '21:9', description: 'Cinema Ultrawide' },
  { id: '16:9', label: '16:9', description: 'Widescreen Padrão' },
  { id: '4:3', label: '4:3', description: 'Clássico' },
  { id: '1:1', label: '1:1', description: 'Quadrado' },
  { id: '9:16', label: '9:16', description: 'Vertical' },
] as const;

// Default equipment selection
export const DEFAULT_EQUIPMENT = {
  camera: 'arri-alexa',
  lens: 'cooke-anamorphic',
  focalLength: '35mm',
  aperture: 'f2.8',
  aspectRatio: '16:9',
  preset: 'arri-natural',
};

// Generate equipment prompt injection
export function generateEquipmentPrompt(
  cameraId: string,
  lensId: string,
  focalLength: string,
  aperture: string
): string {
  const camera = CAMERA_OPTIONS.find(c => c.id === cameraId);
  const lens = LENS_OPTIONS.find(l => l.id === lensId);
  const focal = FOCAL_LENGTH_OPTIONS.find(f => f.id === focalLength);
  const apt = APERTURE_OPTIONS.find(a => a.id === aperture);

  const parts: string[] = [];
  
  if (camera) parts.push(camera.promptInjection);
  if (lens) parts.push(lens.promptInjection);
  if (focal) parts.push(`focal length ${focal.value}mm`);
  if (apt) parts.push(`aperture f/${apt.value}, ${apt.description}`);

  return parts.join('. ');
}

// Hardcoded realism suffix - always added
export const REALISM_SUFFIX = ', highly detailed raw photograph, 8k uhd, photorealistic, dslr quality, master shot, professional cinema lighting, natural shadows, cinematic color grading';

// Negative prompt - always sent
export const NEGATIVE_PROMPT = 'cartoon, anime, drawing, painting, 3d render, sketch, illustration, low quality, blurry, distorted, watermark, text, signature, ugly, deformed, artificial, CGI, computer generated';
