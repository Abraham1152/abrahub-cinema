const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log("Verificando últimos 5 usuários na whitelist...");
  const { data, error } = await supabase
    .from('authorized_users')
    .select('email, status, updated_at')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Erro ao consultar banco:", error.message);
    return;
  }

  console.table(data);
}

check();
