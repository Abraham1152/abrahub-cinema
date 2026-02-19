import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Images expire after 7 days
const EXPIRATION_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the cutoff date (7 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - EXPIRATION_DAYS);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`[Cleanup] Looking for images older than ${cutoffISO}`);

    // Find expired images
    const { data: expiredImages, error: selectError } = await supabase
      .from('user_generated_images')
      .select('id, master_url, preview_url, base_url, upscaled_url, user_id, created_at')
      .lt('created_at', cutoffISO);

    if (selectError) {
      console.error('[Cleanup] Error selecting expired images:', selectError);
      throw selectError;
    }

    if (!expiredImages || expiredImages.length === 0) {
      console.log('[Cleanup] No expired images found');
      return new Response(
        JSON.stringify({ success: true, deleted: 0, message: 'No expired images' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Cleanup] Found ${expiredImages.length} expired images to delete`);

    // Extract storage paths from URLs and delete from storage
    const storagePaths: string[] = [];
    for (const img of expiredImages) {
      // Extract paths from URLs (format: .../storage/v1/object/sign/bucket/path?...)
      const urls = [img.master_url, img.preview_url, img.base_url, img.upscaled_url].filter(Boolean);
      
      for (const url of urls) {
        try {
          // Parse the signed URL to get the path
          const urlObj = new URL(url);
          const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/storyboard-images\/(.+)/);
          if (pathMatch) {
            storagePaths.push(pathMatch[1].split('?')[0]); // Remove query params
          }
        } catch (e) {
          console.warn(`[Cleanup] Could not parse URL: ${url}`);
        }
      }
    }

    // Delete files from storage bucket
    if (storagePaths.length > 0) {
      console.log(`[Cleanup] Deleting ${storagePaths.length} files from storage`);
      const { error: storageError } = await supabase.storage
        .from('storyboard-images')
        .remove(storagePaths);

      if (storageError) {
        console.error('[Cleanup] Error deleting from storage:', storageError);
        // Continue anyway to delete DB records
      } else {
        console.log(`[Cleanup] Successfully deleted ${storagePaths.length} files from storage`);
      }
    }

    // Delete records from database
    const expiredIds = expiredImages.map(img => img.id);
    const { error: deleteError } = await supabase
      .from('user_generated_images')
      .delete()
      .in('id', expiredIds);

    if (deleteError) {
      console.error('[Cleanup] Error deleting from database:', deleteError);
      throw deleteError;
    }

    // Also clean up old completed queue items (older than 1 hour)
    const queueCutoff = new Date();
    queueCutoff.setHours(queueCutoff.getHours() - 1);
    
    const { error: queueDeleteError } = await supabase
      .from('generation_queue')
      .delete()
      .eq('status', 'completed')
      .lt('completed_at', queueCutoff.toISOString());

    if (queueDeleteError) {
      console.warn('[Cleanup] Error cleaning up old queue items:', queueDeleteError);
    }

    console.log(`[Cleanup] Successfully deleted ${expiredImages.length} expired images`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted: expiredImages.length,
        storageFilesDeleted: storagePaths.length,
        message: `Deleted ${expiredImages.length} expired images` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cleanup] Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
