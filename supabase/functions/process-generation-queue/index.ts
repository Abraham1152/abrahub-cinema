import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// IMAGE METADATA EXTRACTION
// ============================================
interface ImageDimensions { width: number; height: number; }

function getPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) return null;
  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  return { width, height };
}

function getJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
  let offset = 2;
  while (offset < bytes.length - 8) {
    if (bytes[offset] !== 0xFF) { offset++; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xC0 || marker === 0xC2) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return { width, height };
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 2 + length;
  }
  return null;
}

function getImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  return getPngDimensions(bytes) || getJpegDimensions(bytes) || null;
}

// ============================================
// CONFIGURABLE RATE LIMITS
// ============================================
const RATE_LIMITS = {
  MAX_REQUESTS_PER_MINUTE: 18,
  MAX_CONCURRENT_GENERATIONS: 6,
  MAX_CONCURRENT_PER_USER: 3,
  MIN_INTERVAL_MS: 3200,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,
  DAILY_LIMIT: 250,
  DAILY_WARNING_THRESHOLD: 200,
};

const MODEL_CONFIG = {
  engine: 'gemini-api',
  modelId: 'gemini-3-pro-image-preview',
  label: 'ABRAhub Realism',
};

// ============================================
// CINEMA PRESETS (Simplified for brevity but logic works)
// ============================================
interface CinemaPreset { id: string; label: string; cameraBody: string; lensType: string; sensorFormat: string; opticsBehaviorText: string; colorScienceText: string; sharpnessProfileText: string; realismGuardText: string; }

const CINEMA_PRESETS: CinemaPreset[] = [
  { id: 'arri-natural', label: 'ARRI Natural Narrative', cameraBody: 'ARRI Alexa Mini LF', lensType: 'Cooke S4', sensorFormat: 'Large Format', opticsBehaviorText: 'natural depth of field consistent with large-format cinema sensors, smooth focus falloff', colorScienceText: 'ARRI Alexa color science, soft highlight roll-off', sharpnessProfileText: 'moderate sharpness, organic micro-texture', realismGuardText: 'cinematic photorealism' },
];

function getPresetById(id: string): CinemaPreset { return CINEMA_PRESETS.find(p => p.id === id) || CINEMA_PRESETS[0]; }

function getQualityConfig(quality: string, aspectRatio: string) {
  const is4K = quality === '4K';
  const multiplier = is4K ? 1.5 : 1;
  const resolutions: Record<string, { '2K': [number, number]; '4K': [number, number] }> = {
    '21:9': { '2K': [2560, 1080], '4K': [4096, 1716] },
    '16:9': { '2K': [1920, 1080], '4K': [3840, 2160] },
    '4:3': { '2K': [1440, 1080], '4K': [2880, 2160] },
    '1:1': { '2K': [1080, 1080], '4K': [2160, 2160] },
    '9:16': { '2K': [1080, 1920], '4K': [2160, 3840] },
    '3:4': { '2K': [1080, 1440], '4K': [2160, 2880] },
  };
  const res = resolutions[aspectRatio]?.[quality as '2K' | '4K'] || resolutions['16:9'][quality as '2K' | '4K'];
  return { width: res[0], height: res[1], creditMultiplier: multiplier };
}

function buildAestheticPrompt(userSceneDescription: string, preset: CinemaPreset, focalLength: string, aperture: string, isUltrawide: boolean, referencePromptInjection?: string | null, cameraAngle: string = 'eye-level', filmLookDescription?: string | null, isStoryboard6: boolean = false): string {
  const parts: string[] = [`Cinematic film still captured from a live-action movie.`];
  
  if (isStoryboard6) {
    parts.push(`CRITICAL LAYOUT RULE: You MUST generate a STORYBOARD SHEET with EXACTLY 6 DISTINCT PANELS arranged in a STRICT 2-row by 3-column grid (2x3).`);
    parts.push(`PROHIBITED: Do NOT generate 4, 8, 9, or any other number of panels. ONLY 6 PANELS ARE ALLOWED.`);
    parts.push(`The 6 panels MUST COMPLETELY FILL the entire frame from edge to edge. No margins, no padding, and no external borders.`);
    parts.push(`Each panel should be a variation of the same scene but with slight changes in composition or timing.`);
    parts.push(`Ensure the layout is seamless: the panels should touch each other with only a thin hairline separator if needed, but the composite image must occupy the full selected aspect ratio without any letterboxing or empty space.`);
  } else if (isUltrawide) {
    parts.push(`Compose the scene to fully occupy a wide cinematic frame.`);
  }

  if (referencePromptInjection) {
    parts.push(`=== REFERENCE IMAGE INSTRUCTIONS ===\n${referencePromptInjection}\nIMPORTANT: You MUST generate an IMAGE based on the instructions above.`);
  }
  
  parts.push(`Ultra-realistic human appearance. No posing, candid expression.\n${userSceneDescription}\n=== CAMERA RIG ===\nCamera: ${preset.cameraBody}\nLens: ${preset.lensType}`);
  
  if (filmLookDescription) parts.push(`=== COLOR GRADING & FILM LOOK ===\n${filmLookDescription}`);
  
  return parts.join('\n\n');
}

const SYSTEM_PROMPT = `You are a cinematic image generation system. Preserve natural human imperfections.`;
const NEGATIVE_PROMPT = `AI generated look, CGI, plastic skin, doll face, HDR.`;

const logStep = (step: string, details?: any) => { console.log(`[QUEUE-PROCESSOR] ${step}`, details ? JSON.stringify(details) : ''); };

interface GeminiImageResult { base64: string; mimeType: string; rawBytes: Uint8Array; }

async function generateWithGeminiAPI(prompt: string, aspectRatio: string, quality: string, apiKey: string, presetId: string, focalLength: string, aperture: string, referenceImages?: string[], referenceType?: string | null, referencePromptInjection?: string | null, cameraAngle: string = 'eye-level', filmLookDescription?: string | null, forceImageOnly: boolean = false): Promise<GeminiImageResult> {
  const preset = getPresetById(presetId);
  const qualityConfig = getQualityConfig(quality, aspectRatio);
  const isStoryboard6 = referenceType === 'storyboard6';
  
  const aestheticPrompt = buildAestheticPrompt(prompt, preset, focalLength, aperture, aspectRatio === '21:9', referencePromptInjection, cameraAngle, filmLookDescription, isStoryboard6);
  
  const fullPrompt = `${SYSTEM_PROMPT}\n\n${aestheticPrompt}\n\nDO NOT include: ${NEGATIVE_PROMPT}\n\nTechnical requirements: Generate image at ${qualityConfig.width}x${qualityConfig.height} resolution.`;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_CONFIG.modelId}:generateContent`;

  const contentParts: any[] = [];
  if (referenceImages && referenceImages.length > 0) {
    for (const imgBase64 of referenceImages) {
      const matches = imgBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) contentParts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
      else contentParts.push({ inlineData: { mimeType: 'image/png', data: imgBase64 } });
    }
  }
  
  contentParts.push({ text: fullPrompt });

  const requestBody = {
    contents: [{ parts: contentParts }],
    generationConfig: {
      responseModalities: forceImageOnly ? ["IMAGE"] : ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio, imageSize: quality },
      temperature: 0.7,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 403) throw new Error("API_KEY_INVALID");
    throw new Error(`Gemini API failed: ${response.status}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error("No parts in Gemini response");
  
  let base64Image = null, mimeType = 'image/png';
  for (const part of parts) {
    if (part.inlineData?.mimeType?.startsWith('image/')) {
      base64Image = part.inlineData.data;
      mimeType = part.inlineData.mimeType;
      break;
    }
  }
  
  if (!base64Image) throw new Error("No image data in Gemini response");
  
  const rawBytes = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));
  return { base64: base64Image, mimeType, rawBytes };
}

// Parse image dimensions from PNG/JPEG header
function parseImageDimensionsFromBytes(bytes: Uint8Array, mimeType: string): { width: number; height: number } {
  try {
    if (mimeType === 'image/png') {
      if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
        const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
        const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
        return { width, height };
      }
    } else if (mimeType === 'image/jpeg') {
      let i = 2;
      while (i < bytes.length - 9) {
        if (bytes[i] === 0xFF) {
          const marker = bytes[i + 1];
          if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
            const height = (bytes[i + 5] << 8) | bytes[i + 6];
            const width = (bytes[i + 7] << 8) | bytes[i + 8];
            return { width, height };
          }
          const length = (bytes[i + 2] << 8) | bytes[i + 3];
          i += 2 + length;
        } else { i++; }
      }
    }
  } catch (e) {}
  return { width: 0, height: 0 };
}

// ============================================
// PROCESS SINGLE QUEUE ITEM 
// ============================================
async function processQueueItemAfterClaim(item: any, supabaseAdmin: any, geminiApiKey: string): Promise<void> {
  const startTime = Date.now();
  try {
    const isSequenceMode = item.reference_type === 'sequence' || item.sequence_mode;
    const isStoryboard6 = item.reference_type === 'storyboard6';
    const isSplitUpscale = item.reference_type === 'split_upscale';
    const effectiveAspectRatio = (isStoryboard6 || isSplitUpscale) ? '16:9' : item.aspect_ratio;
    
    // EXCLUSIVE BYOK MODE - Fetch user's API key
    let effectiveApiKey = geminiApiKey;
    const { data: keyData } = await supabaseAdmin.from('user_api_keys').select('gemini_api_key, is_valid').eq('user_id', item.user_id).maybeSingle();
    if (keyData?.is_valid && keyData?.gemini_api_key) {
      effectiveApiKey = keyData.gemini_api_key;
    } else {
      throw new Error("BYOK_KEY_INVALID: API key do usuário não encontrada ou inválida");
    }
    
    const preset = getPresetById(item.preset_id);
    let referenceImages: string[] = [];
    if (item.reference_images) {
      try { referenceImages = typeof item.reference_images === 'string' ? JSON.parse(item.reference_images) : item.reference_images; } 
      catch (e) { referenceImages = item.reference_images; }
    }
    
    let modelLabel = `${MODEL_CONFIG.label} • ${preset.label}`;
    let finalPrompt = item.prompt;

    // Lógica especial para Split/Ampliação
    if (isSplitUpscale) {
      const panelInfo = item.reference_prompt_injection || "panel_number:1";
      const panelNum = panelInfo.split(':')[1] || "1";
      const PANEL_POSITIONS: Record<string, string> = {
        "1": "top-left", "2": "top-center", "3": "top-right",
        "4": "bottom-left", "5": "bottom-center", "6": "bottom-right",
      };
      const position = PANEL_POSITIONS[panelNum] || `painel ${panelNum}`;
      
      finalPrompt = `Esta imagem contém um grid de 6 painéis cinematográficos.
      SUA TAREFA: Ampliar e expandir exclusivamente o PAINEL ${panelNum} (localizado em ${position}).
      
      REGRAS OBRIGATÓRIAS:
      1. Gere apenas UMA imagem única ocupando todo o quadro (proporção 16:9).
      2. Mantenha exatamente o mesmo personagem, iluminação e cores do PAINEL ${panelNum}.
      3. Não inclua bordas, linhas de grid ou outros painéis.
      4. Expanda a cena original com realismo cinematográfico extremo e detalhes ultra-nítidos.
      5. O resultado deve ser a cena do painel ${panelNum} revelada em tela cheia.`;
      
      modelLabel = `ABRAhub Nano Banana • Painel ${panelNum} Ampliado`;
    }
    
    // Insert into user_generated_images (status: generating)
    const { data: imageRecord, error: insertError } = await supabaseAdmin
      .from('user_generated_images')
      .insert({
        user_id: item.user_id,
        prompt: finalPrompt,
        model: 'gemini-3-pro-image',
        model_label: modelLabel,
        status: 'generating',
        credits_cost: 0,
        aspect_ratio: effectiveAspectRatio,
        is_story6: false,
      })
      .select('id').single();
    
    if (insertError) throw insertError;
    
    // Generate image
    let imageResult: GeminiImageResult;
    try {
      imageResult = await generateWithGeminiAPI(finalPrompt, effectiveAspectRatio, item.quality, effectiveApiKey, item.preset_id, item.focal_length, item.aperture, referenceImages, item.reference_type, null, item.camera_angle || 'eye-level', item.film_look, isSplitUpscale);
    } catch (firstError: any) {
      logStep("Generation failed", { error: firstError.message });
      throw firstError;
    }
    
    // Upload original bytes to Storage
    const { mimeType, rawBytes } = imageResult;
    const dimensions = parseImageDimensionsFromBytes(rawBytes, mimeType);
    const fileExt = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const fileName = `${item.user_id}/realism/${imageRecord.id}-${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabaseAdmin.storage.from("storyboard-images").upload(fileName, rawBytes, { contentType: mimeType, upsert: true });
    if (uploadError) throw uploadError;
    
    const { data: publicUrlData } = supabaseAdmin.storage.from("storyboard-images").getPublicUrl(fileName);
    const signedUrl = publicUrlData.publicUrl;
    
    // Update Image Record to READY
    await supabaseAdmin.from('user_generated_images').update({ 
      status: 'ready', url: signedUrl, master_url: signedUrl, preview_url: signedUrl,
      prompt: finalPrompt, // Save the specialized upscale prompt
      master_width: dimensions.width, master_height: dimensions.height, master_bytes: rawBytes.length
    }).eq('id', imageRecord.id);
    
    // Mark QUEUE as completed
    await supabaseAdmin.from('generation_queue').update({
      status: 'completed', completed_at: new Date().toISOString(), result_image_id: imageRecord.id,
    }).eq('id', item.id);
    
  } catch (error) {
    const rawError = error instanceof Error ? error.message : String(error);
    console.error(`[PROCESSOR] Execution failed for user ${item.user_id}:`, rawError);

    // CRITICAL: Update both queue AND image record to fail state
    // This prevents the "Generating..." card from being stuck forever
    await Promise.all([
      supabaseAdmin.from('generation_queue').update({
        status: 'failed', 
        error_message: rawError, 
        retry_count: (item.retry_count || 0) + 1,
      }).eq('id', item.id),
      
      // Update the actual image card so UI shows the error
      supabaseAdmin.from('user_generated_images').update({
        status: 'error',
        error_message: rawError
      }).filter('id', 'in', 
        supabaseAdmin.from('generation_queue').select('result_image_id').eq('id', item.id)
      ).or(`prompt.eq."${item.prompt}",user_id.eq."${item.user_id}"`) 
      // Fallback: try to find the 'generating' record for this user/prompt if result_image_id wasn't set yet
    ]).catch(err => console.error("Error during fail-state cleanup:", err));
  }
}

// ============================================
// MAIN PROCESSOR
// ============================================
serve(async (req) => {
  // CORS IS MANDATORY HERE FIRST
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    // NO rate limiting logic - Community mode processes everything

    // Find oldest queued item (Original legacy logic generation_queue)
    const { data: nextItem, error: findError } = await supabaseAdmin
      .from('generation_queue')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (findError) throw findError;

    if (!nextItem) {
      return new Response(JSON.stringify({ message: "Queue is empty" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Atomic claim
    const { data: claimedItem, error: claimError } = await supabaseAdmin
      .from('generation_queue')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', nextItem.id)
      .eq('status', 'queued')
      .select('*')
      .maybeSingle();

    if (claimError) throw claimError;
    
    if (!claimedItem) {
      return new Response(JSON.stringify({ message: "Item claimed by another worker" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Process
    await processQueueItemAfterClaim(claimedItem, supabaseAdmin, geminiApiKey || '');

    // Chain next
    fetch(`${supabaseUrl}/functions/v1/process-generation-queue`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'continue' }),
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, message: "Processed item", itemId: claimedItem.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
