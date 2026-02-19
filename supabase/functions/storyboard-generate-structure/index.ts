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

    const { objective, type, duration, format, tone } = await req.json();
    if (!objective || !type || !duration || !format || !tone) {
      return new Response(JSON.stringify({ error: "Todos os campos são obrigatórios" }), {
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
      return new Response(JSON.stringify({ error: "API Key Gemini não configurada. Configure sua chave nas Configurações." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const textPrompt = `Você é um diretor criativo especializado em campanhas cinematográficas.

Crie uma estrutura narrativa clara dividida em cenas.

Projeto:
Objetivo: ${objective}
Tipo: ${type}
Duração total: ${duration}
Formato: ${format}
Tom: ${tone}

REGRAS:
- Mínimo 3 cenas, máximo 8 cenas
- A soma das durações deve ser aproximadamente ${duration}
- Cada cena deve ter uma função narrativa clara
- Os prompts sugeridos devem ser em inglês e cinematográficos
- camera_suggestion deve ser em inglês (ex: "slow dolly in", "tracking shot")

Retorne JSON estruturado no formato:

{
  "title": "título do projeto",
  "concept": "conceito narrativo em uma frase",
  "scenes": [
    {
      "scene_number": 1,
      "name": "nome da cena",
      "objective": "objetivo narrativo",
      "duration_seconds": 5,
      "visual_description": "descrição visual detalhada",
      "suggested_prompt_base": "cinematic English prompt for image generation",
      "camera_suggestion": "camera movement suggestion",
      "emotion": "emoção principal"
    }
  ]
}

Não escreva texto fora do JSON.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKeyData.gemini_api_key}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: textPrompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);
      if (geminiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit da API Gemini. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar estrutura via Gemini" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";

    let structure: any;
    try {
      structure = JSON.parse(rawText);
    } catch {
      console.error("[STRUCTURE] Failed to parse:", rawText);
      return new Response(JSON.stringify({ error: "Erro ao processar resposta da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce max 8 scenes
    if (structure.scenes && structure.scenes.length > 8) {
      structure.scenes = structure.scenes.slice(0, 8);
    }

    console.log(`[STRUCTURE] Generated ${structure.scenes?.length || 0} scenes for user ${user.id}`);

    return new Response(JSON.stringify(structure), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("storyboard-generate-structure error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
