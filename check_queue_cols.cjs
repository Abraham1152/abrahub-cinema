const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
  const { data, error } = await supabase.rpc('get_queue_stats');
  console.log("Conexão OK.");

  // Querying information_schema via standard select is often restricted, 
  // so we'll try to do a dry-run insert or just fetch one row
  const { data: row, error: fetchError } = await supabase
    .from('generation_queue')
    .select('*')
    .limit(1);
    
  if (fetchError) {
    console.error("Erro ao ler generation_queue:", fetchError.message);
  } else {
    console.log("Colunas encontradas na tabela generation_queue:");
    console.log(Object.keys(row[0] || {}));
  }
}

checkColumns();
