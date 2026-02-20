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

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Usuário inválido");

    // Params check
    const { imageUrl, panels } = await req.json();
    if (!imageUrl || !panels || !panels.length) throw new Error("Parâmetros ausentes");
    const panelNum = panels[0];

    // API Key check
    const { data: keyData } = await supabaseAdmin.from('user_api_keys').select('gemini_api_key, is_valid').eq('user_id', user.id).maybeSingle();
    if (!keyData?.is_valid || !keyData?.gemini_api_key) throw new Error("API Key Gemini não configurada.");

    // 1. Get Path
    let path = imageUrl;
    if (imageUrl.includes('storyboard-images/')) {
      path = imageUrl.split('storyboard-images/')[1].split('?')[0];
    }

    // 2. Download
    const { data: blob, error: dlErr } = await supabaseAdmin.storage.from('storyboard-images').download(path);
    if (dlErr || !blob) throw new Error("Imagem não encontrada no storage.");
    
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // 3. Prompt
    const position = PANEL_POSITIONS[panelNum] || `painel ${panelNum}`;
    const prompt = `This is a 2x3 storyboard grid. Focus ONLY on PANEL ${panelNum} (${position}). 
    Generate a high-detail cinematic 16:9 upscale of this panel. Keep character and lighting identical. No grid, no borders.`;

    // 4. Gemini 2.0 Flash
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${keyData.gemini_api_key}`;
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: base64 } }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" }, temperature: 0.4 }
      })
    });

    const aiData = await res.json();
    if (aiData.error) throw new Error(`Gemini: ${aiData.error.message}`);
    
    const resultBase64 = aiData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!resultBase64) throw new Error("Gemini não retornou imagem.");

    // 5. Save and return
    const newId = crypto.randomUUID();
    const bytes = Uint8Array.from(atob(resultBase64), c => c.charCodeAt(0));
    const newPath = `${user.id}/realism/${newId}.png`;
    
    await supabaseAdmin.storage.from("storyboard-images").upload(newPath, bytes, { contentType: 'image/png' });
    const { data: { publicUrl } } = supabaseAdmin.storage.from("storyboard-images").getPublicUrl(newPath);

    await supabaseAdmin.from('user_generated_images').insert({
      id: newId, user_id: user.id, prompt: `Split Grid ${panelNum}`, 
      model_label: "ABRAhub Split", status: 'ready', url: publicUrl, master_url: publicUrl, aspect_ratio: "16:9"
    });

    return new Response(JSON.stringify({ success: true, images: [{ id: newId, url: publicUrl }] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
