const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setPublicPolicy() {
  console.log('Forcando permissao publica no Storage...');
  
  // Como nao temos acesso direto a criar policies via API de cliente para o esquema storage, 
  // vamos apenas avisar o usuário ou tentar via RPC se houver.
  // A melhor forma é o usuário clicar no botão "Make Public" no painel.
  
  console.log('Por favor, verifique se o bucket "preset-images" esta marcado como PUBLIC no painel do Supabase.');
}

setPublicPolicy();
