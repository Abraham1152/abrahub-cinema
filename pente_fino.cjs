const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyFlow() {
  const testEmail = 'pezanella94@gmail.com';
  console.log(`Simulando validação de Sign-Up para: ${testEmail}`);

  const { data, error } = await supabase
    .from('authorized_users')
    .select('status')
    .eq('email', testEmail)
    .single();

  if (error) {
    console.error("❌ FALHA NO FLUXO: Whitelist não responde.", error.message);
  } else if (data && data.status === 'active') {
    console.log("✅ FLUXO OK: Usuário reconhecido na whitelist. Cadastro permitido.");
  } else {
    console.log("⚠️ ATENÇÃO: Usuário encontrado mas não está ativo.");
  }
}

verifyFlow();
