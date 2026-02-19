// ABRAhub Realism - Cinema Camera Presets
// Based on real cinema cameras and lenses with physically accurate optical behavior

export interface CinemaPreset {
  id: string;
  label: string;
  description: string;
  cameraBody: string;
  lensType: string;
  sensorFormat: string;
  previewImage: string;
  opticsBehaviorText: string;
  colorScienceText: string;
  sharpnessProfileText: string;
  realismGuardText: string;
}

export const CINEMA_PRESETS: CinemaPreset[] = [
  {
    id: 'arri-natural',
    label: 'ARRI Natural Narrative',
    description: 'Narrativa cinematográfica orgânica',
    cameraBody: 'ARRI Alexa Mini LF',
    lensType: 'Cooke S4',
    sensorFormat: 'Large Format',
    previewImage: 'presets/preset-arri.jpg',
    opticsBehaviorText: 'natural depth of field consistent with large-format cinema sensors, smooth focus falloff, gentle background separation, subtle optical softness without loss of detail',
    colorScienceText: 'ARRI Alexa color science, soft highlight roll-off, wide tonal latitude, neutral contrast, true-to-life skin tones, organic cinematic response',
    sharpnessProfileText: 'moderate sharpness, organic micro-texture, no digital edge enhancement, no oversharpening',
    realismGuardText: 'cinematic photorealism, real optics behavior, natural skin pores, subtle imperfections, no artificial look',
  },
  {
    id: 'red-commercial',
    label: 'RED Commercial Precision',
    description: 'Alta precisão para comerciais',
    cameraBody: 'RED V-Raptor',
    lensType: 'Zeiss Supreme Prime',
    sensorFormat: 'Large Format',
    previewImage: 'presets/preset-red.jpg',
    opticsBehaviorText: 'clean depth of field with precise subject separation, controlled background blur, modern optical clarity, minimal distortion',
    colorScienceText: 'modern digital cinema color, punchy yet realistic contrast, clean whites, controlled highlights, accurate color separation',
    sharpnessProfileText: 'high perceived resolution, strong micro-contrast, crisp detail without halos, no crunchy edges',
    realismGuardText: 'high-end commercial realism, no CGI appearance, no plastic textures',
  },
  {
    id: 'sony-venice-night',
    label: 'Sony Venice Night Clean',
    description: 'Otimizado para low-light',
    cameraBody: 'Sony Venice 2',
    lensType: 'Zeiss Supreme Prime',
    sensorFormat: 'Full Frame',
    previewImage: 'presets/preset-sony.jpg',
    opticsBehaviorText: 'balanced depth of field for low-light cinema, smooth bokeh, stable focus transitions, realistic night-time rendering',
    colorScienceText: 'Sony Venice color science, clean shadows, neutral blacks, rich midtones, smooth highlight roll-off, accurate skin tones under mixed light',
    sharpnessProfileText: 'clean sharpness, low noise appearance, refined cinematic clarity',
    realismGuardText: 'realistic night cinematography, no neon exaggeration, no artificial glow',
  },
  {
    id: 'anamorphic-film',
    label: 'Anamorphic Film Look',
    description: 'Widescreen com flares e bokeh oval',
    cameraBody: 'ARRI Alexa Mini LF',
    lensType: 'Hawk V-Lite Anamorphic',
    sensorFormat: 'Large Format',
    previewImage: 'presets/preset-anamorphic.jpg',
    opticsBehaviorText: 'anamorphic depth of field, oval bokeh, gentle edge softness, horizontal flare behavior, mild anamorphic distortion',
    colorScienceText: 'film-style tonal response, gentle contrast, natural highlight bloom, restrained color saturation',
    sharpnessProfileText: 'slightly softer perceived sharpness consistent with anamorphic optics, organic detail',
    realismGuardText: 'true anamorphic cinema realism, no exaggerated flares, no sci-fi glow',
  },
  {
    id: 'documentary-street',
    label: 'Documentary Street Realism',
    description: 'Documentário autêntico',
    cameraBody: 'Blackmagic Pocket Cinema Camera 6K Pro',
    lensType: 'Cooke S4',
    sensorFormat: 'Super 35',
    previewImage: 'presets/preset-documentary.jpg',
    opticsBehaviorText: 'deeper depth of field, wider environmental context, subtle natural imperfections, realistic handheld documentary feel (very subtle)',
    colorScienceText: 'natural documentary color response, gentle contrast, believable skin tones under practical light',
    sharpnessProfileText: 'moderate sharpness, organic texture, no studio polish',
    realismGuardText: 'raw documentary realism, no cinematic exaggeration, no beauty filter',
  },
];

// Focal length descriptions for physics accuracy
export const FOCAL_LENGTH_PHYSICS: Record<string, string> = {
  '14mm': 'extreme wide angle, strong environmental context, visible barrel distortion at edges',
  '24mm': 'wide angle perspective, expansive spatial depth, slight wide-angle distortion',
  '35mm': 'natural wide perspective, classic cinematography standard, minimal distortion',
  '50mm': 'human eye natural perspective, authentic spatial proportion, no noticeable distortion',
  '85mm': 'portrait compression, beautiful subject separation, flattened perspective begins',
  '135mm': 'telephoto compression, strong subject isolation, background strongly compressed',
};

// Aperture descriptions for DOF behavior
export const APERTURE_PHYSICS: Record<string, string> = {
  'f1.4': 'extremely shallow depth of field, razor-thin focus plane, creamy smooth bokeh, strong subject isolation',
  'f2.0': 'very shallow depth of field, pronounced bokeh, cinematic subject separation',
  'f2.8': 'cinema standard depth of field, natural background softness, professional focus falloff',
  'f4.0': 'moderate depth of field, balanced sharpness, commercial cinema standard',
  'f5.6': 'deeper depth of field, environmental context visible, documentary feel',
  'f8.0': 'deep depth of field, extended focus range, sharp background elements, landscape photography',
};

// Build the complete prompt block for a preset
export function buildPresetPromptBlock(preset: CinemaPreset, focalLength: string, aperture: string): string {
  const focalPhysics = FOCAL_LENGTH_PHYSICS[focalLength] || FOCAL_LENGTH_PHYSICS['50mm'];
  const aperturePhysics = APERTURE_PHYSICS[aperture] || APERTURE_PHYSICS['f2.8'];
  
  return `
=== CAMERA RIG ===
Camera: ${preset.cameraBody}
Lens: ${preset.lensType}
Sensor: ${preset.sensorFormat}
Focal Length: ${focalLength}
Aperture: ${aperture}

=== OPTICS BEHAVIOR ===
${preset.opticsBehaviorText}
${focalPhysics}
${aperturePhysics}

=== COLOR SCIENCE ===
${preset.colorScienceText}

=== SHARPNESS PROFILE ===
${preset.sharpnessProfileText}

=== REALISM GUARD ===
${preset.realismGuardText}
`.trim();
}

// Get preset by ID
export function getPresetById(id: string): CinemaPreset | undefined {
  return CINEMA_PRESETS.find(p => p.id === id);
}

// Default preset
export const DEFAULT_PRESET = 'arri-natural';
