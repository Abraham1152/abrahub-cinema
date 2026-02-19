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

    const { sceneId, imageUrl, panels, duration = 5, scenePrompt, existingShotCount = 0 } = await req.json();
    if (!sceneId || !imageUrl) {
      return new Response(JSON.stringify({ error: "sceneId e imageUrl são obrigatórios" }), {
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
      return new Response(JSON.stringify({ error: "API Key Gemini não configurada" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userGeminiKey = apiKeyData.gemini_api_key;

    // Download image for vision analysis
    console.log("[ANIM-PROMPT] Downloading image for analysis...");
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      return new Response(JSON.stringify({ error: "Não foi possível baixar a imagem" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const imgBuffer = await imgResponse.arrayBuffer();
    const bytes = new Uint8Array(imgBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const imgBase64 = btoa(binary);
    const mimeType = imgResponse.headers.get("content-type") || "image/png";

    // Build prompt based on whether it's a Grid (panels) or single image
    const isGrid = panels && panels.length > 0;

    let textPrompt: string;

    if (isGrid) {
      const panelPositions: Record<number, string> = {
        1: "top-left", 2: "top-center", 3: "top-right",
        4: "bottom-left", 5: "bottom-center", 6: "bottom-right",
      };
      const panelDescs = panels.map((p: number) => `Panel ${p} (${panelPositions[p] || 'unknown'})`).join(", ");

      textPrompt = `You are an expert cinematography director specializing in creating animation prompts for tools like Kling AI and Seedance.

This image is a 3x2 GRID containing 6 narrative panels (like a comic/storyboard). Panel numbering is left-to-right, top-to-bottom: 1=top-left, 2=top-center, 3=top-right, 4=bottom-left, 5=bottom-center, 6=bottom-right.

TASK: Generate ONE cinematic animation prompt for EACH of these SPECIFIC panels ONLY: ${panelDescs}

CRITICAL RULES:
- Generate prompts ONLY for the panels listed above. Do NOT generate prompts for any other panels.
- You MUST return EXACTLY ${panels.length} objects in the array, one per requested panel.

For each panel, generate a prompt that:
- Describes the ideal camera movement for that specific panel's content (dolly in, pan, orbit, crane, tracking, etc.)
- Includes natural motion for characters/elements visible in that panel
- Is optimized for ${duration}s video generation
- Is in English, concise but detailed (max 150 words per prompt)
- Feels cinematic and professional

RESPOND IN STRICT JSON FORMAT:
[
  { "panel": <number>, "prompt": "<animation prompt>" },
  ...
]

Return ONLY valid JSON. No markdown, no explanation.`;
    } else {
      // SEQUENCE MODE: generate continuation shots based on image + scene prompt
      const nextShotNumber = existingShotCount + 2; // +2 because Shot 1 is the original image
      const maxShots = Math.min(3, Math.floor(15 / duration)); // fill up to 15s total
      const shotsToGenerate = Math.max(1, maxShots);

      const contextLine = scenePrompt 
        ? `\n\nThe ORIGINAL SCENE PROMPT (Shot 1) is:\n"${scenePrompt}"\n\nUse this as the narrative starting point. Each new shot must be a NATURAL CONTINUATION of this story.`
        : '';

      textPrompt = `You are an expert cinematography director specializing in creating multi-shot animation sequences for tools like Kling AI and Seedance.

Analyze this image and create a SEQUENCE of ${shotsToGenerate} continuation shots that progress the narrative forward.${contextLine}

RULES:
- Shot numbering starts at ${nextShotNumber} (Shot 1 is the original image the user already has)
- Each shot is ${duration}s of video
- Each shot must naturally evolve the action/story from the previous one
- Describe specific camera movements (dolly in, slow pan, orbit, crane, tracking, steadicam, whip pan, etc.)
- Include character/element motion and narrative progression
- Each prompt must be in English, concise but detailed (max 150 words)
- Feel cinematic and professional — like a real film sequence
- Choose camera movements that enhance the visual storytelling and create dynamic variety between shots

RESPOND IN STRICT JSON FORMAT:
[
  { "shot": ${nextShotNumber}, "prompt": "<animation prompt for shot ${nextShotNumber}>" },
  ...
]

Return ONLY valid JSON. No markdown, no explanation.`;
    }

    // Call Gemini with vision
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userGeminiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: imgBase64 } },
              { text: textPrompt },
            ],
          },
        ],
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
      return new Response(JSON.stringify({ error: "Erro ao gerar prompts via Gemini" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[]";
    
    let prompts: Array<{ panel?: number; prompt: string }>;
    try {
      prompts = JSON.parse(rawText);
    } catch {
      console.error("[ANIM-PROMPT] Failed to parse Gemini response:", rawText);
      return new Response(JSON.stringify({ error: "Erro ao processar resposta da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter to only requested panels (Gemini sometimes returns extras)
    if (isGrid && panels) {
      const requestedSet = new Set(panels as number[]);
      prompts = prompts.filter(p => p.panel !== undefined && requestedSet.has(p.panel));
      console.log(`[ANIM-PROMPT] Filtered to ${prompts.length} prompts for panels: ${panels.join(',')}`);
    }

    // Save to scene
    const { data: existingScene } = await serviceClient
      .from("storyboard_scenes")
      .select("animation_prompts")
      .eq("id", sceneId)
      .single();

    const existing = (existingScene?.animation_prompts as any[]) || [];
    const updated = [...existing, ...prompts.map(p => ({ ...p, duration }))];

    await serviceClient
      .from("storyboard_scenes")
      .update({ animation_prompts: updated })
      .eq("id", sceneId);

    console.log(`[ANIM-PROMPT] Generated ${prompts.length} animation prompts for scene ${sceneId}`);

    return new Response(JSON.stringify({ prompts: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("storyboard-animation-prompts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
