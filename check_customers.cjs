const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStripeCustomers() {
  console.log("Verificando registros na tabela stripe_customers...");
  const { data, error } = await supabase
    .from('stripe_customers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Erro:", error.message);
    return;
  }

  console.table(data);
}

checkStripeCustomers();
