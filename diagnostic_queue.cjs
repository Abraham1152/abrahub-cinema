const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnostic() {
  console.log("=== DIAGNOSTICO DE FILA ===");
  
  const { data: queue, error } = await supabase
    .from('generation_queue')
    .select('id, status, error_message, created_at, reference_type')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error("Erro ao ler fila:", error.message);
    return;
  }

  console.table(queue);

  const { data: jobs, error: jobError } = await supabase
    .from('user_generated_images')
    .select('id, status, error_message, created_at')
    .eq('status', 'generating')
    .order('created_at', { ascending: false })
    .limit(5);

  if (jobs && jobs.length > 0) {
    console.log("\n=== IMAGENS TRAVADAS EM 'GENERATING' ===");
    console.table(jobs);
  } else {
    console.log("\nNenhuma imagem travada em 'generating' encontrada.");
  }
}

diagnostic();
