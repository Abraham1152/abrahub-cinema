import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Credit packages configuration (must match frontend)
const CREDIT_PACKAGES: Record<string, { credits: number; price: number; stripe_price_id: string }> = {
  pack_10: {
    credits: 10,
    price: 3900,
    stripe_price_id: 'price_1Sxs1HLkjsnhi7Nm9ISzvNnw',
  },
  pack_30: {
    credits: 30,
    price: 9900,
    stripe_price_id: 'price_1Sxs1ULkjsnhi7Nm80s9ZVV1',
  },
  pack_50: {
    credits: 50,
    price: 14900,
    stripe_price_id: 'price_1Sxs1gLkjsnhi7Nmex8TTV57',
  },
  pack_100: {
    credits: 100,
    price: 24900,
    stripe_price_id: 'price_1Sxs1rLkjsnhi7NmmYQm8L9z',
  },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CREDITS-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !authData.user) {
      throw new Error("User not authenticated");
    }

    const user = authData.user;
    if (!user.email) throw new Error("User email not available");

    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user is blocked
    const { data: entitlements } = await supabaseAdmin
      .from("entitlements")
      .select("is_blocked, blocked_reason")
      .eq("user_id", user.id)
      .single();

    if (entitlements?.is_blocked) {
      logStep("User is blocked", { reason: entitlements.blocked_reason });
      throw new Error("Sua conta está bloqueada. Entre em contato com o suporte.");
    }

    // Parse request body
    const { packageId } = await req.json();
    if (!packageId || !CREDIT_PACKAGES[packageId]) {
      throw new Error("Invalid package ID");
    }

    const selectedPackage = CREDIT_PACKAGES[packageId];
    logStep("Package selected", { packageId, credits: selectedPackage.credits, price: selectedPackage.price });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    // Create checkout session for one-off payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: selectedPackage.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/dashboard?credits_purchase=success`,
      cancel_url: `${req.headers.get("origin")}/dashboard?credits_purchase=canceled`,
      metadata: {
        user_id: user.id,
        package_id: packageId,
        credits: String(selectedPackage.credits),
        type: "credit_purchase",
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          package_id: packageId,
          credits: String(selectedPackage.credits),
          type: "credit_purchase",
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    // Create pending purchase record
    const { error: purchaseError } = await supabaseAdmin
      .from("credit_purchases")
      .insert({
        user_id: user.id,
        stripe_checkout_session_id: session.id,
        package_id: packageId,
        credits_purchased: selectedPackage.credits,
        amount_paid: selectedPackage.price,
        status: "pending",
      });

    if (purchaseError) {
      logStep("WARNING: Failed to create pending purchase record", { error: purchaseError.message });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
