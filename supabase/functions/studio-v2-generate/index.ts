import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================
// CINEMA PRESETS (same as process-generation-queue)
// ============================================
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

const FOCAL_LENGTH_PHYSICS: Record<string, string> = {
  '14mm': 'extreme wide angle, strong environmental context, visible barrel distortion at edges',
  '24mm': 'wide angle perspective, expansive spatial depth, slight wide-angle distortion',
  '35mm': 'natural wide perspective, classic cinematography standard, minimal distortion',
  '50mm': 'human eye natural perspective, authentic spatial proportion, no noticeable distortion',
  '85mm': 'portrait compression, beautiful subject separation, flattened perspective begins',
  '135mm': 'telephoto compression, strong subject isolation, background strongly compressed',
};

const APERTURE_PHYSICS: Record<string, string> = {
  'f1.4': 'extremely shallow depth of field, razor-thin focus plane, creamy smooth bokeh, strong subject isolation',
  'f2.0': 'very shallow depth of field, pronounced bokeh, cinematic subject separation',
  'f2.8': 'cinema standard depth of field, natural background softness, professional focus falloff',
  'f4.0': 'moderate depth of field, balanced sharpness, commercial cinema standard',
  'f5.6': 'deeper depth of field, environmental context visible, documentary feel',
  'f8.0': 'deep depth of field, extended focus range, sharp background elements, landscape photography',
};

const CAMERA_ANGLE_PHYSICS: Record<string, string> = {
  'eye-level': 'Standard eye-level camera angle, natural perspective at subject\'s eye height, neutral and immersive framing',
  'low-angle': 'Low angle shot looking upward at subject, emphasizes power and dominance, dramatic perspective distortion',
  'high-angle': 'High angle shot looking down at subject, creates vulnerability, diminishes subject presence',
  'dutch-angle': 'Tilted camera axis creating diagonal horizon line, suggests tension and psychological unease',
  'birds-eye': 'Extreme overhead shot looking straight down, god\'s-eye perspective, reveals spatial patterns',
  'worms-eye': 'Extreme low angle from ground level looking up, dramatic verticality, architectural emphasis',
  'over-shoulder': 'Camera positioned behind character\'s shoulder, establishes spatial relationship in dialogue',
  'pov': 'First-person perspective shot, camera represents character\'s exact viewpoint, subjective and immersive',
  'close-up': 'Tight framing on face or object, emphasizes emotion and detail, isolates subject from environment',
  'wide-shot': 'Wide angle showing full environment and subject in context, emphasizes location and scale',
};

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

const NEGATIVE_PROMPT = `AI generated look, CGI, plastic skin, doll face,
beauty filter, studio portrait, stock photo,
HDR, oversharpened, oversaturated,
perfect symmetry, artificial lighting`;

const MODEL_CONFIG = {
  modelId: 'gemini-3-pro-image-preview',
  label: 'ABRAhub Realism',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STUDIO-V2] ${step}${detailsStr}`);
};

function getPresetById(id: string): CinemaPreset {
  return CINEMA_PRESETS.find(p => p.id === id) || CINEMA_PRESETS[0];
}

function getQualityConfig(quality: string, aspectRatio: string) {
  const resolutions: Record<string, { '2K': [number, number]; '4K': [number, number] }> = {
    '21:9': { '2K': [2560, 1080], '4K': [4096, 1716] },
    '16:9': { '2K': [1920, 1080], '4K': [3840, 2160] },
    '4:3':  { '2K': [1440, 1080], '4K': [2880, 2160] },
    '1:1':  { '2K': [1080, 1080], '4K': [2160, 2160] },
    '9:16': { '2K': [1080, 1920], '4K': [2160, 3840] },
    '3:4':  { '2K': [1080, 1440], '4K': [2160, 2880] },
  };
  const res = resolutions[aspectRatio]?.[quality as '2K' | '4K'] || resolutions['16:9'][quality as '2K' | '4K'];
  const multiplier = quality === '4K' ? 1.5 : 1;
  return { width: res[0], height: res[1], creditMultiplier: multiplier };
}

function buildPrompt(
  userScene: string,
  preset: CinemaPreset,
  focalLength: string,
  aperture: string,
  cameraAngle: string,
  filmLookDescription?: string | null,
  isUltrawide: boolean = false,
  referencePromptInjection?: string | null,
): string {
  const focalPhysics = FOCAL_LENGTH_PHYSICS[focalLength] || FOCAL_LENGTH_PHYSICS['50mm'];
  const aperturePhysics = APERTURE_PHYSICS[aperture] || APERTURE_PHYSICS['f2.8'];
  const anglePhysics = CAMERA_ANGLE_PHYSICS[cameraAngle] || CAMERA_ANGLE_PHYSICS['eye-level'];

  const parts: string[] = [];
  parts.push(`Cinematic film still captured from a live-action movie.`);

  if (isUltrawide) {
    parts.push(`Compose the scene to fully occupy a wide cinematic frame, with strong horizontal depth and natural negative space.`);
  }

  if (referencePromptInjection) {
    parts.push(`=== REFERENCE IMAGE INSTRUCTIONS ===`);
    parts.push(referencePromptInjection);
    parts.push(`IMPORTANT: You MUST generate an IMAGE based on the instructions above. Do not respond with text only. Always output a photorealistic image.`);
  }

  parts.push(`Ultra-realistic human appearance with natural imperfections. No posing, candid expression.`);
  parts.push(userScene);

  // Camera rig block
  parts.push(`
=== CAMERA RIG ===
Camera: ${preset.cameraBody}
Lens: ${preset.lensType}
Sensor: ${preset.sensorFormat}
Focal Length: ${focalLength}
Aperture: ${aperture}

=== CAMERA ANGLE ===
${anglePhysics}

=== OPTICS BEHAVIOR ===
${preset.opticsBehaviorText}
${focalPhysics}
${aperturePhysics}

=== COLOR SCIENCE ===
${preset.colorScienceText}

=== SHARPNESS PROFILE ===
${preset.sharpnessProfileText}

=== REALISM GUARD ===
${preset.realismGuardText}`.trim());

  if (filmLookDescription) {
    parts.push(`=== COLOR GRADING & FILM LOOK ===`);
    parts.push(`IMPORTANT: Apply ONLY the color grading, lighting style, and lens characteristics below to the user's scene described above. DO NOT change the scene content, subjects, objects, or setting.`);
    parts.push(filmLookDescription);
  }

  parts.push(`Physically accurate lighting motivated by the environment. Film-inspired color grading. No AI look, no beauty filters, no HDR.`);

  return parts.join('\n\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claimsData.claims.sub;
    logStep("Authenticated", { userId });

    // Service role client for DB operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 2. Parse body
    const body = await req.json();
    const {
      prompt,
      aspectRatio = '16:9',
      quality = '2K',
      presetId = 'arri-natural',
      focalLength = '35mm',
      aperture = 'f2.8',
      cameraAngle = 'eye-level',
      filmLook = null,
      referenceImages = [],
      useOwnKey = false,
    } = body;

    if (!prompt || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Prompt é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (prompt.length > 2000) {
      return new Response(JSON.stringify({ error: 'Prompt excede 2000 caracteres' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Check blocked
    const { data: entData } = await supabaseAdmin
      .from('entitlements')
      .select('is_blocked, plan')
      .eq('user_id', userId)
      .maybeSingle();

    if (entData?.is_blocked) {
      return new Response(JSON.stringify({ error: 'Conta bloqueada' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Determine API key - EXCLUSIVE BYOK
    let apiKey: string;
    
    const { data: keyData } = await supabaseAdmin
      .from('user_api_keys')
      .select('gemini_api_key, is_valid')
      .eq('user_id', userId)
      .maybeSingle();

    if (!keyData?.gemini_api_key || !keyData.is_valid) {
      return new Response(JSON.stringify({ 
        error: 'API Key do Gemini não configurada ou inválida. Vá em Configurações.', 
        code: 'MISSING_API_KEY' 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    apiKey = keyData.gemini_api_key;
    logStep("Using BYOK key");

    // 5. Build prompt
    const preset = getPresetById(presetId);
    const isUltrawide = aspectRatio === '21:9';

    // Get film look description from DB if needed
    let filmLookDescription: string | null = null;
    if (filmLook) {
      const { data: filmLookData } = await supabaseAdmin
        .from('preset_configs')
        .select('preset_key, preset_prompt_blocks(color_science_text)')
        .eq('preset_type', 'film_look')
        .eq('preset_key', filmLook)
        .eq('is_active', true)
        .maybeSingle();

      if (filmLookData?.preset_prompt_blocks) {
        const block = filmLookData.preset_prompt_blocks as any;
        filmLookDescription = block?.color_science_text || null;
      }
    }

    const fullPrompt = `${SYSTEM_PROMPT}

${buildPrompt(prompt, preset, focalLength, aperture, cameraAngle, filmLookDescription, isUltrawide)}

DO NOT include: ${NEGATIVE_PROMPT}

Technical requirements: Generate image at ${qualityConfig.width}x${qualityConfig.height} resolution.`;

    logStep("Prompt built", { length: fullPrompt.length, preset: preset.label });

    // 6. Call Gemini API
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_CONFIG.modelId}:generateContent`;

    const contentParts: any[] = [];

    // Add reference images
    if (referenceImages && referenceImages.length > 0) {
      for (const imgBase64 of referenceImages) {
        const matches = imgBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          contentParts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
        } else if (!imgBase64.startsWith('data:')) {
          contentParts.push({ inlineData: { mimeType: 'image/png', data: imgBase64 } });
        }
      }
    }

    contentParts.push({ text: fullPrompt });

    const requestBody = {
      contents: [{ parts: contentParts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio,
          imageSize: quality,
        },
        temperature: 0.7,
      },
    };

    logStep("Calling Gemini API");
    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      logStep("Gemini API error", { status: geminiResponse.status, error: errorText.substring(0, 500) });

      if (geminiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'API sobrecarregada. Tente novamente em alguns segundos.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (geminiResponse.status === 403) {
        return new Response(JSON.stringify({ error: 'Chave de API inválida' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'Falha na geração de imagem' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const geminiData = await geminiResponse.json();

    // Check safety
    const finishReason = geminiData.candidates?.[0]?.finishReason;
    if (finishReason === "SAFETY" || finishReason === "IMAGE_SAFETY" || geminiData.promptFeedback?.blockReason) {
      return new Response(JSON.stringify({ error: 'Conteúdo bloqueado por política de segurança' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Extract image
    const parts = geminiData.candidates?.[0]?.content?.parts;
    if (!parts) {
      return new Response(JSON.stringify({ error: 'Resposta vazia do modelo' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let base64Image: string | null = null;
    let mimeType = 'image/png';
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        base64Image = part.inlineData.data;
        mimeType = part.inlineData.mimeType;
        break;
      }
    }

    if (!base64Image) {
      return new Response(JSON.stringify({ error: 'Nenhuma imagem gerada pelo modelo' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    logStep("Image received", { mimeType, sizeKB: Math.round(base64Image.length * 0.75 / 1024) });

    // 7. Deduct credits (skip for BYOK)
    if (!useOwnKey) {
      try {
        await supabaseAdmin.rpc('consume_credits_admin', { _user_id: userId, _amount: creditsCost });
        logStep("Credits deducted", { creditsCost });
      } catch (err) {
        logStep("Credit deduction failed", { error: String(err) });
        return new Response(JSON.stringify({ error: 'Falha ao deduzir créditos' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // 8. Save metadata only (no storage URLs)
    const { data: imageRecord, error: insertError } = await supabaseAdmin
      .from('user_generated_images')
      .insert({
        user_id: userId,
        prompt: prompt.substring(0, 2000),
        model: MODEL_CONFIG.modelId,
        model_label: `${MODEL_CONFIG.label} v2`,
        status: 'ready',
        aspect_ratio: aspectRatio,
        credits_cost: useOwnKey ? 0 : creditsCost,
      })
      .select('id')
      .single();

    if (insertError) {
      logStep("Metadata insert failed", { error: insertError });
    }

    logStep("Done", { imageId: imageRecord?.id });

    // 9. Return base64 to frontend
    return new Response(
      JSON.stringify({
        success: true,
        imageId: imageRecord?.id || null,
        base64: base64Image,
        mimeType,
        prompt,
        modelLabel: `${MODEL_CONFIG.label} v2`,
        creditsCost: useOwnKey ? 0 : creditsCost,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logStep("Unhandled error", { error: String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
