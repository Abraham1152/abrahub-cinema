const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function clearQueues() {
  console.log('Limpando filas...');
  await supabase.from('generation_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('generation_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('generation_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Filas limpas com sucesso!');
}

clearQueues();
