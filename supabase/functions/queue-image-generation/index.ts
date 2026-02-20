import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Usuário não encontrado");

    const body = await req.json();
    console.log("[QUEUE-IMAGE-GENERATION] Payload recebido:", JSON.stringify(body));

    const { 
      prompt, 
      aspectRatio = "16:9", 
      quality = "2K",
      presetId = "arri-natural",
      focalLength = "35mm",
      aperture = "f2.8",
      cameraAngle = "eye-level",
      filmLook = null,
      referenceImages = [],
      useOwnKey = true,
      sequenceMode = false,
      storyboard6Mode = false,
      referenceType: explicitReferenceType = null
    } = body;

    if (!prompt) throw new Error("Prompt é obrigatório");

    // Determinar o reference_type
    let referenceType = explicitReferenceType;
    if (!referenceType) {
      if (storyboard6Mode) {
        referenceType = 'storyboard6';
      } else if (sequenceMode) {
        referenceType = 'sequence';
      } else if (referenceImages && referenceImages.length > 0) {
        referenceType = 'standard';
      }
    }

    // 1. Adicionar à fila (generation_queue)
    const { data: queueItem, error: queueError } = await supabaseAdmin
      .from('generation_queue')
      .insert({
        user_id: user.id,
        prompt,
        aspect_ratio: aspectRatio,
        quality,
        preset_id: presetId,
        focal_length: focalLength,
        aperture,
        camera_angle: cameraAngle,
        film_look: filmLook,
        status: 'queued',
        credits_cost: 0,
        reference_images: referenceImages,
        reference_type: referenceType,
        use_user_key: useOwnKey,
        sequence_mode: sequenceMode
      })
      .select('id')
      .single();

    if (queueError) throw queueError;

    console.log(`[QUEUE-IMAGE-GENERATION] Item adicionado à fila: ${queueItem.id} | Type: ${referenceType}`);

    // 2. Acordar o processador de fila (Fire and forget)
    // Usamos o supabaseServiceKey para autorizar a chamada interna
    fetch(`${supabaseUrl}/functions/v1/process-generation-queue`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ trigger: 'new_item', itemId: queueItem.id }),
    }).catch(err => console.error("Erro ao acordar processador:", err));

    return new Response(JSON.stringify({ 
      success: true, 
      queueId: queueItem.id,
      message: "Imagem enviada para a fila de processamento" 
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("[QUEUE-IMAGE-GENERATION] Erro:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
