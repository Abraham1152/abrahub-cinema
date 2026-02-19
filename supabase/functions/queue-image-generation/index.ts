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
    const body = await req.json();
    const { prompt, aspectRatio = "16:9", quality = "2K" } = body;

    const { data: keyData } = await supabaseAdmin.from('user_api_keys').select('gemini_api_key').eq('user_id', user!.id).single();
    if (!keyData?.gemini_api_key) throw new Error("Chave Gemini não configurada");

    // 1. Gerar Imagem
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': keyData.gemini_api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Cinematic, photorealistic. ${prompt}` }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio, imageSize: quality } }
      })
    });

    const data = await geminiRes.json();
    const base64 = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (!base64) throw new Error("Falha na geração");

    // 2. Criar Registro com Expiração (7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: imageRecord } = await supabaseAdmin.from('user_generated_images').insert({
      user_id: user!.id,
      prompt,
      status: 'ready',
      aspect_ratio: aspectRatio,
      expires_at: expiresAt.toISOString(), // Campo para o auto-delete
    }).select('id').single();

    // 3. Upload para Storage
    const fileName = `${user!.id}/${imageRecord.id}.png`;
    const rawBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    await supabaseAdmin.storage.from("storyboard-images").upload(fileName, rawBytes, { contentType: 'image/png' });

    const { data: { publicUrl } } = supabaseAdmin.storage.from("storyboard-images").getPublicUrl(fileName);

    // 4. Atualizar com a URL
    await supabaseAdmin.from('user_generated_images').update({ url: publicUrl, master_url: publicUrl }).eq('id', imageRecord.id);

    return new Response(JSON.stringify({ success: true, url: publicUrl, imageId: imageRecord.id }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
});
