import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[QUEUE-STATUS] ${step}${detailsStr}`);
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

    // Get queue ID from request
    const url = new URL(req.url);
    const queueId = url.searchParams.get('id');

    if (queueId) {
      // Get specific queue item status
      const { data: queueItem, error } = await supabase
        .from('generation_queue')
        .select('*, result_image_id')
        .eq('id', queueId)
        .eq('user_id', userId)
        .single();

      if (error || !queueItem) {
        return new Response(JSON.stringify({ 
          error: "Item não encontrado",
          code: "NOT_FOUND" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }

      // Get position if still queued
      let position = 0;
      if (queueItem.status === 'queued') {
        const { data: positionData } = await supabase
          .rpc('get_queue_position', { queue_item_id: queueId });
        position = positionData || 0;
      }

      // Get result image if completed
      let resultImage = null;
      if (queueItem.status === 'completed' && queueItem.result_image_id) {
        const { data: imageData } = await supabase
          .from('user_generated_images')
          .select('id, url, prompt, model_label, status')
          .eq('id', queueItem.result_image_id)
          .single();
        resultImage = imageData;
      }

      const estimatedWaitSeconds = queueItem.status === 'queued' 
        ? Math.max(0, (position - 1) * 15) 
        : 0;

      return new Response(JSON.stringify({
        id: queueItem.id,
        status: queueItem.status,
        position,
        estimatedWaitSeconds,
        createdAt: queueItem.created_at,
        startedAt: queueItem.started_at,
        completedAt: queueItem.completed_at,
        errorMessage: queueItem.error_message,
        resultImage,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all user's queue items
    const { data: queueItems, error: fetchError } = await supabase
      .from('generation_queue')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;

    // Get global queue stats
    const { data: statsData } = await supabase.rpc('get_queue_stats');
    const stats = statsData || { 
      queued_count: 0, 
      processing_count: 0,
      completed_today: 0,
      average_wait_seconds: 0,
    };

    return new Response(JSON.stringify({
      userItems: queueItems || [],
      globalStats: stats,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Error", { error: errorMessage });

    return new Response(JSON.stringify({
      error: errorMessage,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
