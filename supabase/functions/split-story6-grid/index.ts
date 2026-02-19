import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PANEL_POSITIONS: Record<number, string> = {
  1: "top-left (first row, first column)",
  2: "top-center (first row, second column)",
  3: "top-right (first row, third column)",
  4: "bottom-left (second row, first column)",
  5: "bottom-center (second row, second column)",
  6: "bottom-right (second row, third column)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");
    const userId = userData.user.id;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { imageUrl, imageId, panels, quality } = await req.json();
    if (!imageUrl || !panels || !Array.isArray(panels) || panels.length === 0) {
      throw new Error("Missing imageUrl or panels");
    }

    console.log(`[SPLIT-GRID] Generating ${panels.length} individual panels for user ${userId}, quality: ${quality || '2K'}`);

    // Determine resolution instruction based on quality
    const qualityLabel = quality || "2K";
    const resolutionInstruction = qualityLabel === "4K" 
      ? "in ultra high resolution (4K quality, maximum detail)" 
      : "in high resolution (2K quality, sharp and detailed)";

    // Generate each panel individually using Nano Banana
    const generatedImages: Array<{
      panel: number;
      imageId: string;
      previewUrl: string;
      masterUrl: string;
    }> = [];

    for (const panelNum of panels) {
      const position = PANEL_POSITIONS[panelNum] || `panel ${panelNum}`;
      
      const prompt = `The attached image is a storyboard grid with exactly 6 panels in a 3-column × 2-row layout. ` +
        `Panel numbering (left-to-right, top-to-bottom): 1=top-left, 2=top-center, 3=top-right, 4=bottom-left, 5=bottom-center, 6=bottom-right. ` +
        `TASK: Extract and upscale ONLY Panel ${panelNum} (${position}). ` +
        `Crop exactly the content visible in that panel cell and render it as a single standalone high-resolution image ${resolutionInstruction}. ` +
        `ABSOLUTE RULES — VIOLATION MEANS FAILURE: ` +
        `1. Output EXACTLY ONE image — never a grid, never a collage, never multiple panels side by side. ` +
        `2. The output must show ONLY what is inside Panel ${panelNum}'s cell boundaries — nothing from adjacent panels. ` +
        `3. DO NOT generate new content, DO NOT reinterpret, DO NOT add panels. Just enlarge what is already there. ` +
        `4. Maintain the EXACT same characters, poses, expressions, colors, lighting, art style from the original panel. ` +
        `5. Output aspect ratio: 16:9, filling the entire frame with that single panel's content.`;

      console.log(`[SPLIT-GRID] Generating panel ${panelNum} (${position})...`);

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: imageUrl },
                },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`[SPLIT-GRID] AI error for panel ${panelNum}: ${aiResponse.status} ${errText}`);
        
        if (aiResponse.status === 429) {
          throw new Error("Rate limit exceeded. Please try again in a moment.");
        }
        if (aiResponse.status === 402) {
          throw new Error("Insufficient AI credits. Please add credits to continue.");
        }
        throw new Error(`AI generation failed for panel ${panelNum}`);
      }

      const aiData = await aiResponse.json();
      const generatedImageBase64 = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!generatedImageBase64) {
        console.warn(`[SPLIT-GRID] No image returned for panel ${panelNum} (safety filter?) — skipping`);
        continue;
      }

      // Extract base64 data
      const base64Match = generatedImageBase64.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
      if (!base64Match) {
        throw new Error(`Invalid image data for panel ${panelNum}`);
      }

      const mimeType = `image/${base64Match[1]}`;
      const fileExt = base64Match[1] === "jpeg" ? "jpg" : base64Match[1];
      const rawBase64 = base64Match[2];

      // Decode base64 to bytes
      const binaryString = atob(rawBase64);
      const rawBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        rawBytes[i] = binaryString.charCodeAt(i);
      }

      // Create image record
      const timestamp = Date.now();
      const imageRecordId = crypto.randomUUID();
      const fileName = `${userId}/split-grid/${imageRecordId}-panel${panelNum}-${timestamp}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("storyboard-images")
        .upload(fileName, rawBytes, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        console.error(`[SPLIT-GRID] Upload error for panel ${panelNum}:`, uploadError);
        throw new Error(`Failed to upload panel ${panelNum}`);
      }

      // Generate public URL (bucket is now public, no signed tokens needed)
      const { data: publicUrlData } = supabase.storage
        .from("storyboard-images")
        .getPublicUrl(fileName);

      const masterUrl = publicUrlData.publicUrl;
      const previewUrl = masterUrl;

      // Detect dimensions
      let imgWidth = 0, imgHeight = 0;
      if (rawBytes[0] === 137 && rawBytes[1] === 80) {
        imgWidth = (rawBytes[16] << 24) | (rawBytes[17] << 16) | (rawBytes[18] << 8) | rawBytes[19];
        imgHeight = (rawBytes[20] << 24) | (rawBytes[21] << 16) | (rawBytes[22] << 8) | rawBytes[23];
      } else if (rawBytes[0] === 0xFF && rawBytes[1] === 0xD8) {
        let offset = 2;
        while (offset < rawBytes.length - 8) {
          if (rawBytes[offset] !== 0xFF) { offset++; continue; }
          const marker = rawBytes[offset + 1];
          if (marker === 0xC0 || marker === 0xC2) {
            imgHeight = (rawBytes[offset + 5] << 8) | rawBytes[offset + 6];
            imgWidth = (rawBytes[offset + 7] << 8) | rawBytes[offset + 8];
            break;
          }
          const length = (rawBytes[offset + 2] << 8) | rawBytes[offset + 3];
          offset += 2 + length;
        }
      }

      // Save to user_generated_images
      const { data: imgRecord, error: imgError } = await supabase
        .from("user_generated_images")
        .insert({
          id: imageRecordId,
          user_id: userId,
          prompt: `Panel ${panelNum} extracted from Story 6 grid`,
          model: "gemini-2.5-flash-image",
          model_label: "Nano Banana (Split)",
          status: "ready",
          credits_cost: 0,
          master_url: masterUrl,
          preview_url: previewUrl,
          master_width: imgWidth || null,
          master_height: imgHeight || null,
          master_bytes: rawBytes.length,
          preview_width: Math.min(imgWidth || 600, 600),
          preview_height: imgHeight ? Math.round((Math.min(imgWidth || 600, 600) / (imgWidth || 1)) * imgHeight) : null,
          aspect_ratio: "16:9",
          is_story6: false,
        })
        .select()
        .single();

      if (imgError) {
        console.error(`[SPLIT-GRID] DB insert error for panel ${panelNum}:`, imgError);
      }

      generatedImages.push({
        panel: panelNum,
        imageId: imageRecordId,
        previewUrl,
        masterUrl,
      });

      console.log(`[SPLIT-GRID] Panel ${panelNum} generated and saved: ${imageRecordId}`);

      // Small delay between generations to avoid rate limits
      if (panels.indexOf(panelNum) < panels.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`[SPLIT-GRID] Successfully generated ${generatedImages.length} panels`);

    return new Response(JSON.stringify({
      success: true,
      images: generatedImages,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[SPLIT-GRID] Error: ${msg}`);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
