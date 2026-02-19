import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ABRAhub Realism Stripe plan configuration
// PRO (10 credits) - Circle intermediate tier
// PRO+ (100 credits) - Full tier from Circle/Stripe AND independent checkout
const STRIPE_PLANS = {
  pro: {
    price_ids: [
      "price_1SxssfLkjsnhi7NmA6lozKWE", // PRO mensal Circle R$90
      "price_1SxssfLkjsnhi7NmVsXsSLum", // PRO anual Circle R$1080
      "price_1T0NjwLkjsnhi7Nm5tPY8H6G", // PRO mensal (novo)
    ],
    credits: 10,
  },
  proplus: {
    price_ids: [
      "price_1SrPvRLkjsnhi7Nmg2hHUfzp", // PRO+ anual (Circle)
      "price_1SrPl9Lkjsnhi7NmnkppGUrV", // PRO+ mensal (Circle)
      "price_1SrdgbLkjsnhi7Nm3KkX5EVz", // PRO+ mensal R$220
      "price_1SrdgpLkjsnhi7NmVbUPjIPj", // PRO+ anual R$1790
    ],
    credits: 100,
  },
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

function getPlanFromPriceId(priceId: string): { name: string; credits: number } | null {
  for (const [planName, plan] of Object.entries(STRIPE_PLANS)) {
    if (plan.price_ids.includes(priceId)) {
      return { name: planName, credits: plan.credits };
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      return new Response(JSON.stringify({ 
        subscribed: false,
        plan: 'free',
        credits: 0,
        subscription_end: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let planName = 'free';
    let credits = 0;
    let subscriptionEnd = null;
    let priceId = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      priceId = subscription.items.data[0].price.id;
      
      logStep("Active subscription found", { subscriptionId: subscription.id, priceId, endDate: subscriptionEnd });
      
      // Determine plan based on price ID (supports PRO 10 credits and PRO+ 100 credits)
      const planInfo = getPlanFromPriceId(priceId);
      if (planInfo) {
        planName = planInfo.name;
        credits = planInfo.credits;
      } else {
        // If price not in our list, still treat as PRO+ (could be Circle or new product)
        planName = 'proplus';
        credits = 100;
        logStep("Price ID not in STRIPE_PLANS, defaulting to PRO+", { priceId });
      }
      
      logStep("Determined plan", { planName, credits });

      // Sync subscription status to database (read-only sync, no credit manipulation)
      const { error: upsertError } = await supabaseClient
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          plan: planName,
          status: 'active',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: subscriptionEnd,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (upsertError) {
        logStep("Error upserting subscription", { error: upsertError.message });
      } else {
        logStep("Subscription synced to database");
      }

      // NOTE: Credit reset is handled by stripe-webhook via invoice.paid event
      // This function only reads current state, does not modify credits
    } else {
      logStep("No active subscription found");
      
      // Update subscription status to canceled if exists
      await supabaseClient
        .from('subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('status', 'active');
    }

    // Get current credits from credit_wallet (primary) or user_credits (legacy)
    let currentBalance = 0;
    
    const { data: walletData } = await supabaseClient
      .from('credit_wallet')
      .select('credits_balance')
      .eq('user_id', user.id)
      .single();

    if (walletData) {
      currentBalance = walletData.credits_balance;
    } else {
      // Fallback to legacy user_credits table
      const { data: legacyCredits } = await supabaseClient
        .from('user_credits')
        .select('available')
        .eq('user_id', user.id)
        .single();
      
      currentBalance = legacyCredits?.available ?? 0;
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      plan: planName,
      credits: currentBalance,
      subscription_end: subscriptionEnd,
      price_id: priceId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
