import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL_ID = "gemini-3-pro-image-preview";

const logStep = (step: string, details?: any) => {
  console.log(`[STORYBOARD-GEN] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

// Compress image URL to ~512px for reference (fetch + resize via canvas-like approach in Deno)
async function fetchAndCompressImage(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const arrayBuffer = await resp.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const base64 = btoa(String.fromCharCode(...uint8));
    const contentType = resp.headers.get("content-type") || "image/png";
    // Note: Deno doesn't have canvas, so we send the image as-is but rely on preview_url being small
    return { data: base64, mimeType: contentType };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;
    logStep("Authenticated", { userId });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 2. Parse body
    const { sceneId, promptComplement, useOwnKey = false } = await req.json();
    if (!sceneId) {
      return new Response(JSON.stringify({ error: "sceneId é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Fetch scene data
    const { data: scene, error: sceneErr } = await supabaseAdmin
      .from("storyboard_scenes")
      .select("*")
      .eq("id", sceneId)
      .eq("user_id", userId)
      .single();

    if (sceneErr || !scene) {
      return new Response(JSON.stringify({ error: "Cena não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!scene.prompt_base?.trim()) {
      return new Response(JSON.stringify({ error: "Prompt base é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Check blocked + admin role
    const [entResult, roleResult] = await Promise.all([
      supabaseAdmin.from("entitlements").select("is_blocked, plan").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    ]);
    const entData = entResult.data;
    const isAdmin = !!roleResult.data;

    if (entData?.is_blocked) {
      return new Response(JSON.stringify({ error: "Conta bloqueada" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5. Determine API key - EXCLUSIVE BYOK
    let apiKey: string;

    const { data: keyData } = await supabaseAdmin
      .from("user_api_keys")
      .select("gemini_api_key, is_valid")
      .eq("user_id", userId)
      .maybeSingle();

    if (!keyData?.gemini_api_key || !keyData.is_valid) {
      return new Response(JSON.stringify({ 
        error: "Atenção: Você precisa configurar sua Google API Key em Configurações.",
        code: "MISSING_API_KEY"
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    apiKey = keyData.gemini_api_key;
    logStep("Using BYOK key");

    // 6. Fetch references (max 3)
    const { data: refs } = await supabaseAdmin
      .from("storyboard_scene_references")
      .select("image_id, user_generated_images!inner(preview_url)")
      .eq("scene_id", sceneId)
      .eq("user_id", userId)
      .order("sort_order")
      .limit(3);

    // 7. Build prompt
    const aspectRatio = scene.aspect_ratio || "16:9";
    const styleData = scene.style_data || {};

    let promptParts: string[] = [];
    promptParts.push("You are a cinematic image generation system. Generate a photorealistic image based on the scene description below.");
    promptParts.push(`Scene: ${scene.prompt_base}`);
    
    if (promptComplement?.trim()) {
      promptParts.push(`Additional direction: ${promptComplement.trim()}`);
    }

    if (Object.keys(styleData).length > 0) {
      promptParts.push(`Style parameters: ${JSON.stringify(styleData)}`);
    }

    if (refs && refs.length > 0) {
      promptParts.push("Reference images are provided. Maintain visual consistency with them in terms of style, lighting, color palette, and character appearance.");
    }

    promptParts.push("Ultra-realistic human appearance with natural imperfections. No AI look, no beauty filters.");

    const fullPrompt = promptParts.join("\n\n");
    logStep("Prompt built", { length: fullPrompt.length, refCount: refs?.length || 0 });

    // 8. Build content parts with references
    const contentParts: any[] = [];

    if (refs && refs.length > 0) {
      for (const ref of refs) {
        const imgRecord = (ref as any).user_generated_images;
        const previewUrl = imgRecord?.preview_url;
        if (previewUrl) {
          const compressed = await fetchAndCompressImage(previewUrl);
          if (compressed) {
            contentParts.push({ inlineData: { mimeType: compressed.mimeType, data: compressed.data } });
          }
        }
      }
    }

    contentParts.push({ text: fullPrompt });

    // 9. Call Gemini
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`;
    const requestBody = {
      contents: [{ parts: contentParts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio },
        temperature: 0.7,
      },
    };

    logStep("Calling Gemini API");
    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      logStep("Gemini error", { status: geminiResponse.status, error: errorText.substring(0, 500) });
      if (geminiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "API sobrecarregada. Tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Falha na geração" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const geminiData = await geminiResponse.json();
    const finishReason = geminiData.candidates?.[0]?.finishReason;
    if (finishReason === "SAFETY" || finishReason === "IMAGE_SAFETY") {
      return new Response(JSON.stringify({ error: "Conteúdo bloqueado por segurança" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const parts = geminiData.candidates?.[0]?.content?.parts;
    let base64Image: string | null = null;
    let mimeType = "image/png";
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("image/")) {
          base64Image = part.inlineData.data;
          mimeType = part.inlineData.mimeType;
          break;
        }
      }
    }

    if (!base64Image) {
      return new Response(JSON.stringify({ error: "Nenhuma imagem gerada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    logStep("Image received", { sizeKB: Math.round(base64Image.length * 0.75 / 1024) });

    // 10. Save to storage
    const imageBytes = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));
    const ext = mimeType === "image/jpeg" ? "jpg" : "png";
    const fileName = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("storyboard-images")
      .upload(fileName, imageBytes, { contentType: mimeType, upsert: false });

    if (uploadErr) {
      logStep("Upload failed", { error: uploadErr });
      return new Response(JSON.stringify({ error: "Falha ao salvar imagem" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("storyboard-images")
      .getPublicUrl(fileName);
    const publicUrl = publicUrlData.publicUrl;

    // 11. Deduct credits (skip BYOK and admins)
    if (!useOwnKey && !isAdmin) {
      try {
        await supabaseAdmin.rpc("consume_credits_admin", { _user_id: userId, _amount: creditsCost });
        logStep("Credits deducted", { creditsCost });
      } catch (err) {
        logStep("Credit deduction failed", { error: String(err) });
      }
    }

    // 12. Save to user_generated_images
    const { data: imageRecord } = await supabaseAdmin
      .from("user_generated_images")
      .insert({
        user_id: userId,
        prompt: scene.prompt_base.substring(0, 2000),
        model: MODEL_ID,
        model_label: "Storyboard",
        status: "ready",
        aspect_ratio: aspectRatio,
        credits_cost: useOwnKey ? 0 : creditsCost,
        preview_url: publicUrl,
        master_url: publicUrl,
        url: publicUrl,
      })
      .select("id")
      .single();

    // 13. Check if first image in scene
    const { count } = await supabaseAdmin
      .from("storyboard_scene_images")
      .select("id", { count: "exact", head: true })
      .eq("scene_id", sceneId);

    const isPrimary = (count || 0) === 0;

    // 14. Link to scene
    await supabaseAdmin
      .from("storyboard_scene_images")
      .insert({
        scene_id: sceneId,
        user_id: userId,
        image_id: imageRecord?.id || null,
        image_url: publicUrl,
        master_url: publicUrl,
        prompt: scene.prompt_base.substring(0, 2000),
        role: "generated",
        sort_order: count || 0,
        is_primary: isPrimary,
      });

    logStep("Done", { imageId: imageRecord?.id, isPrimary });

    return new Response(
      JSON.stringify({
        success: true,
        imageId: imageRecord?.id || null,
        imageUrl: publicUrl,
        isPrimary,
        creditsCost: useOwnKey ? 0 : creditsCost,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logStep("Unhandled error", { error: String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
