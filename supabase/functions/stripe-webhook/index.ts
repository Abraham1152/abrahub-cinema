import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// PRO (10 credits) - Circle intermediate tier
const PRO_PRICE_IDS = [
  "price_1SxssfLkjsnhi7NmA6lozKWE", // PRO mensal Circle R$90
  "price_1SxssfLkjsnhi7NmVsXsSLum", // PRO anual Circle R$1080
  "price_1T0NjwLkjsnhi7Nm5tPY8H6G", // PRO mensal (novo)
];

// PRO+ (100 credits) - Full tier from Circle/Stripe AND independent checkout
const PRO_PLUS_PRICE_IDS = [
  "price_1SrPvRLkjsnhi7Nmg2hHUfzp", // PRO+ anual (Circle)
  "price_1SrPl9Lkjsnhi7NmnkppGUrV", // PRO+ mensal (Circle)
  "price_1SrdgbLkjsnhi7Nm3KkX5EVz", // PRO+ mensal R$220
  "price_1SrdgpLkjsnhi7NmVbUPjIPj", // PRO+ anual R$1790
];

// Comunidade - Community tier
const COMMUNITY_PRICE_IDS = [
  "price_1SrPOpLkjsnhi7Nmn6nCZYeW",
  "price_1SrPtuLkjsnhi7NmaKqqGaCP",
];

// Credit package price IDs (one-off purchases)
const CREDIT_PACKAGE_PRICE_IDS = [
  "price_1Sxs1HLkjsnhi7Nm9ISzvNnw", // 10 credits
  "price_1Sxs1ULkjsnhi7Nm80s9ZVV1", // 30 credits
  "price_1Sxs1gLkjsnhi7Nmex8TTV57", // 50 credits
  "price_1Sxs1rLkjsnhi7NmmYQm8L9z", // 100 credits
];

const PRO_CREDITS = 10;
const PRO_PLUS_CREDITS = 100;
const COMMUNITY_CREDITS = 999999; // Representing unlimited/community access

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Safe date conversion - handles null/undefined Stripe timestamps
const safeDate = (timestamp: number | null | undefined): string | null => {
  if (timestamp === null || timestamp === undefined || !Number.isFinite(timestamp)) {
    return null;
  }
  try {
    return new Date(timestamp * 1000).toISOString();
  } catch {
    return null;
  }
};

// Get current timestamp as ISO string
const nowISO = (): string => new Date().toISOString();

// Get subscription tier: 'proplus' (100 credits), 'pro' (10 credits), 'community' or null (free)
function getSubscriptionTier(subscription: Stripe.Subscription): 'proplus' | 'pro' | 'community' | null {
  // Check PRO+ first (higher tier takes precedence)
  const hasProPlus = subscription.items.data.some((item: Stripe.SubscriptionItem) =>
    PRO_PLUS_PRICE_IDS.includes(item.price.id)
  );
  if (hasProPlus) return 'proplus';
  
  // Check Community
  const hasCommunity = subscription.items.data.some((item: Stripe.SubscriptionItem) =>
    COMMUNITY_PRICE_IDS.includes(item.price.id)
  );
  if (hasCommunity) return 'community';

  // Check PRO (intermediate tier)
  const hasPro = subscription.items.data.some((item: Stripe.SubscriptionItem) =>
    PRO_PRICE_IDS.includes(item.price.id)
  );
  if (hasPro) return 'pro';
  
  return null;
}

// Check if subscription is a paid tier (PRO, PRO+ or Community)
function isPaidSubscription(subscription: Stripe.Subscription): boolean {
  return getSubscriptionTier(subscription) !== null;
}

// Get credits for a tier
function getCreditsForTier(tier: 'proplus' | 'pro' | 'community' | null): number {
  if (tier === 'proplus') return PRO_PLUS_CREDITS;
  if (tier === 'pro') return PRO_CREDITS;
  if (tier === 'community') return COMMUNITY_CREDITS;
  return 0;
}

// Check if subscription is effectively cancelled or downgraded
function isDowngradeOrCancel(subscription: Stripe.Subscription): boolean {
  const cancelStatuses = ["canceled", "unpaid", "incomplete_expired"];
  
  // Check if subscription status indicates cancellation
  if (cancelStatuses.includes(subscription.status)) {
    return true;
  }
  
  // Check if cancel_at_period_end is true
  if (subscription.cancel_at_period_end) {
    return true;
  }
  
  return false;
}

// Resolve plan and status from subscription
function resolvePlanAndStatus(subscription: Stripe.Subscription): {
  plan: "free" | "pro" | "proplus";
  tier: 'proplus' | 'pro' | null;
  status: string;
  priceIds: string[];
  isDowngrading: boolean;
  credits: number;
} {
  const tier = getSubscriptionTier(subscription);
  const isPaid = tier !== null;
  const activeStatuses = ["active", "trialing"];
  const isActive = activeStatuses.includes(subscription.status);
  const priceIds = subscription.items.data.map((item: Stripe.SubscriptionItem) => item.price.id);
  const isDowngrading = isDowngradeOrCancel(subscription);
  const credits = getCreditsForTier(tier);

  // Determine plan: proplus, pro, or free
  // Note: 'community' tier maps to 'proplus' in DB (entitlements_plan_check only allows free/pro/proplus)
  let plan: "free" | "pro" | "proplus" = "free";
  if (isPaid && isActive && !isDowngrading) {
    plan = (tier === "pro") ? "pro" : "proplus";
  }

  return {
    plan,
    tier,
    status: subscription.status,
    priceIds,
    isDowngrading,
    credits,
  };
}

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

// Crypto provider for Deno using Web Crypto API
const cryptoProvider: Stripe.CryptoProvider = {
  async computeHMACSignatureAsync(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  },
  computeHMACSignature(_payload: string, _secret: string): string {
    throw new Error("Sync signature not supported in Deno");
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Diagnostic logging (safe - only prefix of secrets)
  const webhookSecretPrefix = webhookSecret ? webhookSecret.substring(0, 12) + "..." : "NOT SET";
  logStep("ENV check", {
    hasStripeKey: !!stripeSecretKey,
    hasWebhookSecret: !!webhookSecret,
    webhookSecretPrefix,
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
  });

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    logStep("ERROR: Missing environment variables", {
      stripeSecretKey: !!stripeSecretKey,
      webhookSecret: !!webhookSecret,
      supabaseUrl: !!supabaseUrl,
      supabaseServiceKey: !!supabaseServiceKey
    });
    return new Response(JSON.stringify({ 
      error: "Server configuration error", 
      details: "Missing required environment variables" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeSecretKey, { 
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });
  const supabase: AnySupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // CRITICAL: Read raw body FIRST before any parsing
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    // Diagnostic logging
    logStep("Request diagnostics", {
      hasSignatureHeader: !!signature,
      signatureLength: signature?.length || 0,
      rawBodyLength: rawBody.length,
      rawBodyPreview: rawBody.substring(0, 50) + "...",
    });

    if (!signature) {
      logStep("ERROR: Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify webhook signature using async version with custom crypto provider for Deno
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody, 
        signature, 
        webhookSecret,
        undefined,
        cryptoProvider
      );
      logStep("Signature verification SUCCESS");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("ERROR: Webhook signature verification failed", { 
        error: errorMessage,
        signaturePreview: signature.substring(0, 50) + "...",
      });
      return new Response(JSON.stringify({ error: "Invalid signature", detail: errorMessage }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Handle different event types
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(supabase, stripe, subscription, event.type);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, stripe, subscription);
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(supabase, stripe, session);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(supabase, stripe, invoice);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(supabase, stripe, charge);
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeCreated(supabase, stripe, dispute);
        break;
      }
      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logStep("ERROR: Unexpected error", { error: String(error) });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Generate cryptographically secure random password
function generateSecurePassword(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Create user via Supabase Admin API with secure random password
async function createUserWithPassword(
  supabase: AnySupabaseClient,
  email: string,
  stripeCustomerId: string
): Promise<{ userId: string } | null> {
  logStep("Creating new user with secure password for Stripe customer", { email, stripeCustomerId });

  const securePassword = generateSecurePassword();

  // Create user with random password, confirmed email, and flag for password setup
  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: securePassword,
    email_confirm: true,
    user_metadata: {
      created_via: "stripe_webhook",
      stripe_customer_id: stripeCustomerId,
      needs_password_setup: true,
    },
  });

  if (createError) {
    logStep("ERROR: Failed to create user", { error: createError.message });
    return null;
  }

  if (!createData.user) {
    logStep("ERROR: No user returned after creation");
    return null;
  }

  logStep("User created successfully with secure password (needs setup)", { userId: createData.user.id, email });
  return { userId: createData.user.id };
}

// Check idempotency - has credit event already been processed?
async function hasCreditEvent(
  supabase: AnySupabaseClient,
  userId: string,
  stripeSubscriptionId: string,
  type: string
): Promise<boolean> {
  const { data } = await supabase
    .from("credit_events")
    .select("id")
    .eq("user_id", userId)
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .eq("type", type)
    .limit(1)
    .single();

  return !!data;
}

// Record credit event for idempotency
async function recordCreditEvent(
  supabase: AnySupabaseClient,
  userId: string,
  stripeSubscriptionId: string,
  type: string
): Promise<void> {
  const { error } = await supabase.from("credit_events").insert({
    user_id: userId,
    stripe_subscription_id: stripeSubscriptionId,
    type,
  });

  if (error) {
    logStep("ERROR: Failed to record credit event", { error: error.message });
  } else {
    logStep("Credit event recorded", { userId, stripeSubscriptionId, type });
  }
}

// Find user by Stripe customer ID or email, optionally inviting if not found
async function findUserByStripeCustomer(
  supabase: AnySupabaseClient,
  stripe: Stripe,
  stripeCustomerId: string,
  inviteIfNotFound: boolean = false,
  isPro: boolean = false
): Promise<{ userId: string; email: string; wasInvited: boolean } | null> {
  // First try to find by stripe_customer_id in stripe_customers table
  const { data: customerMapping } = await supabase
    .from("stripe_customers")
    .select("user_id, email")
    .eq("stripe_customer_id", stripeCustomerId)
    .single();

  if (customerMapping) {
    logStep("Found user by stripe_customer_id", { userId: customerMapping.user_id });
    return { userId: customerMapping.user_id, email: customerMapping.email, wasInvited: false };
  }

  // Try to find by email from Stripe customer
  const customer = await stripe.customers.retrieve(stripeCustomerId);
  if (customer.deleted || !customer.email) {
    logStep("Customer deleted or no email", { stripeCustomerId });
    return null;
  }

  const email = customer.email;

  // Look up user by email in auth.users via admin API
  // Note: listUsers doesn't support email filter, so we paginate with a reasonable limit
  let existingUser: { id: string; email?: string } | null = null;
  let page = 1;
  const perPage = 100;
  while (!existingUser) {
    const { data: userList } = await supabase.auth.admin.listUsers({ page, perPage });
    const users = userList?.users || [];
    if (users.length === 0) break;
    existingUser = users.find(
      (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase()
    ) || null;
    if (users.length < perPage) break;
    page++;
  }

  if (existingUser) {
    // User exists in auth.users, create mapping
    await supabase.from("stripe_customers").upsert({
      user_id: existingUser.id,
      stripe_customer_id: stripeCustomerId,
      email,
    });
    logStep("Found user in auth.users, created mapping", { userId: existingUser.id });
    return { userId: existingUser.id, email, wasInvited: false };
  }

  // Look up in stripe_customers by email
  const { data: userByEmail } = await supabase
    .from("stripe_customers")
    .select("user_id")
    .ilike("email", email)
    .single();

  if (userByEmail) {
    logStep("Found user by email in stripe_customers", { userId: userByEmail.user_id });
    return { userId: userByEmail.user_id, email, wasInvited: false };
  }

  // User not found - should we create?
  if (inviteIfNotFound && isPro) {
    logStep("User not found, creating new user for PRO subscription", { email });
    const created = await createUserWithPassword(supabase, email, stripeCustomerId);
    if (created) {
      // Create stripe_customers mapping
      await supabase.from("stripe_customers").upsert({
        user_id: created.userId,
        stripe_customer_id: stripeCustomerId,
        email,
      });
      return { userId: created.userId, email, wasInvited: true };
    }
  }

  // User not found
  logStep("User not found", { stripeCustomerId, email });
  return null;
}

// Get current entitlements for a user
async function getCurrentEntitlements(
  supabase: AnySupabaseClient,
  userId: string
): Promise<{ plan: string; status: string; downgraded_at?: string } | null> {
  const { data } = await supabase
    .from("entitlements")
    .select("plan, status, downgraded_at")
    .eq("user_id", userId)
    .single();

  return data;
}

// Handle tier downgrade between paid plans (PRO+ → PRO)
// This reduces credits IMMEDIATELY when user switches to lower tier
async function handleTierDowngrade(
  supabase: AnySupabaseClient,
  userId: string,
  previousTier: 'proplus' | 'pro' | null,
  newTier: 'proplus' | 'pro' | null,
  subscriptionId: string
): Promise<boolean> {
  // Only process downgrade from higher to lower paid tier
  if (previousTier === 'proplus' && newTier === 'pro') {
    const maxCredits = PRO_CREDITS; // 10
    
    // Get current balance
    const { data: wallet } = await supabase
      .from("credit_wallet")
      .select("credits_balance")
      .eq("user_id", userId)
      .single();
    
    const currentBalance = wallet?.credits_balance || 0;
    const newBalance = Math.min(currentBalance, maxCredits);
    
    // Check idempotency - prevent double processing
    const alreadyProcessed = await hasCreditEvent(
      supabase,
      userId,
      subscriptionId,
      "tier_downgrade_proplus_to_pro"
    );
    
    if (alreadyProcessed) {
      logStep("TIER DOWNGRADE already processed (idempotent)", {
        userId,
        subscriptionId,
      });
      return false;
    }
    
    // Update credits to new tier limit
    await supabase.from("credit_wallet").update({
      credits_balance: newBalance,
      monthly_allowance: maxCredits,
      updated_at: nowISO(),
    }).eq("user_id", userId);
    
    // Also update user_credits for backward compatibility
    await supabase.from("user_credits").update({
      available: newBalance,
      updated_at: nowISO(),
    }).eq("user_id", userId);
    
    // Record credit event for idempotency
    await recordCreditEvent(supabase, userId, subscriptionId, "tier_downgrade_proplus_to_pro");
    
    logStep("TIER DOWNGRADE: PRO+ to PRO - Credits reduced immediately", {
      userId,
      previousBalance: currentBalance,
      newBalance,
      maxCredits,
    });
    
    return true;
  }
  
  return false;
}

// Helper to sync authorized users for exclusive access
async function syncAuthorizedUser(
  supabase: AnySupabaseClient,
  email: string,
  stripeCustomerId: string,
  status: 'active' | 'inactive'
) {
  logStep("Syncing authorized user", { email, status });
  const { error } = await supabase.from("authorized_users").upsert({
    email: email.toLowerCase(),
    stripe_customer_id: stripeCustomerId,
    status: status,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'email' });

  if (error) {
    logStep("ERROR: Failed to sync authorized user", { error: error.message });
  }
}

// Handle subscription created/updated
async function handleSubscriptionChange(
  supabase: AnySupabaseClient,
  stripe: Stripe,
  subscription: Stripe.Subscription,
  eventType: string
) {
  const stripeCustomerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;

  const { plan, tier, status, priceIds, isDowngrading, credits } = resolvePlanAndStatus(subscription);
  const isPaid = tier !== null; // PRO or PRO+
  const currentPeriodEnd = safeDate(subscription.current_period_end);
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;
  
  // Sync with authorized_users table
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  let customerEmail = (subscription as any).customer_email || "";
  
  logStep("Attempting to sync authorized user", { customerId, initialEmail: customerEmail });

  try {
    if (!customerEmail) {
      logStep("Fetching customer from Stripe API...", { customerId });
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted && customer.email) {
        customerEmail = customer.email;
        logStep("Customer email retrieved successfully", { customerEmail });
      } else {
        logStep("Customer found but has no email or is deleted", { deleted: (customer as any).deleted });
      }
    }
  } catch (err) {
    logStep("ERROR: Stripe API retrieve failed. Check your STRIPE_SECRET_KEY.", { error: err instanceof Error ? err.message : String(err) });
  }

  if (customerEmail) {
    const isAuthorizedStatus = ['active', 'trialing', 'incomplete'].includes(status);
    const authStatus = isAuthorizedStatus && !isDowngrading ? 'active' : 'inactive';
    
    logStep("FINAL STEP: Upserting to authorized_users", { customerEmail, authStatus });
    await syncAuthorizedUser(supabase, customerEmail, customerId, authStatus);
  } else {
    logStep("SKIPPING Whitelist Sync: No email found for customer.");
  }

  logStep("Processing subscription change", {
    subscriptionId: subscription.id,
    customerId: stripeCustomerId,
    status,
    plan,
    tier,
    credits,
    priceIds,
    cancelAtPeriodEnd,
    isDowngrading,
    eventType,
  });

  // Try to find user, and invite if not found and is paid subscription (and not downgrading)
  const user = await findUserByStripeCustomer(supabase, stripe, stripeCustomerId, true, isPaid && !isDowngrading);

  if (user) {
    // Get previous entitlements to detect upgrade/downgrade (skip if user was just invited)
    let wasPaidBefore = false;
    let alreadyDowngraded = false;
    let previousTier: 'proplus' | 'pro' | null = null;
    
    if (!user.wasInvited) {
      const previousEntitlements = await getCurrentEntitlements(supabase, user.userId);
      wasPaidBefore = (previousEntitlements?.plan === "pro" || previousEntitlements?.plan === "proplus") && 
        ["active", "trialing"].includes(previousEntitlements?.status || "");
      // Check if already downgraded to prevent duplicate processing
      alreadyDowngraded = !!previousEntitlements?.downgraded_at;
      // Track previous tier for tier-to-tier downgrade detection
      if (previousEntitlements?.plan === "proplus") previousTier = "proplus";
      else if (previousEntitlements?.plan === "pro") previousTier = "pro";
    }
    const isPaidNow = plan === "pro" || plan === "proplus";

    // TIER-TO-TIER DOWNGRADE: PRO+ → PRO (both still paid, but lower tier)
    // This happens IMMEDIATELY - no grace period for paid tier downgrades
    if (previousTier && tier && previousTier !== tier && isPaidNow && !alreadyDowngraded) {
      const tierDowngraded = await handleTierDowngrade(
        supabase,
        user.userId,
        previousTier,
        tier,
        subscription.id
      );
      
      if (tierDowngraded) {
        // Update entitlements with new tier
        // Map to DB-safe values (entitlements_plan_check: free/pro/proplus)
        const downgradedPlan: "pro" | "proplus" = tier === "pro" ? "pro" : "proplus";
        await supabase.from("entitlements").upsert({
          user_id: user.userId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: subscription.id,
          plan: downgradedPlan,
          status: "active",
          current_period_end: currentPeriodEnd,
          updated_at: nowISO(),
        });

        // Update subscriptions table for backward compatibility
        await supabase.from("subscriptions").upsert({
          user_id: user.userId,
          plan: downgradedPlan,
          status: "active",
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: subscription.id,
          current_period_end: currentPeriodEnd,
          updated_at: nowISO(),
        });
        
        logStep("TIER DOWNGRADE completed - Entitlements updated", {
          userId: user.userId,
          previousTier,
          newTier: tier,
        });
        
        return; // Exit early for tier downgrade
      }
    }

    // PRICE CHANGE DOWNGRADE: If was paid in DB but now switched to free price
    // This happens when user downgrades via subscription schedule (price change)
    const isPriceDowngrade = wasPaidBefore && !isPaidNow && !isDowngrading && !alreadyDowngraded;
    
    if (isPriceDowngrade) {
      logStep("PRICE DOWNGRADE DETECTED: User switched from paid price to non-paid price", {
        userId: user.userId,
        wasPaidBefore,
        isPaidNow,
        priceIds,
      });
    }

    // GRACEFUL DOWNGRADE: If was paid and now downgrading (cancel_at_period_end, status change, OR price change)
    if ((wasPaidBefore && isDowngrading && !alreadyDowngraded) || isPriceDowngrade) {
      logStep("GRACEFUL DOWNGRADE: Preserving credits until period end", {
        userId: user.userId,
        graceUntil: currentPeriodEnd,
      });

      // Check idempotency for downgrade
      const alreadyRecordedDowngrade = await hasCreditEvent(
        supabase, 
        user.userId, 
        subscription.id, 
        "graceful_downgrade"
      );

      if (!alreadyRecordedDowngrade) {
        // Update entitlements: KEEP current plan during grace period, set grace_until = period_end
        // Plan will transition to 'free' when cleanup-expired-credits runs after grace_until
        // Map to DB-safe values only (entitlements_plan_check: free/pro/proplus)
        const gracePlan: "free" | "pro" | "proplus" =
          (previousTier === "pro" || (!previousTier && tier === "pro")) ? "pro" : "proplus";
        const { error: entError } = await supabase.from("entitlements").upsert({
          user_id: user.userId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: subscription.id,
          plan: gracePlan,
          status: "active",
          current_period_end: currentPeriodEnd,
          grace_until: currentPeriodEnd,
          downgraded_at: nowISO(),
          updated_at: nowISO(),
        });

        if (entError) {
          logStep("ERROR: Failed to upsert entitlements", { error: entError.message });
          throw entError;
        }

        // Update credit_wallet: PRESERVE credits_balance, set monthly_allowance = 0
        await supabase.from("credit_wallet").update({
          monthly_allowance: 0,
          updated_at: nowISO(),
        }).eq("user_id", user.userId);

        // Update subscriptions table for backward compatibility (keep paid plan during grace)
        await supabase.from("subscriptions").upsert({
          user_id: user.userId,
          plan: gracePlan,
          status: "active",
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: subscription.id,
          current_period_end: currentPeriodEnd,
          updated_at: nowISO(),
        });

        // Record credit event for idempotency
        await recordCreditEvent(supabase, user.userId, subscription.id, "graceful_downgrade");

        logStep("Graceful downgrade processed", {
          userId: user.userId,
          email: user.email,
          graceUntil: currentPeriodEnd,
        });
      } else {
        logStep("Graceful downgrade already processed (idempotent)", { 
          userId: user.userId, 
          subscriptionId: subscription.id 
        });
      }

      // Also update stripe_customers mapping
      await supabase.from("stripe_customers").upsert({
        user_id: user.userId,
        stripe_customer_id: stripeCustomerId,
        email: user.email,
      });

      return; // Exit early for graceful downgrade
    }

    // Normal flow (not downgrading)
    // Map Stripe status to entitlements internal status (entitlements_status_check only allows active/inactive/trialing)
    const entitlementsStatus: "active" | "inactive" | "trialing" =
      status === "trialing" ? "trialing"
      : ["active"].includes(status) ? "active"
      : "inactive";

    // Upsert entitlements
    const { error: entError } = await supabase.from("entitlements").upsert({
      user_id: user.userId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      plan,
      status: entitlementsStatus,
      current_period_end: currentPeriodEnd,
      // Clear grace fields if reactivating paid subscription
      grace_until: isPaidNow ? null : undefined,
      downgraded_at: isPaidNow ? null : undefined,
      updated_at: nowISO(),
    });

    if (entError) {
      logStep("ERROR: Failed to upsert entitlements", { error: entError.message });
      throw entError;
    }

    // Handle credit changes - use tier-specific credits
    const monthlyAllowance = isPaidNow ? credits : 0;

    if (isPaidNow && (user.wasInvited || !wasPaidBefore)) {
      // NEW USER (invited) or UPGRADE: Check idempotency then give credits based on tier
      const alreadyGranted = await hasCreditEvent(
        supabase, 
        user.userId, 
        subscription.id, 
        "pro_activation"
      );

      if (!alreadyGranted) {
        logStep("Subscription activation: Granting credits", { 
          userId: user.userId, 
          wasInvited: user.wasInvited,
          tier,
          credits,
        });

        await supabase.from("credit_wallet").upsert({
          user_id: user.userId,
          credits_balance: credits,
          monthly_allowance: monthlyAllowance,
          last_refill_at: nowISO(),
          updated_at: nowISO(),
        });

        // Record credit event for idempotency
        await recordCreditEvent(supabase, user.userId, subscription.id, "pro_activation");

        // Also update user_credits for backward compatibility
        await supabase.from("user_credits").upsert({
          user_id: user.userId,
          available: credits,
          used: 0,
          updated_at: nowISO(),
        });
      } else {
        logStep("Subscription activation already granted (idempotent)", {
          userId: user.userId,
          subscriptionId: subscription.id
        });
      }
    } else {
      // Just update monthly_allowance (no credit change)
      await supabase.from("credit_wallet").upsert({
        user_id: user.userId,
        monthly_allowance: monthlyAllowance,
        updated_at: nowISO(),
      }, { onConflict: "user_id", ignoreDuplicates: false });
    }

    // Always sync monthly_allowance for active paid plans (fixes idempotency gap where
    // alreadyGranted=true skips the full upsert, leaving monthly_allowance at 0)
    if (isPaidNow) {
      await supabase.from("credit_wallet").update({
        monthly_allowance: credits,
        updated_at: nowISO(),
      }).eq("user_id", user.userId);
      logStep("monthly_allowance synced", { userId: user.userId, credits });
    }

    // Also update stripe_customers mapping
    await supabase.from("stripe_customers").upsert({
      user_id: user.userId,
      stripe_customer_id: stripeCustomerId,
      email: user.email,
    });

    // Update subscriptions table for backward compatibility
    await supabase.from("subscriptions").upsert({
      user_id: user.userId,
      plan,
      status: status as "active" | "past_due" | "canceled" | "trialing" | "incomplete",
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      current_period_end: currentPeriodEnd,
      updated_at: nowISO(),
    });

    // If user was just invited, also create a pending_entitlement as fallback
    // (in case they need to claim on first login)
    if (user.wasInvited && isPaid) {
      await supabase.from("pending_entitlements").upsert({
        email: user.email,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        plan,
        status,
        credits_to_grant: credits,
        updated_at: nowISO(),
      });
      logStep("Created pending_entitlement as fallback for invited user", { email: user.email });
    }

    logStep("Subscription change processed", {
      userId: user.userId,
      email: user.email,
      plan,
      tier,
      credits,
      status,
      action: user.wasInvited ? "invited" : (wasPaidBefore !== isPaidNow ? (isPaidNow ? "enabled" : "disabled") : "updated"),
    });
  } else {
    // User invitation failed or not paid - save to pending_entitlements
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    if (customer.deleted || !customer.email) {
      logStep("Cannot create pending: no email", { stripeCustomerId });
      return;
    }

    // Use tier-specific credits or 0 for free
    const creditsToGrant = credits;

    await supabase.from("pending_entitlements").upsert({
      email: customer.email,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      plan,
      status,
      credits_to_grant: creditsToGrant,
      updated_at: nowISO(),
    });

    logStep("Created pending entitlement (user not found/created)", {
      email: customer.email,
      plan,
      status,
      creditsToGrant,
    });
  }
}

// Handle subscription deleted (final deletion after grace period)
async function handleSubscriptionDeleted(
  supabase: AnySupabaseClient,
  stripe: Stripe,
  subscription: Stripe.Subscription
) {
  const stripeCustomerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;

  const currentPeriodEnd = safeDate(subscription.current_period_end);

  logStep("Processing subscription deletion", {
    subscriptionId: subscription.id,
    customerId: stripeCustomerId,
    currentPeriodEnd,
  });

  const user = await findUserByStripeCustomer(supabase, stripe, stripeCustomerId, false, false);

  if (user) {
    // Set to free with grace period (preserve credits until period end)
    await supabase.from("entitlements").upsert({
      user_id: user.userId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      plan: "free",
      status: "active",
      grace_until: currentPeriodEnd,
      downgraded_at: nowISO(),
      updated_at: nowISO(),
    });

    // PRESERVE credits, just set monthly_allowance = 0
    await supabase.from("credit_wallet").update({
      monthly_allowance: 0,
      updated_at: nowISO(),
    }).eq("user_id", user.userId);

    await supabase.from("subscriptions").upsert({
      user_id: user.userId,
      plan: "free",
      status: "canceled",
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      updated_at: nowISO(),
    });

    logStep("Subscription deleted: graceful downgrade applied", { 
      userId: user.userId, 
      email: user.email,
      graceUntil: currentPeriodEnd,
    });
  } else {
    // Update pending entitlements if exists
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    if (!customer.deleted && customer.email) {
      await supabase.from("pending_entitlements").upsert({
        email: customer.email,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        plan: "free",
        status: "canceled",
        credits_to_grant: 0,
        updated_at: nowISO(),
      });

      logStep("Updated pending entitlement to disabled", { email: customer.email });
    }
  }
}

// Handle checkout.session.completed - one-off credit purchases
async function handleCheckoutSessionCompleted(
  supabase: AnySupabaseClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  // Only process payment mode (one-off purchases)
  if (session.mode !== "payment") {
    logStep("Skipping non-payment checkout session", { mode: session.mode });
    return;
  }

  const metadata = session.metadata || {};
  
  // Check if this is a credit purchase
  if (metadata.type !== "credit_purchase") {
    logStep("Skipping non-credit-purchase checkout", { metadata });
    return;
  }

  const userId = metadata.user_id;
  const packageId = metadata.package_id;
  const credits = parseInt(metadata.credits || "0", 10);

  if (!userId || !packageId || credits <= 0) {
    logStep("Invalid credit purchase metadata", { userId, packageId, credits });
    return;
  }

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;

  logStep("Processing credit purchase", {
    sessionId: session.id,
    userId,
    packageId,
    credits,
    paymentIntentId,
  });

  // Check idempotency - don't process same session twice
  const { data: existingPurchase } = await supabase
    .from("credit_purchases")
    .select("id, status")
    .eq("stripe_checkout_session_id", session.id)
    .single();

  if (existingPurchase?.status === "completed") {
    logStep("Credit purchase already processed (idempotent)", { sessionId: session.id });
    return;
  }

  // Update credit_purchases record
  const { error: purchaseError } = await supabase
    .from("credit_purchases")
    .update({
      stripe_payment_intent_id: paymentIntentId,
      status: "completed",
      updated_at: nowISO(),
    })
    .eq("stripe_checkout_session_id", session.id);

  if (purchaseError) {
    logStep("WARNING: Failed to update credit_purchases", { error: purchaseError.message });
  }

  // Get current credit balance
  const { data: wallet } = await supabase
    .from("credit_wallet")
    .select("credits_balance")
    .eq("user_id", userId)
    .single();

  const currentBalance = wallet?.credits_balance || 0;
  const newBalance = currentBalance + credits;

  // Add credits to wallet
  const { error: walletError } = await supabase.from("credit_wallet").upsert({
    user_id: userId,
    credits_balance: newBalance,
    updated_at: nowISO(),
  });

  if (walletError) {
    logStep("ERROR: Failed to add credits to wallet", { error: walletError.message });
    throw walletError;
  }

  // Also update user_credits for backward compatibility
  const { data: userCredits } = await supabase
    .from("user_credits")
    .select("available")
    .eq("user_id", userId)
    .single();

  const currentUserCredits = userCredits?.available || 0;

  await supabase.from("user_credits").upsert({
    user_id: userId,
    available: currentUserCredits + credits,
    updated_at: nowISO(),
  });

  // Record in credit_ledger
  await supabase.from("credit_ledger").insert({
    user_id: userId,
    amount: credits,
    balance_after: newBalance,
    action: "credit_purchase",
    description: `Compra de ${credits} créditos (${packageId})`,
    reference_id: session.id,
    reference_type: "checkout_session",
  });

  logStep("Credit purchase completed", {
    userId,
    packageId,
    creditsAdded: credits,
    previousBalance: currentBalance,
    newBalance,
    sessionId: session.id,
  });
}

// Handle invoice.paid - monthly credit refill
async function handleInvoicePaid(
  supabase: AnySupabaseClient,
  stripe: Stripe,
  invoice: Stripe.Invoice
) {
  // Only process subscription invoices
  if (!invoice.subscription) {
    logStep("Skipping non-subscription invoice", { invoiceId: invoice.id });
    return;
  }

  const stripeCustomerId = typeof invoice.customer === "string"
    ? invoice.customer
    : invoice.customer?.id;

  if (!stripeCustomerId) {
    logStep("No customer ID on invoice", { invoiceId: invoice.id });
    return;
  }

  logStep("Processing invoice.paid", {
    invoiceId: invoice.id,
    subscriptionId: invoice.subscription,
    customerId: stripeCustomerId,
  });

  const user = await findUserByStripeCustomer(supabase, stripe, stripeCustomerId, false, false);

  if (!user) {
    logStep("User not found for invoice", { stripeCustomerId });
    return;
  }

  // Check entitlements
  const { data: entitlements } = await supabase
    .from("entitlements")
    .select("plan, status, stripe_subscription_id")
    .eq("user_id", user.userId)
    .single();

  if (!entitlements) {
    logStep("No entitlements found", { userId: user.userId });
    return;
  }

  // Verify subscription matches and user has a paid plan (pro or proplus)
  const subscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription;

  if (entitlements.stripe_subscription_id !== subscriptionId) {
    logStep("Subscription mismatch", {
      expected: entitlements.stripe_subscription_id,
      actual: subscriptionId,
    });
    return;
  }

  // Check if user has a paid plan (pro or proplus)
  const isPaidPlan = entitlements.plan === "pro" || entitlements.plan === "proplus";
  if (!isPaidPlan || !["active", "trialing"].includes(entitlements.status)) {
    logStep("User not on paid plan active, skipping refill", {
      plan: entitlements.plan,
      status: entitlements.status,
    });
    return;
  }

  // Check idempotency + get monthly_allowance (source of truth for community vs proplus)
  const { data: wallet } = await supabase
    .from("credit_wallet")
    .select("last_refill_invoice_id, monthly_allowance")
    .eq("user_id", user.userId)
    .single();

  // Use monthly_allowance as refill amount — it correctly reflects 999999 for community
  // and 10/100 for pro/proplus. Fall back to plan-based if not set.
  const planBasedCredits = entitlements.plan === "proplus" ? PRO_PLUS_CREDITS : PRO_CREDITS;
  const refillCredits = (wallet?.monthly_allowance && wallet.monthly_allowance > 0)
    ? wallet.monthly_allowance
    : planBasedCredits;

  if (wallet?.last_refill_invoice_id === invoice.id) {
    logStep("Already refilled for this invoice (idempotent)", { invoiceId: invoice.id });
    return;
  }

  // Refill credits based on tier
  const { error } = await supabase.from("credit_wallet").upsert({
    user_id: user.userId,
    credits_balance: refillCredits,
    monthly_allowance: refillCredits,
    last_refill_invoice_id: invoice.id,
    last_refill_at: nowISO(),
    updated_at: nowISO(),
  });

  if (error) {
    logStep("ERROR: Failed to refill credits", { error: error.message });
    throw error;
  }

  // Also update user_credits for backward compatibility
  await supabase.from("user_credits").upsert({
    user_id: user.userId,
    available: refillCredits,
    updated_at: nowISO(),
  });

  logStep("Credits refilled via invoice", {
    userId: user.userId,
    email: user.email,
    plan: entitlements.plan,
    credits: refillCredits,
    invoiceId: invoice.id,
    action: "refill",
  });
}

// Handle charge.refunded - ZERO credits, BLOCK if credit purchase
async function handleChargeRefunded(
  supabase: AnySupabaseClient,
  stripe: Stripe,
  charge: Stripe.Charge
) {
  const stripeCustomerId = typeof charge.customer === "string"
    ? charge.customer
    : charge.customer?.id;

  if (!stripeCustomerId) {
    logStep("No customer ID on refunded charge", { chargeId: charge.id });
    return;
  }

  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id;

  logStep("Processing charge.refunded", {
    chargeId: charge.id,
    paymentIntentId,
    customerId: stripeCustomerId,
    amountRefunded: charge.amount_refunded,
    amountTotal: charge.amount,
  });

  const user = await findUserByStripeCustomer(supabase, stripe, stripeCustomerId, false, false);

  if (!user) {
    logStep("User not found for refund", { stripeCustomerId });
    return;
  }

  // Check idempotency - don't process same refund twice
  const alreadyProcessed = await hasCreditEvent(
    supabase, 
    user.userId, 
    charge.id, 
    "refund_processed"
  );

  if (alreadyProcessed) {
    logStep("Refund already processed (idempotent)", { chargeId: charge.id });
    return;
  }

  // Check if this refund is for a credit purchase (one-off) - BLOCK ACCOUNT
  const { data: creditPurchase } = await supabase
    .from("credit_purchases")
    .select("id, credits_purchased")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .single();

  const isCreditPurchaseRefund = !!creditPurchase;

  if (isCreditPurchaseRefund) {
    logStep("CREDIT PURCHASE REFUND DETECTED - BLOCKING ACCOUNT", {
      userId: user.userId,
      creditsPurchased: creditPurchase.credits_purchased,
      chargeId: charge.id,
    });

    // BLOCK ACCOUNT for credit purchase refunds
    await supabase.from("entitlements").upsert({
      user_id: user.userId,
      plan: "free",
      status: "inactive",
      is_blocked: true,
      blocked_reason: "Reembolso de créditos avulsos",
      blocked_at: nowISO(),
      grace_until: null,
      downgraded_at: nowISO(),
      updated_at: nowISO(),
    });

    // Update credit purchase status
    await supabase.from("credit_purchases").update({
      status: "refunded",
      updated_at: nowISO(),
    }).eq("id", creditPurchase.id);
  } else {
    // Normal subscription refund - just revoke access, no block
    await supabase.from("entitlements").upsert({
      user_id: user.userId,
      plan: "free",
      status: "inactive",
      grace_until: null,
      downgraded_at: nowISO(),
      updated_at: nowISO(),
    });
  }

  // ZERO credits immediately
  const { error: walletError } = await supabase.from("credit_wallet").update({
    credits_balance: 0,
    monthly_allowance: 0,
    updated_at: nowISO(),
  }).eq("user_id", user.userId);

  if (walletError) {
    logStep("ERROR: Failed to zero credit_wallet", { error: walletError.message });
  }

  // Record event for idempotency
  await recordCreditEvent(supabase, user.userId, charge.id, "refund_processed");

  // Also zero user_credits for backward compatibility
  await supabase.from("user_credits").update({
    available: 0,
    updated_at: nowISO(),
  }).eq("user_id", user.userId);

  // Update subscriptions table
  await supabase.from("subscriptions").upsert({
    user_id: user.userId,
    plan: "free",
    status: "canceled",
    updated_at: nowISO(),
  });

  logStep("REFUND PROCESSED", {
    userId: user.userId,
    email: user.email,
    chargeId: charge.id,
    amountRefunded: charge.amount_refunded,
    isCreditPurchase: isCreditPurchaseRefund,
    accountBlocked: isCreditPurchaseRefund,
  });
}

// Handle charge.dispute.created - ZERO credits, BLOCK if credit purchase
async function handleDisputeCreated(
  supabase: AnySupabaseClient,
  stripe: Stripe,
  dispute: Stripe.Dispute
) {
  const chargeId = typeof dispute.charge === "string" 
    ? dispute.charge 
    : dispute.charge?.id;

  if (!chargeId) {
    logStep("No charge ID on dispute", { disputeId: dispute.id });
    return;
  }

  logStep("Processing charge.dispute.created", {
    disputeId: dispute.id,
    chargeId,
    amount: dispute.amount,
    reason: dispute.reason,
  });

  // Get customer and payment_intent from charge
  let stripeCustomerId: string | null = null;
  let paymentIntentId: string | null = null;
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    stripeCustomerId = typeof charge.customer === "string"
      ? charge.customer
      : charge.customer?.id || null;
    paymentIntentId = typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id || null;
  } catch (err) {
    logStep("ERROR: Failed to retrieve charge for dispute", { 
      chargeId, 
      error: err instanceof Error ? err.message : String(err) 
    });
    return;
  }

  if (!stripeCustomerId) {
    logStep("No customer ID on disputed charge", { chargeId });
    return;
  }

  const user = await findUserByStripeCustomer(supabase, stripe, stripeCustomerId, false, false);

  if (!user) {
    logStep("User not found for dispute", { stripeCustomerId });
    return;
  }

  // Check idempotency
  const alreadyProcessed = await hasCreditEvent(
    supabase, 
    user.userId, 
    dispute.id, 
    "dispute_processed"
  );

  if (alreadyProcessed) {
    logStep("Dispute already processed (idempotent)", { disputeId: dispute.id });
    return;
  }

  // Check if this dispute is for a credit purchase (one-off) - BLOCK ACCOUNT
  const { data: creditPurchase } = await supabase
    .from("credit_purchases")
    .select("id, credits_purchased")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .single();

  const isCreditPurchaseDispute = !!creditPurchase;

  if (isCreditPurchaseDispute) {
    logStep("CREDIT PURCHASE DISPUTE DETECTED - BLOCKING ACCOUNT", {
      userId: user.userId,
      creditsPurchased: creditPurchase.credits_purchased,
      disputeId: dispute.id,
    });

    // BLOCK ACCOUNT for credit purchase disputes (chargebacks)
    await supabase.from("entitlements").upsert({
      user_id: user.userId,
      plan: "free",
      status: "inactive",
      is_blocked: true,
      blocked_reason: "Chargeback de créditos avulsos",
      blocked_at: nowISO(),
      grace_until: null,
      downgraded_at: nowISO(),
      updated_at: nowISO(),
    });

    // Update credit purchase status
    await supabase.from("credit_purchases").update({
      status: "disputed",
      updated_at: nowISO(),
    }).eq("id", creditPurchase.id);
  } else {
    // Normal subscription dispute - just revoke access, no block
    await supabase.from("entitlements").upsert({
      user_id: user.userId,
      plan: "free",
      status: "inactive",
      grace_until: null,
      downgraded_at: nowISO(),
      updated_at: nowISO(),
    });
  }

  // ZERO credits immediately
  const { error: walletError } = await supabase.from("credit_wallet").update({
    credits_balance: 0,
    monthly_allowance: 0,
    updated_at: nowISO(),
  }).eq("user_id", user.userId);

  if (walletError) {
    logStep("ERROR: Failed to zero credit_wallet", { error: walletError.message });
  }

  // Record event for idempotency
  await recordCreditEvent(supabase, user.userId, dispute.id, "dispute_processed");

  // Also zero user_credits for backward compatibility
  await supabase.from("user_credits").update({
    available: 0,
    updated_at: nowISO(),
  }).eq("user_id", user.userId);

  // Update subscriptions table
  await supabase.from("subscriptions").upsert({
    user_id: user.userId,
    plan: "free",
    status: "canceled",
    updated_at: nowISO(),
  });

  logStep("DISPUTE PROCESSED", {
    userId: user.userId,
    email: user.email,
    disputeId: dispute.id,
    reason: dispute.reason,
    isCreditPurchase: isCreditPurchaseDispute,
    accountBlocked: isCreditPurchaseDispute,
  });
}
