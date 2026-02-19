const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listTables() {
  const { data, error } = await supabase.rpc('get_queue_stats'); // Usando uma RPC existente para testar conexão
  if (error) {
    console.log("Conexão OK, mas erro na RPC (esperado):", error.message);
  } else {
    console.log("Conexão OK, estatísticas da fila:", data);
  }

  // Tentando ler direto de authorized_users de novo, forçando refresh
  const { data: users, error: authError } = await supabase
    .from('authorized_users')
    .select('*')
    .limit(1);
    
  if (authError) {
    console.error("Erro authorized_users:", authError.message);
  } else {
    console.log("Tabela authorized_users encontrada! Linhas:", users.length);
  }
}

listTables();
