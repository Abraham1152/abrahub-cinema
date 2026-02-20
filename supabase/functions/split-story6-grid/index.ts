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
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader!.replace("Bearer ", ""));
    if (!user) throw new Error("Não autorizado");

    const { imageUrl, panels } = await req.json();
    if (!imageUrl || !panels || !panels.length) throw new Error("Parâmetros ausentes");

    const queueItems = [];

    // Para cada painel selecionado, criamos um item na fila
    for (const panelNum of panels) {
      const { data: queueItem, error: queueError } = await supabaseAdmin
        .from('generation_queue')
        .insert({
          user_id: user.id,
          prompt: `Upscale cinematográfico do Painel ${panelNum}`,
          status: 'queued',
          credits_cost: 0,
          reference_images: [imageUrl],
          reference_type: 'split_upscale',
          reference_prompt_injection: `panel_number:${panelNum}`,
          aspect_ratio: "16:9",
          quality: "2K",
          use_user_key: true
        })
        .select('id')
        .single();

      if (queueError) throw queueError;
      queueItems.push({ panel: panelNum, queueId: queueItem.id });
    }

    // Acorda o processador
    fetch(`${supabaseUrl}/functions/v1/process-generation-queue`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'split_grid' }),
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, queueItems }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
