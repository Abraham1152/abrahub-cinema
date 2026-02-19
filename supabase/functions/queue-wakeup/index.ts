import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[QUEUE-WAKEUP] ${step}${detailsStr}`);
};

/**
 * Queue Wake-Up Cron Job
 * 
 * Purpose: Ensure the generation queue never gets stuck if the self-invocation chain breaks.
 * 
 * This function runs every 2 minutes (via pg_cron) and checks:
 * 1. Are there items in 'queued' status?
 * 2. Are there any items currently 'processing'?
 * 
 * If there are queued items but nothing is processing, it triggers the processor
 * to prevent orphaned queue items from being stuck forever.
 */
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
    logStep("Wake-up check started");

    // Check for queued items
    const { data: queuedItems, error: queuedError } = await supabase
      .from('generation_queue')
      .select('id, created_at')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(10);

    if (queuedError) throw queuedError;

    const queuedCount = queuedItems?.length || 0;

    // Check for processing items
    const { data: processingItems, error: processingError } = await supabase
      .from('generation_queue')
      .select('id, started_at')
      .eq('status', 'processing');

    if (processingError) throw processingError;

    const processingCount = processingItems?.length || 0;

    logStep("Queue status", { queuedCount, processingCount });

    // If there are queued items but nothing is processing, we have orphaned items
    if (queuedCount > 0 && processingCount === 0) {
      // Check if the oldest queued item has been waiting for more than 1 minute
      const oldestQueued = queuedItems?.[0];
      if (oldestQueued) {
        const waitTime = Date.now() - new Date(oldestQueued.created_at).getTime();
        const waitMinutes = waitTime / 60000;

        logStep("Found orphaned queue items", { 
          oldestItemId: oldestQueued.id,
          waitingMinutes: waitMinutes.toFixed(1)
        });

        // Only wake up if items have been waiting for at least 30 seconds
        // This prevents race conditions with normal processing
        if (waitTime > 30000) {
          logStep("Triggering processor wake-up");

          // Fire-and-forget: trigger the processor
          const processorResponse = await fetch(`${supabaseUrl}/functions/v1/process-generation-queue`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ trigger: 'wakeup-cron' }),
          });

          const responseText = await processorResponse.text();
          logStep("Processor triggered", { 
            status: processorResponse.status,
            response: responseText.substring(0, 200) // Truncate for logging
          });

          return new Response(JSON.stringify({
            action: "woke_up_processor",
            queuedCount,
            processingCount,
            oldestWaitingMinutes: waitMinutes.toFixed(1),
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Also check for rate limit state health
    const { data: rateLimitState } = await supabase
      .from('rate_limit_state')
      .select('requests_today, day_window_start')
      .eq('id', 'gemini_api')
      .single();

    const dailyStats = {
      requestsToday: rateLimitState?.requests_today || 0,
      dayStart: rateLimitState?.day_window_start,
      dailyLimit: 250,
      percentUsed: ((rateLimitState?.requests_today || 0) / 250 * 100).toFixed(1)
    };

    logStep("Daily API usage", dailyStats);

    return new Response(JSON.stringify({
      action: "no_action_needed",
      queuedCount,
      processingCount,
      dailyStats,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Wake-up error", { error: errorMessage });

    return new Response(JSON.stringify({
      error: errorMessage,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
