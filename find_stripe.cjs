const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findStripeProcessed() {
  console.log("Procurando usuários autorizados via Stripe...");
  const { data, error } = await supabase
    .from('authorized_users')
    .select('email, stripe_customer_id, updated_at')
    .not('stripe_customer_id', 'is', null)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error("Erro:", error.message);
    return;
  }

  if (data.length === 0) {
    console.log("Nenhum usuário encontrado com stripe_customer_id.");
  } else {
    console.table(data);
  }
}

findStripeProcessed();
