import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[VERIFY-FIRST-ACCESS] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({
          eligible: false,
          reason: "invalid_input",
          message: "Email inválido.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Checking eligibility", { email });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all users and find by email (case-insensitive)
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      logStep("ERROR: Failed to list users", { error: listError.message });
      return new Response(
        JSON.stringify({
          eligible: false,
          reason: "server_error",
          message: "Erro ao verificar. Tente novamente.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const user = usersData?.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      logStep("User not found", { email });
      return new Response(
        JSON.stringify({
          eligible: false,
          reason: "user_not_found",
          message: "Email não encontrado. Faça seu cadastro para começar.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user was created via webhook and needs password setup
    const createdVia = user.user_metadata?.created_via;
    const needsPasswordSetup = user.user_metadata?.needs_password_setup;

    logStep("User found", {
      userId: user.id,
      createdVia,
      needsPasswordSetup,
    });

    if (createdVia === "stripe_webhook" && needsPasswordSetup === true) {
      logStep("User is eligible for first access", { userId: user.id });
      return new Response(
        JSON.stringify({
          eligible: true,
          message: "Você é membro PRO! Configure sua senha.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User exists but is not a webhook-created user needing setup
    if (createdVia === "stripe_webhook" && needsPasswordSetup === false) {
      logStep("User already set up password", { userId: user.id });
      return new Response(
        JSON.stringify({
          eligible: false,
          reason: "already_setup",
          message: "Sua senha já foi configurada. Use 'Entrar' para acessar.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Regular user (not created via webhook)
    logStep("Regular user", { userId: user.id });
    return new Response(
      JSON.stringify({
        eligible: false,
        reason: "regular_user",
        message: "Esta conta já possui senha. Use 'Entrar' ou 'Esqueci minha senha'.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logStep("ERROR: Unexpected error", { error: String(error) });
    return new Response(
      JSON.stringify({
        eligible: false,
        reason: "server_error",
        message: "Erro inesperado. Tente novamente.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
