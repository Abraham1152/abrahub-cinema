import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ABRAhub Realism - Nano Banana Pro (Gemini 3 Pro Image)
const MODEL_CONFIG = {
  engine: 'gemini-api',
  modelId: 'gemini-3-pro-image-preview',
  baseCredits: 1,
  label: 'ABRAhub Realism',
};

interface GenerateImageRequest {
  prompt: string;
  aspectRatio?: string;
  quality?: '2K' | '4K';
  presetId?: string;
  focalLength?: string;
  aperture?: string;
  // Reference image support
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  referenceType?: 'person' | 'object' | 'scene';
  referenceMode?: 'STRICT' | 'SOFT';
}

// Input validation limits
const INPUT_LIMITS = {
  MAX_PROMPT_LENGTH: 2000,
  MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
};

// Validate base64 image and return approximate size in bytes
function validateBase64Image(base64: string, fieldName: string): number {
  // Strip data URI prefix if present
  const pureBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  
  // Basic format validation (more permissive to allow padding)
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(pureBase64)) {
    throw new Error(`Invalid base64 format for ${fieldName}`);
  }
  
  // Calculate approximate decoded size (base64 is ~4/3 the size of binary)
  const approximateBytes = Math.floor(pureBase64.length * 0.75);
  
  if (approximateBytes > INPUT_LIMITS.MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`${fieldName} exceeds maximum size of 10MB`);
  }
  
  return approximateBytes;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ABRAHUB-REALISM] ${step}${detailsStr}`);
};

// === CINEMA PRESETS (Backend Mirror) ===
interface CinemaPreset {
  id: string;
  label: string;
  cameraBody: string;
  lensType: string;
  sensorFormat: string;
  opticsBehaviorText: string;
  colorScienceText: string;
  sharpnessProfileText: string;
  realismGuardText: string;
}

const CINEMA_PRESETS: CinemaPreset[] = [
  {
    id: 'arri-natural',
    label: 'ARRI Natural Narrative',
    cameraBody: 'ARRI Alexa Mini LF',
    lensType: 'Cooke S4',
    sensorFormat: 'Large Format',
    opticsBehaviorText: 'natural depth of field consistent with large-format cinema sensors, smooth focus falloff, gentle background separation, subtle optical softness without loss of detail',
    colorScienceText: 'ARRI Alexa color science, soft highlight roll-off, wide tonal latitude, neutral contrast, true-to-life skin tones, organic cinematic response',
    sharpnessProfileText: 'moderate sharpness, organic micro-texture, no digital edge enhancement, no oversharpening',
    realismGuardText: 'cinematic photorealism, real optics behavior, natural skin pores, subtle imperfections, no artificial look',
  },
  {
    id: 'red-commercial',
    label: 'RED Commercial Precision',
    cameraBody: 'RED V-Raptor',
    lensType: 'Zeiss Supreme Prime',
    sensorFormat: 'Large Format',
    opticsBehaviorText: 'clean depth of field with precise subject separation, controlled background blur, modern optical clarity, minimal distortion',
    colorScienceText: 'modern digital cinema color, punchy yet realistic contrast, clean whites, controlled highlights, accurate color separation',
    sharpnessProfileText: 'high perceived resolution, strong micro-contrast, crisp detail without halos, no crunchy edges',
    realismGuardText: 'high-end commercial realism, no CGI appearance, no plastic textures',
  },
  {
    id: 'sony-venice-night',
    label: 'Sony Venice Night Clean',
    cameraBody: 'Sony Venice 2',
    lensType: 'Zeiss Supreme Prime',
    sensorFormat: 'Full Frame',
    opticsBehaviorText: 'balanced depth of field for low-light cinema, smooth bokeh, stable focus transitions, realistic night-time rendering',
    colorScienceText: 'Sony Venice color science, clean shadows, neutral blacks, rich midtones, smooth highlight roll-off, accurate skin tones under mixed light',
    sharpnessProfileText: 'clean sharpness, low noise appearance, refined cinematic clarity',
    realismGuardText: 'realistic night cinematography, no neon exaggeration, no artificial glow',
  },
  {
    id: 'anamorphic-film',
    label: 'Anamorphic Film Look',
    cameraBody: 'ARRI Alexa Mini LF',
    lensType: 'Hawk V-Lite Anamorphic',
    sensorFormat: 'Large Format',
    opticsBehaviorText: 'anamorphic depth of field, oval bokeh, gentle edge softness, horizontal flare behavior, mild anamorphic distortion',
    colorScienceText: 'film-style tonal response, gentle contrast, natural highlight bloom, restrained color saturation',
    sharpnessProfileText: 'slightly softer perceived sharpness consistent with anamorphic optics, organic detail',
    realismGuardText: 'true anamorphic cinema realism, no exaggerated flares, no sci-fi glow',
  },
  {
    id: 'documentary-street',
    label: 'Documentary Street Realism',
    cameraBody: 'Blackmagic Pocket Cinema Camera 6K Pro',
    lensType: 'Cooke S4',
    sensorFormat: 'Super 35',
    opticsBehaviorText: 'deeper depth of field, wider environmental context, subtle natural imperfections, realistic handheld documentary feel (very subtle)',
    colorScienceText: 'natural documentary color response, gentle contrast, believable skin tones under practical light',
    sharpnessProfileText: 'moderate sharpness, organic texture, no studio polish',
    realismGuardText: 'raw documentary realism, no cinematic exaggeration, no beauty filter',
  },
];

// Focal length physics
const FOCAL_LENGTH_PHYSICS: Record<string, string> = {
  '14mm': 'extreme wide angle, strong environmental context, visible barrel distortion at edges',
  '24mm': 'wide angle perspective, expansive spatial depth, slight wide-angle distortion',
  '35mm': 'natural wide perspective, classic cinematography standard, minimal distortion',
  '50mm': 'human eye natural perspective, authentic spatial proportion, no noticeable distortion',
  '85mm': 'portrait compression, beautiful subject separation, flattened perspective begins',
  '135mm': 'telephoto compression, strong subject isolation, background strongly compressed',
};

// Aperture physics
const APERTURE_PHYSICS: Record<string, string> = {
  'f1.4': 'extremely shallow depth of field, razor-thin focus plane, creamy smooth bokeh, strong subject isolation',
  'f2.0': 'very shallow depth of field, pronounced bokeh, cinematic subject separation',
  'f2.8': 'cinema standard depth of field, natural background softness, professional focus falloff',
  'f4.0': 'moderate depth of field, balanced sharpness, commercial cinema standard',
  'f5.6': 'deeper depth of field, environmental context visible, documentary feel',
  'f8.0': 'deep depth of field, extended focus range, sharp background elements, landscape photography',
};

// Get preset by ID
function getPresetById(id: string): CinemaPreset {
  return CINEMA_PRESETS.find(p => p.id === id) || CINEMA_PRESETS[0];
}

// === SYSTEM PROMPT (FIXED – NON-EDITABLE) ===
const SYSTEM_PROMPT = `You are a cinematic image generation system.

You must strictly follow all technical generation parameters provided by the application,
including canvas size, width, height, aspect ratio and resolution.

Aspect ratio and resolution are mandatory technical constraints, not aesthetic suggestions.
Do not reinterpret, crop, resize or auto-adjust the canvas.

Always generate images that fully occupy the provided canvas dimensions.
If the canvas is ultra-wide, compose the scene horizontally and cinematically.

Do not beautify faces or apply artificial smoothing.
Preserve natural human imperfections and photographic realism.

Never override technical parameters based on prompt interpretation.`;

// === NEGATIVE PROMPT (FIXED ON BACKEND) ===
const NEGATIVE_PROMPT = `AI generated look, CGI, plastic skin, doll face,
beauty filter, studio portrait, stock photo,
HDR, oversharpened, oversaturated,
perfect symmetry, artificial lighting`;

// === QUALITY PRESETS ===
interface QualityConfig {
  width: number;
  height: number;
  creditMultiplier: number;
}

function getQualityConfig(quality: '2K' | '4K', aspectRatio: string): QualityConfig {
  const is4K = quality === '4K';
  const multiplier = is4K ? 1.5 : 1;
  
  // Resolution based on aspect ratio and quality
  const resolutions: Record<string, { '2K': [number, number]; '4K': [number, number] }> = {
    '21:9': { '2K': [2560, 1080], '4K': [4096, 1716] },
    '16:9': { '2K': [1920, 1080], '4K': [3840, 2160] },
    '4:3': { '2K': [1440, 1080], '4K': [2880, 2160] },
    '1:1': { '2K': [1080, 1080], '4K': [2160, 2160] },
    '9:16': { '2K': [1080, 1920], '4K': [2160, 3840] },
    '3:4': { '2K': [1080, 1440], '4K': [2160, 2880] },
  };
  
  const res = resolutions[aspectRatio]?.[quality] || resolutions['16:9'][quality];
  
  return {
    width: res[0],
    height: res[1],
    creditMultiplier: multiplier,
  };
}

// === BUILD PRESET PROMPT BLOCK ===
function buildPresetPromptBlock(preset: CinemaPreset, focalLength: string, aperture: string): string {
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

// === REFERENCE MODE PROMPT INJECTIONS ===
const REFERENCE_PROMPTS = {
  STRICT: {
    person: `Use the provided image as a STRICT visual reference. This is a real person.
Preserve the exact identity: same face, facial features, skin tone, hair, and body proportions.
Do not redesign, stylize, or alter the person's appearance in any way.
Place this exact person into the described scene with appropriate lighting and perspective.
Maintain photorealistic quality and natural human imperfections.`,
    object: `Use the provided image as a STRICT visual reference. This is a real object/product.
Preserve the exact design, shape, colors, textures, and proportions of the object.
Do not redesign, reinterpret, or stylize the object.
Insert this exact object into the described scene with natural integration.
Adjust lighting, shadows, and perspective to match the environment.`,
    scene: `Use the provided image as a STRICT visual reference for the scene style and mood.
Match the composition, lighting style, color palette, and atmosphere exactly.
Apply the same visual treatment to the new scene content.`,
  },
  SOFT: {
    person: `Use the provided image as a loose inspiration for the person's general appearance.
Capture similar style and vibe, but creative interpretation is allowed.`,
    object: `Use the provided image as a loose inspiration for the object.
Capture similar concept, but creative interpretation is allowed.`,
    scene: `Use the provided image as loose inspiration for the scene mood and style.
Creative interpretation is encouraged.`,
  },
};

function getReferencePromptInjection(
  referenceMode: 'STRICT' | 'SOFT',
  referenceType: 'person' | 'object' | 'scene'
): string {
  return REFERENCE_PROMPTS[referenceMode][referenceType];
}

// === BUILD AESTHETIC PROMPT (LAYER 3) ===
function buildAestheticPrompt(
  userSceneDescription: string,
  preset: CinemaPreset,
  focalLength: string,
  aperture: string,
  isUltrawide: boolean
): string {
  const parts: string[] = [];
  
  parts.push(`Cinematic film still captured from a live-action movie.`);
  
  if (isUltrawide) {
    parts.push(`Compose the scene to fully occupy a wide cinematic frame,
with strong horizontal depth and natural negative space.`);
  }
  
  parts.push(`Ultra-realistic human appearance with natural imperfections.
No posing, candid expression.`);
  
  parts.push(userSceneDescription);
  
  // Add the preset technical block
  parts.push(buildPresetPromptBlock(preset, focalLength, aperture));
  
  parts.push(`Physically accurate lighting motivated by the environment.
Film-inspired color grading.
No AI look, no beauty filters, no HDR.`);
  
  return parts.join('\n\n');
}

// === GEMINI API (AI STUDIO) - NANO BANANA PRO ===
// Returns { base64: string, mimeType: string, rawBytes: Uint8Array }
interface GeminiImageResult {
  base64: string;
  mimeType: string;
  rawBytes: Uint8Array;
}

async function generateWithGeminiAPI(
  prompt: string, 
  aspectRatio: string, 
  quality: '2K' | '4K',
  apiKey: string,
  presetId: string,
  focalLength: string,
  aperture: string,
  referenceImageBase64?: string,
  referenceImageMimeType?: string,
  referenceType?: 'person' | 'object' | 'scene',
  referenceMode?: 'STRICT' | 'SOFT'
): Promise<GeminiImageResult> {
  const preset = getPresetById(presetId);
  const qualityConfig = getQualityConfig(quality, aspectRatio);
  const isUltrawide = aspectRatio === '21:9';
  
  const hasReference = !!referenceImageBase64;
  const actualReferenceType = referenceType || 'object';
  const actualReferenceMode = referenceMode || 'STRICT';
  
  logStep("Generating with Gemini 3 Pro Image (Nano Banana Pro)", { 
    aspectRatio, 
    quality,
    preset: preset.label,
    focalLength, 
    aperture,
    requestedResolution: `${qualityConfig.width}x${qualityConfig.height}`,
    imageConfigAspectRatio: aspectRatio,
    imageConfigImageSize: quality,
    hasReferenceImage: hasReference,
    referenceMimeType: hasReference ? (referenceImageMimeType || 'image/jpeg') : null,
    referenceType: hasReference ? actualReferenceType : null,
    referenceMode: hasReference ? actualReferenceMode : null,
    referenceBytesLength: hasReference ? referenceImageBase64.length : 0
  });

  // Build the aesthetic prompt with preset injection
  const aestheticPrompt = buildAestheticPrompt(
    prompt,
    preset,
    focalLength,
    aperture,
    isUltrawide
  );
  
  // Add reference instructions if reference image is provided
  let referenceInstructions = '';
  if (hasReference) {
    referenceInstructions = `\n\n=== REFERENCE IMAGE INSTRUCTIONS ===\n${getReferencePromptInjection(actualReferenceMode, actualReferenceType)}`;
  }
  
  logStep("Aesthetic Prompt Built", {
    presetLabel: preset.label,
    camera: preset.cameraBody,
    lens: preset.lensType,
    promptLength: aestheticPrompt.length,
    hasReferenceInstructions: hasReference
  });

  // Combine prompts for Gemini API (backup text, real control is imageConfig)
  const fullPrompt = `${SYSTEM_PROMPT}

${aestheticPrompt}${referenceInstructions}

DO NOT include: ${NEGATIVE_PROMPT}

Technical requirements: Generate image at ${qualityConfig.width}x${qualityConfig.height} resolution.`;

  // Gemini API endpoint
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_CONFIG.modelId}:generateContent`;

  // === BUILD CONTENT PARTS (text + optional reference image) ===
  const contentParts: any[] = [];
  
  // Add reference image FIRST if available (for context)
  if (hasReference && referenceImageBase64) {
    // Handle both data URI and raw base64 formats
    let mimeType = referenceImageMimeType || 'image/jpeg';
    let base64Data = referenceImageBase64;
    
    // Extract from data URI if present
    const matches = referenceImageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      base64Data = matches[2];
    }
    
    contentParts.push({
      inlineData: {
        mimeType,
        data: base64Data,
      }
    });
    
    logStep("Added reference image to payload", { 
      mimeType, 
      referenceType: actualReferenceType,
      referenceMode: actualReferenceMode,
      base64Length: base64Data.length
    });
  }
  
  // Add text prompt
  contentParts.push({ text: fullPrompt });
  
  // === CRITICAL: Use imageConfig for REAL resolution control ===
  const requestBody = {
    contents: [{ parts: contentParts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio,  // "21:9", "16:9", "9:16", etc
        imageSize: quality         // "2K" or "4K"
      },
      temperature: 0.7,
    }
  };

  logStep("Calling Gemini API with imageConfig", { 
    model: MODEL_CONFIG.modelId, 
    endpoint,
    imageConfig: requestBody.generationConfig.imageConfig,
    requestedWidth: qualityConfig.width,
    requestedHeight: qualityConfig.height
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logStep("Gemini API error", { status: response.status, error: errorText });
    
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 403) throw new Error("API_KEY_INVALID");
    throw new Error(`Gemini API failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  logStep("Gemini API response received", { 
    hasCandidates: !!data.candidates,
    candidatesCount: data.candidates?.length 
  });

  // Extract base64 image from response
  const candidates = data.candidates;
  if (!candidates || candidates.length === 0) {
    logStep("No candidates in response", data);
    throw new Error("No image candidates in Gemini response");
  }

  const parts = candidates[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    logStep("No parts in candidate", candidates[0]);
    throw new Error("No parts in Gemini response");
  }

  // Find the image part (inlineData with mimeType starting with "image/")
  let base64Image: string | null = null;
  let mimeType = 'image/png';
  
  for (const part of parts) {
    if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
      base64Image = part.inlineData.data;
      mimeType = part.inlineData.mimeType;
      break;
    }
  }

  if (!base64Image) {
    logStep("No image data in parts", parts);
    throw new Error("No image data in Gemini response");
  }

  // Convert base64 to raw bytes - PRESERVE ORIGINAL, NO RE-ENCODE
  const rawBytes = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));
  
  // Parse image dimensions from header
  const dimensions = parseImageDimensions(rawBytes, mimeType);
  
  logStep("GEMINI_RAW_OUTPUT", { 
    mimeType, 
    preset: preset.label,
    GEMINI_RAW_BYTES_LEN: rawBytes.length,
    rawSizeKB: Math.round(rawBytes.length / 1024),
    rawSizeMB: (rawBytes.length / (1024 * 1024)).toFixed(2),
    parsedWidth: dimensions.width,
    parsedHeight: dimensions.height,
    requestedResolution: `${qualityConfig.width}x${qualityConfig.height}`,
    actualResolution: `${dimensions.width}x${dimensions.height}`
  });
  
  return {
    base64: base64Image,
    mimeType,
    rawBytes
  };
}

// Parse image dimensions from PNG/JPEG header
function parseImageDimensions(bytes: Uint8Array, mimeType: string): { width: number; height: number } {
  try {
    if (mimeType === 'image/png') {
      // PNG: width at bytes 16-19, height at bytes 20-23 (big-endian)
      if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
        const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
        const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
        return { width, height };
      }
    } else if (mimeType === 'image/jpeg') {
      // JPEG: Search for SOF0/SOF2 marker
      let i = 2;
      while (i < bytes.length - 9) {
        if (bytes[i] === 0xFF) {
          const marker = bytes[i + 1];
          // SOF0, SOF1, SOF2 markers
          if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
            const height = (bytes[i + 5] << 8) | bytes[i + 6];
            const width = (bytes[i + 7] << 8) | bytes[i + 8];
            return { width, height };
          }
          // Skip to next marker
          const length = (bytes[i + 2] << 8) | bytes[i + 3];
          i += 2 + length;
        } else {
          i++;
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse image dimensions:", e);
  }
  return { width: 0, height: 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");
    
    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // Parse request
    const body: GenerateImageRequest = await req.json();
    const { 
      prompt, 
      aspectRatio = "16:9",
      quality = "2K",
      presetId = "arri-natural",
      focalLength = "35mm",
      aperture = "f2.8",
      // Reference image fields
      referenceImageBase64,
      referenceImageMimeType,
      referenceType,
      referenceMode = "STRICT"
    } = body;

    // === INPUT VALIDATION ===
    
    // Validate prompt is present
    if (!prompt) {
      return new Response(JSON.stringify({ 
        error: "Missing required field: prompt",
        code: "INVALID_REQUEST" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    // Validate prompt length
    if (prompt.length > INPUT_LIMITS.MAX_PROMPT_LENGTH) {
      return new Response(JSON.stringify({ 
        error: `Prompt exceeds maximum length of ${INPUT_LIMITS.MAX_PROMPT_LENGTH} characters`,
        code: "PROMPT_TOO_LONG" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    // Validate reference image if provided
    if (referenceImageBase64) {
      try {
        const imageSize = validateBase64Image(referenceImageBase64, "referenceImage");
        logStep("Reference image validated", { sizeBytes: imageSize });
      } catch (validationError) {
        return new Response(JSON.stringify({ 
          error: validationError instanceof Error ? validationError.message : "Invalid reference image",
          code: "INVALID_REFERENCE_IMAGE" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }

    // Calculate credits based on quality
    const qualityConfig = getQualityConfig(quality, aspectRatio);
    const creditsCost = Math.ceil(MODEL_CONFIG.baseCredits * qualityConfig.creditMultiplier);
    
    const hasReference = !!referenceImageBase64;
    
    logStep("Processing request", { 
      credits: creditsCost, 
      aspectRatio, 
      quality,
      presetId,
      focalLength,
      aperture,
      hasReferenceImage: hasReference,
      referenceType: hasReference ? referenceType : null,
      referenceMode: hasReference ? referenceMode : null
    });

    // Check credits
    const { data: creditData, error: creditCheckError } = await supabaseAdmin
      .from('user_credits')
      .select('available')
      .eq('user_id', userId)
      .single();

    const hasCredits = creditData && creditData.available >= creditsCost;
    logStep("Credit check result", { hasCredits, available: creditData?.available, required: creditsCost });

    if (creditCheckError || !hasCredits) {
      return new Response(JSON.stringify({ 
        error: "Créditos insuficientes",
        code: "INSUFFICIENT_CREDITS",
        required: creditsCost,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 402,
      });
    }

    // Check Gemini API key
    if (!geminiApiKey) {
      throw new Error("GOOGLE_GEMINI_API_KEY not configured");
    }

    // Get preset info for label
    const preset = getPresetById(presetId);
    
    // Build model label (include reference type if present)
    const modelLabel = hasReference && referenceType
      ? `${MODEL_CONFIG.label} • ${preset.label} • ${referenceType === 'person' ? '👤 Pessoa' : referenceType === 'scene' ? '🎬 Cena' : '📦 Objeto'}`
      : `${MODEL_CONFIG.label} • ${preset.label}`;

    // Create record
    const { data: newRecord, error: insertError } = await supabaseAdmin
      .from('user_generated_images')
      .insert({
        user_id: userId,
        prompt,
        model: 'gemini-3-pro-image',
        model_label: modelLabel,
        status: 'generating',
        credits_cost: creditsCost,
        aspect_ratio: aspectRatio,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;
    const imageRecordId = newRecord.id;

    logStep("Record created", { imageRecordId, preset: preset.label, hasReference });

    let imageResult: GeminiImageResult;

    try {
      imageResult = await generateWithGeminiAPI(
        prompt, 
        aspectRatio,
        quality,
        geminiApiKey,
        presetId,
        focalLength,
        aperture,
        referenceImageBase64,
        referenceImageMimeType,
        referenceType,
        referenceMode
      );
    } catch (genError) {
      const errorMessage = genError instanceof Error ? genError.message : String(genError);
      
      await supabaseAdmin
        .from('user_generated_images')
        .update({ status: 'error', error_message: errorMessage })
        .eq('id', imageRecordId);

      if (errorMessage === "RATE_LIMIT") {
        return new Response(JSON.stringify({ 
          error: "Limite de requisições atingido. Aguarde alguns minutos.",
          code: "RATE_LIMIT",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        });
      }

      if (errorMessage === "API_KEY_INVALID") {
        return new Response(JSON.stringify({ 
          error: "API Key inválida. Verifique a configuração.",
          code: "API_KEY_INVALID",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }

      throw genError;
    }

    // Upload ORIGINAL bytes to storage - NO RE-ENCODE
    // imageResult is now { base64, mimeType, rawBytes }
    const { mimeType, rawBytes } = imageResult;
    
    // Dynamic file extension based on actual mimeType
    const fileExt = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const fileName = `${userId}/realism/${imageRecordId}-${Date.now()}.${fileExt}`;
    
    // Parse dimensions for database
    const dimensions = parseImageDimensions(rawBytes, mimeType);
    
    logStep("Uploading ORIGINAL Gemini bytes (no re-encode)", {
      mimeType,
      fileExt,
      fileName,
      bytesLength: rawBytes.length,
      sizeKB: Math.round(rawBytes.length / 1024),
      sizeMB: (rawBytes.length / (1024 * 1024)).toFixed(2),
      dimensions
    });
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from("storyboard-images")
      .upload(fileName, rawBytes, {
        contentType: mimeType, // Use REAL mimeType from Gemini
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Generate public URL (bucket is now public, no signed tokens needed)
    const { data: publicUrlData } = supabaseAdmin.storage
      .from("storyboard-images")
      .getPublicUrl(fileName);

    const finalUrl = publicUrlData.publicUrl;

    // Update record with URL and dimensions
    await supabaseAdmin
      .from('user_generated_images')
      .update({ 
        status: 'ready', 
        url: finalUrl,
        master_url: finalUrl,
        preview_url: finalUrl,
        base_url: finalUrl,
        master_width: dimensions.width,
        master_height: dimensions.height,
        master_bytes: rawBytes.length,
        preview_width: dimensions.width,
        preview_height: dimensions.height,
        preview_bytes: rawBytes.length,
        base_width: dimensions.width,
        base_height: dimensions.height,
        base_bytes: rawBytes.length,
      })
      .eq('id', imageRecordId);

    // Deduct credits
    await supabaseAdmin.rpc('deduct_credits', {
      _user_id: userId,
      _amount: creditsCost,
      _action: 'realism_image',
      _description: `ABRAhub Realism • ${preset.label}`,
      _reference_id: imageRecordId,
      _reference_type: 'user_generated_image',
    });

    logStep("Image generated successfully", { imageRecordId, url: finalUrl, preset: preset.label });

    return new Response(JSON.stringify({
      success: true,
      imageId: imageRecordId,
      url: finalUrl,
      creditsUsed: creditsCost,
      preset: preset.label,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Error", { error: errorMessage });

    return new Response(JSON.stringify({
      error: errorMessage,
      code: "GENERATION_ERROR",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
