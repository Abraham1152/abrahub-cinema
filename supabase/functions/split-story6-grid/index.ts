import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PANEL_POSITIONS: Record<number, string> = {
  1: "top-left", 2: "top-center", 3: "top-right",
  4: "bottom-left", 5: "bottom-center", 6: "bottom-right",
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

    const { data: keyData } = await supabaseAdmin.from('user_api_keys').select('gemini_api_key, is_valid').eq('user_id', user.id).maybeSingle();
    if (!keyData?.is_valid || !keyData?.gemini_api_key) throw new Error("API Key não configurada.");

    const { imageUrl, panels, quality = "2K" } = await req.json();
    const panelNum = panels[0];
    const position = PANEL_POSITIONS[panelNum];

    // 1. Download image from Storage
    const path = imageUrl.split('storyboard-images/')[1];
    const { data: blob } = await supabaseAdmin.storage.from('storyboard-images').download(path);
    if (!blob) throw new Error("Falha ao baixar imagem original.");
    const base64 = btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));

    // 2. Optimized Prompt for Gemini 2.0 Flash
    const prompt = `This image is a 2x3 grid. Extract and upscale panel ${panelNum} (${position}). 
    Rules: Standalone 16:9 image. Match characters/style exactly. High detail cinematic. No borders.`;

    // 3. Call Gemini 2.0 Flash (Fastest model)
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${keyData.gemini_api_key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: base64 } }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9", imageSize: quality } }
      })
    });

    const aiData = await geminiRes.json();
    const resultBase64 = aiData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (!resultBase64) throw new Error(aiData.error?.message || "Gemini falhou na geração.");

    // 4. Save Image
    const newId = crypto.randomUUID();
    const raw = Uint8Array.from(atob(resultBase64), c => c.charCodeAt(0));
    await supabaseAdmin.storage.from("storyboard-images").upload(`${user.id}/realism/${newId}.png`, raw, { contentType: 'image/png' });
    const { data: { publicUrl } } = supabaseAdmin.storage.from("storyboard-images").getPublicUrl(`${user.id}/realism/${newId}.png`);

    await supabaseAdmin.from('user_generated_images').insert({
      id: newId, user_id: user.id, prompt: `Upscale Panel ${panelNum}`, 
      model_label: "ABRAhub Split", status: "ready", url: publicUrl, master_url: publicUrl, aspect_ratio: "16:9"
    });

    return new Response(JSON.stringify({ success: true, images: [{ url: publicUrl }] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[SPLIT] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message, success: false }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
