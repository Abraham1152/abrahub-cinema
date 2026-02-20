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

    const textPrompt = `Você é um diretor de fotografia e diretor criativo especializado em campanhas cinematográficas.

Crie uma estrutura narrativa dividida em cenas para uma campanha contínua e coesa. Para cada cena, escolha os parâmetros cinematográficos ideais usando EXATAMENTE as chaves disponíveis abaixo.

Projeto:
Objetivo: ${objective}
Tipo: ${type}
Duração total: ${duration}
Formato: ${format}
Tom: ${tone}

CÂMERA DISPONÍVEL (use o valor exato em preset_id):
- "arri-natural" → ARRI Alexa Mini LF, narrativo orgânico, tons fílmicos
- "red-commercial" → RED V-Raptor, precisão comercial, nítido e vibrante
- "sony-venice-night" → Sony Venice, otimizado para low-light e sombras ricas
- "anamorphic-film" → Anamorphic, widescreen cinemático com bokeh oval e lens flares
- "documentary-street" → Documentário, realismo autêntico, grão natural

FOCAL LENGTH disponível (use o valor exato em focal_length):
- "14mm" → ultra-wide dramático
- "24mm" → wide clássico
- "35mm" → perspectiva natural, versátil
- "50mm" → olho humano, compressão natural
- "85mm" → retrato, shallow depth
- "135mm" → telefoto, compressão forte, isolamento do sujeito

ABERTURA disponível (use o valor exato em aperture):
- "f1.4" → bokeh extremo, sonhador
- "f2.0" → shallow com mais tolerância
- "f2.8" → padrão cinema, separação equilibrada
- "f4.0" → moderado, nítido nos sujeitos
- "f5.6" → profundidade boa para múltiplos planos
- "f8.0" → máxima profundidade de campo

ÂNGULO DE CÂMERA disponível (use o valor exato em camera_angle):
- "eye-level" → neutro, imersivo
- "low-angle" → poder, dominância, heroísmo
- "high-angle" → vulnerabilidade, diminuído
- "dutch-angle" → tensão psicológica, desorientação
- "birds-eye" → perspectiva de deus, aérea
- "worms-eye" → escala monumental, baixíssimo
- "over-shoulder" → relação entre personagens
- "pov" → primeira pessoa, subjetivo
- "close-up" → emoção, detalhe íntimo
- "wide-shot" → ambiente, escala, contexto

REGRAS:
- Mínimo 3 cenas, máximo 8 cenas
- A soma das durações deve ser aproximadamente ${duration}
- Cada cena deve ter uma função narrativa clara
- Os prompts sugeridos devem ser em inglês e cinematográficos
- video_prompt: descreva em inglês (50-80 palavras) EXATAMENTE como animar a imagem-chave daquela cena. Inclua: movimento de câmera, movimento do sujeito/elementos, atmosfera, duração, tom emocional. Juntos devem formar sequência narrativa contínua.
- Escolha os parâmetros de câmera que MELHOR SERVEM cada cena narrativamente — não use sempre os mesmos

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
      "preset_id": "arri-natural",
      "focal_length": "35mm",
      "aperture": "f2.8",
      "camera_angle": "eye-level",
      "emotion": "emoção principal",
      "video_prompt": "Slow dolly in from wide establishing shot pushing toward subject. Soft golden light rakes from left, subject breathes naturally. Background depth-of-field shift reveals environment. Duration 5 seconds. Tone: intimate and establishing, sets the campaign world."
    }
  ]
}

Não escreva texto fora do JSON.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeyData.gemini_api_key}`;

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
      // Return raw Gemini error so we can diagnose
      let geminiErrorMsg = `Gemini ${geminiResponse.status}`;
      try { const parsed = JSON.parse(errorText); geminiErrorMsg = parsed?.error?.message || parsed?.message || errorText; } catch { geminiErrorMsg = errorText; }
      return new Response(JSON.stringify({ error: `Erro Gemini: ${geminiErrorMsg}` }), {
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
