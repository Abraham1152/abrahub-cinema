import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { scenes, format } = await req.json();
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return new Response(JSON.stringify({ error: "Lista de cenas é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's BYOK API key
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: apiKeyData } = await serviceClient
      .from("user_api_keys")
      .select("gemini_api_key, is_valid")
      .eq("user_id", user.id)
      .single();

    if (!apiKeyData?.gemini_api_key || !apiKeyData.is_valid) {
      return new Response(JSON.stringify({ error: "API Key Gemini não configurada" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scenesDescription = scenes.map((s: any, i: number) => 
      `Cena ${i + 1}: "${s.title}"
  - Prompt base: ${s.prompt_base || 'N/A'}
  - Descrição: ${s.description || 'N/A'}
  - Duração: ${s.duration || 5}s
  - Formato: ${format || '16:9'}`
    ).join('\n\n');

    const textPrompt = `You are an expert cinematography director specializing in creating animation prompts for AI video tools like Kling AI and Veo.

Given the following storyboard scenes, generate a detailed animation prompt for EACH scene that is ready to be used directly in Kling/Veo.

SCENES:
${scenesDescription}

For each scene, generate:
- camera_movement: specific camera movement (dolly in, pan left, crane up, tracking shot, etc.)
- motion_description: what moves in the scene (characters, objects, environment)
- lighting: lighting description
- duration: suggested duration in seconds
- full_animation_prompt: complete animation prompt in English, ready for Kling/Veo (max 200 words)

RESPOND IN STRICT JSON FORMAT:
{
  "animation_prompts": [
    {
      "scene_number": 1,
      "camera_movement": "",
      "motion_description": "",
      "lighting": "",
      "duration": "5s",
      "full_animation_prompt": ""
    }
  ]
}

Return ONLY valid JSON. No markdown, no explanation.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKeyData.gemini_api_key}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: textPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);
      if (geminiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit da API Gemini. Tente novamente." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar prompts de animação" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";

    let result: any;
    try {
      result = JSON.parse(rawText);
    } catch {
      console.error("[ANIM-BATCH] Failed to parse:", rawText);
      return new Response(JSON.stringify({ error: "Erro ao processar resposta da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save animation prompts to each scene
    const prompts = result.animation_prompts || [];
    for (let i = 0; i < Math.min(prompts.length, scenes.length); i++) {
      const sceneId = scenes[i].id;
      if (sceneId) {
        await serviceClient
          .from("storyboard_scenes")
          .update({ animation_prompts: [prompts[i]] })
          .eq("id", sceneId);
      }
    }

    console.log(`[ANIM-BATCH] Generated ${prompts.length} animation prompts`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("storyboard-generate-animation-batch error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
