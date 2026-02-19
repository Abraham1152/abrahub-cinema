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

    const { sceneId } = await req.json();
    if (!sceneId) {
      return new Response(JSON.stringify({ error: "sceneId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's API key (BYOK required)
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
      return new Response(JSON.stringify({ error: "API Key Gemini não configurada ou inválida. Configure nas Configurações." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userGeminiKey = apiKeyData.gemini_api_key;

    // Fetch scene
    const { data: scene, error: sceneError } = await supabase
      .from("storyboard_scenes")
      .select("*")
      .eq("id", sceneId)
      .eq("user_id", user.id)
      .single();

    if (sceneError || !scene) {
      return new Response(JSON.stringify({ error: "Cena não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch scene images
    const { data: images } = await supabase
      .from("storyboard_scene_images")
      .select("*")
      .eq("scene_id", sceneId)
      .eq("user_id", user.id)
      .order("sort_order");

    const filters = scene.filters || {};
    const sceneImages = images || [];
    const duration = scene.duration || 5;

    // Build context for LLM
    const imageDescriptions = sceneImages.map((img: any, i: number) => {
      const roleMap: Record<string, string> = {
        start_frame: "Start Frame (imagem inicial da cena, ponto de partida da animação)",
        end_frame: "End Frame (imagem final da cena, ponto de chegada da animação)",
        main_frame: "Main Frame (imagem principal da cena)",
      };
      return `Imagem ${i + 1}: Role = ${roleMap[img.role] || img.role}. Prompt original: "${img.prompt || 'sem prompt'}"`;
    }).join("\n");

    const activeFilters = Object.entries(filters)
      .filter(([k, v]) => v === true && !['emotion', 'camera_movement'].includes(k))
      .map(([k]) => {
        const filterMap: Record<string, string> = {
          character_consistency: "Manter consistência do personagem entre frames",
          environment_continuity: "Manter continuidade do ambiente entre frames",
          avoid_distortions: "Evitar distorções anatômicas",
          cinematic_camera: "Comportamento de câmera cinematográfica",
          natural_movement: "Movimento natural e orgânico",
        };
        return filterMap[k] || k;
      });

    // Emotion mapping
    const emotionMap: Record<string, string> = {
      tension: "TENSION — a sense of unease, tightness, and anticipation of conflict",
      joy: "JOY — warmth, brightness, uplifting energy and happiness",
      sadness: "SADNESS — melancholy, heaviness, subdued tones and slow pacing",
      fear: "FEAR — dread, darkness, unsettling shadows and anxious movement",
      wonder: "WONDER — awe, vast scale, ethereal lighting and breathtaking beauty",
      anger: "ANGER — intensity, harsh contrasts, aggressive movement and red tones",
      romance: "ROMANCE — soft focus, warm golden light, intimate proximity",
      nostalgia: "NOSTALGIA — warm desaturated tones, gentle grain, dreamy softness",
      serenity: "SERENITY — calm, balanced composition, gentle natural light",
      suspense: "SUSPENSE — building tension, dramatic shadows, slow deliberate reveal",
      euphoria: "EUPHORIA — explosive energy, vivid colors, dynamic and liberating motion",
      melancholy: "MELANCHOLY — muted blues and grays, rain or fog, introspective stillness",
    };
    const emotion = filters.emotion as string | undefined;
    const emotionBlock = emotion && emotionMap[emotion]
      ? `\nEMOTION: This scene should convey a strong sense of ${emotionMap[emotion]}. All visual elements, lighting, color grading, and movement should reinforce this emotion.\n`
      : "";

    // Camera movement mapping
    const cameraMovementMap: Record<string, string> = {
      static: "STATIC — The camera remains completely fixed. No movement at all. Emphasize subtle environmental motion instead.",
      slow_pan: "SLOW PAN LEFT/RIGHT — The camera slowly rotates horizontally, revealing the scene gradually. Smooth and deliberate.",
      tilt: "TILT UP/DOWN — The camera tilts vertically, revealing height or depth of the scene.",
      dolly_in: "DOLLY IN (Push In) — The camera slowly pushes forward toward the subject, creating a sense of approaching intimacy or revelation.",
      dolly_out: "DOLLY OUT (Pull Back) — The camera slowly pulls back from the subject, revealing more of the environment and creating distance.",
      tracking: "TRACKING SHOT — The camera moves laterally alongside the subject, following their movement through the scene.",
      crane: "CRANE UP/DOWN — The camera rises or descends vertically like a crane, revealing the scene from changing elevation.",
      orbit: "ORBIT / ARC SHOT — The camera circles around the subject in an arc, creating a dramatic 3D reveal effect.",
      zoom_in: "ZOOM IN — Optical zoom gradually tightening on the subject, increasing focal compression.",
      zoom_out: "ZOOM OUT — Optical zoom gradually widening, revealing more of the scene context.",
      handheld: "HANDHELD / SHAKY — Camera has subtle organic shake and imperfection, creating documentary-style realism.",
      steadicam: "STEADICAM FOLLOW — Smooth stabilized camera follows the subject through the scene with fluid motion.",
      whip_pan: "WHIP PAN — Rapid horizontal camera rotation with motion blur, transitioning energy between focal points.",
      push_through: "PUSH THROUGH — Camera moves forward through physical elements (doorways, foliage, gaps), creating immersive depth.",
    };
    const cameraMovement = filters.camera_movement as string | undefined;
    const cameraBlock = cameraMovement && cameraMovementMap[cameraMovement]
      ? `\nCAMERA MOVEMENT: ${cameraMovementMap[cameraMovement]} Speed and distance should be compatible with ${duration} seconds duration.\n`
      : "";

    const systemPrompt = `Você é um diretor de cinematografia especialista em criar prompts de animação para ferramentas como Kling AI e Seedance.

Sua tarefa é gerar UM ÚNICO prompt de animação em inglês, otimizado para ser usado diretamente em ferramentas de geração de vídeo a partir de imagem.

O prompt deve:
- Descrever o movimento desejado na cena de forma clara e técnica
- Incluir direções de câmera cinematográficas (pan, tilt, dolly, crane, etc.)
- Descrever movimentos naturais dos elementos da cena
- Ser conciso mas detalhado (máximo 200 palavras)
- Estar em inglês
- Os movimentos descritos devem ser compatíveis com a duração de ${duration} segundos

NÃO inclua metadados, títulos ou explicações. Retorne APENAS o prompt de animação.`;

    const userPrompt = `Gere um prompt de animação para a seguinte cena:

TÍTULO DA CENA: ${scene.title}
DURAÇÃO: ${duration} segundos
${scene.description ? `DESCRIÇÃO: ${scene.description}` : ""}

IMAGENS NA CENA:
${imageDescriptions || "Nenhuma imagem adicionada ainda."}

${activeFilters.length > 0 ? `FILTROS DE CONSISTÊNCIA ATIVADOS:\n${activeFilters.map(f => `- ${f}`).join("\n")}` : ""}
${emotionBlock}${cameraBlock}
Esta cena tem duração de ${duration} segundos. O prompt de animação deve descrever movimentos compatíveis com esse tempo — movimentos sutis para cenas curtas (3s), movimentos mais elaborados para cenas longas (5s).

Gere o prompt de animação em inglês, considerando todos os elementos acima.`;

    // Call Google Gemini API directly with user's key
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userGeminiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);
      
      if (geminiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições da API Gemini excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (geminiResponse.status === 403 || geminiResponse.status === 401) {
        return new Response(JSON.stringify({ error: "API Key Gemini inválida ou sem permissão. Verifique nas Configurações." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erro ao gerar prompt via Gemini" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    const generatedPrompt = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // Save generated prompt to scene
    await serviceClient
      .from("storyboard_scenes")
      .update({ generated_prompt: generatedPrompt })
      .eq("id", sceneId);

    return new Response(JSON.stringify({ prompt: generatedPrompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("storyboard-generate-prompt error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
