import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Reference types for Smart Image Reference system
type ReferenceType = 'person' | 'object';

interface ClassificationResult {
  referenceType: ReferenceType;
  confidence: number;
  description: string;
  promptInjection: string;
}

// Prompt injections based on reference type
const PROMPT_INJECTIONS = {
  person: `Place the same person from the uploaded image into the described scene.
Preserve the subject exactly as shown.
Maintain the same face, hair, clothing, and body proportions.
Do not redesign the person.
Do not change identity, age, or gender.
Only change environment, lighting and camera perspective.
The person must appear naturally integrated into the scene.`,

  object: `Insert the exact uploaded object into the scene.
Do not redraw or reinterpret the object.
Preserve the original design, colors, and shape exactly.
Adjust scale, perspective, shadows and lighting to integrate naturally.
Make the object appear physically present in the environment.`,
};

// Input validation limits
const CONFIG = {
  MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
};

// Validate base64 image and return approximate size in bytes
function validateBase64Image(base64: string): { pureBase64: string; sizeBytes: number } {
  // Strip data URI prefix if present
  const pureBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  
  // Basic format validation (more permissive to allow padding)
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(pureBase64)) {
    throw new Error("Invalid base64 format");
  }
  
  // Calculate approximate decoded size (base64 is ~4/3 the size of binary)
  const sizeBytes = Math.floor(pureBase64.length * 0.75);
  
  if (sizeBytes > CONFIG.MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image size exceeds maximum of 10MB");
  }
  
  return { pureBase64, sizeBytes };
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CLASSIFY-REFERENCE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const body = await req.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Missing imageBase64 field" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 400 
        }
      );
    }
    
    // Validate image data
    let validatedImage: { pureBase64: string; sizeBytes: number };
    try {
      validatedImage = validateBase64Image(imageBase64);
      logStep("Image validated", { sizeBytes: validatedImage.sizeBytes });
    } catch (validationError) {
      return new Response(
        JSON.stringify({ error: validationError instanceof Error ? validationError.message : "Invalid image data" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 400 
        }
      );
    }

    logStep("Classifying image", { imageSize: validatedImage.sizeBytes });

    // Prepare the image URL (handle both with and without data prefix)
    const imageUrl = imageBase64.startsWith('data:') 
      ? imageBase64 
      : `data:image/png;base64,${imageBase64}`;

    // Call Lovable AI for classification
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an image classification system. Your task is to analyze an image and determine if the main subject is:
1. A PERSON (human being, portrait, full body, or partial view of a person)
2. An OBJECT/PRODUCT (physical item, product, device, vehicle, food, animal, or any non-human subject)

You must respond with a JSON object containing:
- "type": either "person" or "object"
- "confidence": a number from 0.0 to 1.0 indicating your confidence
- "description": a brief description of what you see in the image

Be decisive. If there's a human prominently featured, classify as "person". Otherwise, classify as "object".`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image and classify the main subject. Respond with JSON only.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required for AI services." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }
        );
      }
      const errorText = await response.text();
      logStep("Lovable AI error", { status: response.status, error: errorText });
      throw new Error(`AI classification failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from classification model");
    }

    logStep("Raw classification response", { content });

    // Parse the JSON response
    let classification;
    try {
      classification = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        classification = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse classification response");
      }
    }

    const referenceType: ReferenceType = classification.type === 'person' ? 'person' : 'object';
    const confidence = classification.confidence || 0.8;
    const description = classification.description || 'Image analyzed';

    const result: ClassificationResult = {
      referenceType,
      confidence,
      description,
      promptInjection: PROMPT_INJECTIONS[referenceType],
    };

    logStep("Classification complete", { referenceType, confidence });

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Error", { error: errorMessage });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
