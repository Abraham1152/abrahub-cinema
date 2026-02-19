const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setAdmin() {
  const email = 'pezanella94@gmail.com';
  console.log(`Buscando ID do usuário: ${email}`);

  // 1. Buscar o ID do usuário no Auth
  const { data: userData, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Erro ao listar usuários:', authError.message);
    return;
  }

  const user = userData.users.find(u => u.email === email);
  if (!user) {
    console.error('Usuário não encontrado. Você já criou a conta no site?');
    return;
  }

  console.log(`Usuário encontrado: ${user.id}. Promovendo a ADMIN...`);

  // 2. Inserir na tabela user_roles
  const { error: roleError } = await supabase
    .from('user_roles')
    .upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id,role' });

  if (roleError) {
    console.error('Erro ao promover:', roleError.message);
  } else {
    console.log(`✅ Sucesso! O usuário ${email} agora é ADMINISTRADOR.`);
  }
}

setAdmin();
