const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findNewUsers() {
  console.log("Procurando por registros criados nos últimos 5 minutos...");
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('authorized_users')
    .select('email, status, updated_at')
    .gt('updated_at', fiveMinutesAgo)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error("Erro:", error.message);
    return;
  }

  if (data.length === 0) {
    console.log("Nenhum novo registro encontrado nos últimos 5 minutos.");
  } else {
    console.table(data);
  }
}

findNewUsers();
