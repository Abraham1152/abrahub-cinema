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

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Auth Header");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("User not authenticated");

    // Body
    const body = await req.json();
    const { imageUrl, panels } = body;
    if (!imageUrl || !panels || !panels.length) throw new Error("Missing parameters");

    const panelNum = panels[0];

    // API Key
    const { data: keyData } = await supabaseAdmin.from('user_api_keys').select('gemini_api_key, is_valid').eq('user_id', user.id).maybeSingle();
    if (!keyData?.is_valid || !keyData?.gemini_api_key) throw new Error("API Key Gemini ausente ou inválida.");

    console.log(`[SPLIT] Processing image ${imageUrl} panel ${panelNum}`);

    // 1. Get Storage Path reliably
    let path = imageUrl;
    if (imageUrl.includes('/object/public/storyboard-images/')) {
      path = imageUrl.split('/object/public/storyboard-images/')[1];
    } else if (imageUrl.includes('storyboard-images/')) {
      path = imageUrl.split('storyboard-images/')[1];
    }
    // Remove query params (signed tokens)
    path = path.split('?')[0];

    // 2. Download
    const { data: blob, error: downloadError } = await supabaseAdmin.storage.from('storyboard-images').download(path);
    if (downloadError || !blob) throw new Error(`Falha no storage: ${downloadError?.message || 'Arquivo não encontrado'}`);

    const buffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    // 3. Prompt
    const prompt = `The image is a 2x3 grid. Extract and upscale PANEL ${panelNum}. Output exactly ONE standalone cinematic image (16:9). Match art style and lighting. No borders.`;

    // 4. Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${keyData.gemini_api_key}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: base64 } }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" }, temperature: 0.4 }
      })
    });

    const aiData = await geminiRes.json();
    if (aiData.error) throw new Error(`Gemini: ${aiData.error.message}`);
    
    const resultBase64 = aiData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (!resultBase64) throw new Error("O Gemini não retornou a imagem. Tente outro painel.");

    // 5. Save
    const newId = crypto.randomUUID();
    const bytes = Uint8Array.from(atob(resultBase64), c => c.charCodeAt(0));
    const newPath = `${user.id}/realism/${newId}.png`;
    
    await supabaseAdmin.storage.from("storyboard-images").upload(newPath, bytes, { contentType: 'image/png' });
    const { data: { publicUrl } } = supabaseAdmin.storage.from("storyboard-images").getPublicUrl(newPath);

    await supabaseAdmin.from('user_generated_images').insert({
      id: newId, user_id: user.id, prompt: `Grid Split ${panelNum}`, 
      model_label: "ABRAhub Split", status: 'ready', url: publicUrl, master_url: publicUrl, aspect_ratio: "16:9"
    });

    return new Response(JSON.stringify({ success: true, images: [{ url: publicUrl }] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[SPLIT] Error:", error.message);
    // IMPORTANTE: Retornar erro no corpo do JSON para o frontend ler
    return new Response(JSON.stringify({ error: error.message, success: false }), { 
      status: 200, // Retornamos 200 para que o frontend consiga ler o JSON do erro
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
