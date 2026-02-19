import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");

    const userId = userData.user.id;
    const { apiKey, action } = await req.json();

    // Handle delete action
    if (action === 'delete') {
      await supabase
        .from('user_api_keys')
        .delete()
        .eq('user_id', userId);

      return new Response(JSON.stringify({ success: true, message: "API key removida" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the API key
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "API key inválida. Verifique e tente novamente." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Test the key against Google Gemini API
    console.log("[VALIDATE-API-KEY] Testing key against Gemini API...");
    
    const testResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`
    );

    if (!testResponse.ok) {
      const status = testResponse.status;
      console.log("[VALIDATE-API-KEY] Gemini API test failed", { status });

      if (status === 400 || status === 401 || status === 403) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "API key inválida ou sem permissão. Verifique no Google AI Studio." 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      return new Response(JSON.stringify({ 
        success: false, 
        error: "Erro ao validar a API key. Tente novamente." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Key is valid - save/update in database
    console.log("[VALIDATE-API-KEY] Key is valid, saving...");

    const { error: upsertError } = await supabase
      .from('user_api_keys')
      .upsert({
        user_id: userId,
        gemini_api_key: apiKey.trim(),
        is_valid: true,
        last_validated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error("[VALIDATE-API-KEY] Upsert error:", upsertError);
      throw new Error("Erro ao salvar a API key");
    }

    // Return success with masked key
    const maskedKey = `...${apiKey.trim().slice(-4)}`;

    return new Response(JSON.stringify({ 
      success: true, 
      message: "API key validada e salva com sucesso!",
      maskedKey,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[VALIDATE-API-KEY] Error:", errorMessage);

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
