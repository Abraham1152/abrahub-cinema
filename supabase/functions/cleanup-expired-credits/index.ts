import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CLEANUP-EXPIRED-CREDITS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    logStep("ERROR: Missing environment variables");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // deno-lint-ignore no-explicit-any
  const supabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    logStep("Starting expired credits cleanup");

    const now = new Date().toISOString();

    // Find users with expired grace period
    // grace_until is set AND grace_until < now AND credits_balance > 0
    const { data: expiredUsers, error: fetchError } = await supabase
      .from("entitlements")
      .select("user_id, grace_until, downgraded_at")
      .not("grace_until", "is", null)
      .lt("grace_until", now);

    if (fetchError) {
      logStep("ERROR: Failed to fetch expired entitlements", { error: fetchError.message });
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      logStep("No users with expired grace period found");
      return new Response(JSON.stringify({ processed: 0, cleaned: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Found users with expired grace period", { count: expiredUsers.length });

    let cleaned = 0;
    const errors: string[] = [];

    for (const ent of expiredUsers) {
      try {
        // Check if user still has credits to clean
        const { data: wallet, error: walletError } = await supabase
          .from("credit_wallet")
          .select("credits_balance")
          .eq("user_id", ent.user_id)
          .single();

        if (walletError && walletError.code !== "PGRST116") {
          logStep("ERROR: Failed to fetch wallet", { userId: ent.user_id, error: walletError.message });
          errors.push(`${ent.user_id}: ${walletError.message}`);
          continue;
        }

        // Skip if already zeroed
        if (!wallet || wallet.credits_balance === 0) {
          logStep("User already has zero credits, skipping", { userId: ent.user_id });
          continue;
        }

        // Zero out credits
        const { error: updateWalletError } = await supabase
          .from("credit_wallet")
          .update({
            credits_balance: 0,
            updated_at: now,
          })
          .eq("user_id", ent.user_id);

        if (updateWalletError) {
          logStep("ERROR: Failed to zero wallet", { userId: ent.user_id, error: updateWalletError.message });
          errors.push(`${ent.user_id}: ${updateWalletError.message}`);
          continue;
        }

        // Also zero user_credits for backward compatibility
        await supabase
          .from("user_credits")
          .update({
            available: 0,
            updated_at: now,
          })
          .eq("user_id", ent.user_id);

        // Transition plan to 'free' and clear grace_until to prevent re-processing
        await supabase
          .from("entitlements")
          .update({
            plan: "free",
            grace_until: null,
            updated_at: now,
          })
          .eq("user_id", ent.user_id);

        // Also update subscriptions table for backward compatibility
        await supabase
          .from("subscriptions")
          .update({
            plan: "free",
            updated_at: now,
          })
          .eq("user_id", ent.user_id);

        logStep("User credits zeroed after grace period expired", {
          userId: ent.user_id,
          previousBalance: wallet.credits_balance,
          graceUntil: ent.grace_until,
        });

        cleaned++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logStep("ERROR: Unexpected error for user", { userId: ent.user_id, error: errorMsg });
        errors.push(`${ent.user_id}: ${errorMsg}`);
      }
    }

    logStep("Expired credits cleanup complete", {
      processed: expiredUsers.length,
      cleaned,
      errors: errors.length,
    });

    return new Response(JSON.stringify({
      processed: expiredUsers.length,
      cleaned,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logStep("ERROR: Unexpected error", { error: errorMsg });
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
