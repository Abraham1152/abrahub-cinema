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
    if (!authHeader) throw new Error("Não autorizado: Header ausente");
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Usuário não autenticado");

    const { data: keyData } = await supabaseAdmin.from('user_api_keys').select('gemini_api_key, is_valid').eq('user_id', user.id).maybeSingle();
    if (!keyData?.is_valid || !keyData?.gemini_api_key) throw new Error("Sua API Key do Gemini está ausente ou inválida nas configurações.");

    const body = await req.json();
    const { imageUrl, storagePath, panels, quality = "2K" } = body;
    
    if (!panels) throw new Error("Dados incompletos para processar o painel");
    
    const panelNum = panels[0];
    const position = PANEL_POSITIONS[panelNum] || `panel ${panelNum}`;

    // Resolve Storage Path
    let finalPath = storagePath || imageUrl;
    if (finalPath.includes('storyboard-images/')) {
      finalPath = finalPath.split('storyboard-images/')[1].split('?')[0];
    }
    
    console.log(`[SPLIT] Processing: ${finalPath} for user ${user.id}`);

    // 1. Download from Storage
    const { data: blob, error: downloadError } = await supabaseAdmin.storage.from('storyboard-images').download(finalPath);
    if (downloadError || !blob) {
      console.error("[SPLIT] Storage error:", downloadError);
      throw new Error(`Não foi possível acessar a imagem: ${downloadError?.message || 'Arquivo não encontrado'}`);
    }

    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // 2. Build Prompt
    const prompt = `Image is a 2x3 grid. Extract and generative upscale PANEL ${panelNum} (${position}). Output standalone 16:9 cinematic image. Match original characters/lighting exactly.`;

    // 3. Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${keyData.gemini_api_key}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: base64 } }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9", imageSize: quality }, temperature: 0.4 }
      })
    });

    const aiData = await geminiRes.json();
    if (aiData.error) throw new Error(`Gemini: ${aiData.error.message}`);
    
    const resultBase64 = aiData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (!resultBase64) throw new Error("O Gemini não retornou a imagem (pode ter sido bloqueada pelos filtros de segurança).");

    // 4. Save and return
    const newId = crypto.randomUUID();
    const raw = Uint8Array.from(atob(resultBase64), c => c.charCodeAt(0));
    const newPath = `${user.id}/realism/${newId}.png`;
    
    await supabaseAdmin.storage.from("storyboard-images").upload(newPath, raw, { contentType: 'image/png' });
    const { data: { publicUrl } } = supabaseAdmin.storage.from("storyboard-images").getPublicUrl(newPath);

    await supabaseAdmin.from('user_generated_images').insert({
      id: newId, user_id: user.id, prompt: `Upscale Painel ${panelNum}`, 
      model_label: "ABRAhub Realism (Split)", status: 'ready', url: publicUrl, master_url: publicUrl, aspect_ratio: "16:9"
    });

    return new Response(JSON.stringify({ success: true, images: [{ url: publicUrl }] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[SPLIT] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message, success: false }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
