const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStripeEvents() {
  console.log("Verificando registros de eventos do Stripe...");
  const { data, error } = await supabase
    .from('credit_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Erro ao consultar credit_events:", error.message);
    return;
  }

  if (data.length === 0) {
    console.log("Nenhum evento do Stripe registrado recentemente.");
  } else {
    console.table(data);
  }
}

checkStripeEvents();
