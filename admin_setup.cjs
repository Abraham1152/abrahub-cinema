const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setup() {
  console.log('Iniciando configuracao master...');

  // 1. Criar tabela via RPC ou SQL Direto (tentativa de operacao direta)
  // Como nao temos um RPC pronto para SQL bruto, vamos usar o builder para tentar criar o registro
  // Se a tabela nao existir, o insert falhara, e entao saberemos.
  
  const email = 'pezanella94@gmail.com';

  try {
    // Tentamos inserir. Se a tabela nao existir, vamos instruir o usuario ou tentar criar via edge function se disponivel.
    const { error } = await supabase
      .from('authorized_users')
      .upsert({ email: email.toLowerCase(), status: 'active' }, { onConflict: 'email' });

    if (error && error.message.includes('relation "public.authorized_users" does not exist')) {
      console.log('Tabela authorized_users nao encontrada. Use o SQL Editor uma ultima vez para criar a estrutura base.');
      process.exit(1);
    } else if (error) {
      console.error('Erro ao autorizar:', error.message);
      process.exit(1);
    }

    console.log(`✅ Sucesso! O e-mail ${email} foi autorizado com a Chave Mestra.`);
    
    // 2. Tornar Admin
    const { data: userData } = await supabase.auth.admin.listUsers();
    const user = userData.users.find(u => u.email === email);
    
    if (user) {
      await supabase.from('user_roles').upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id,role' });
      console.log('✅ Voce tambem foi promovido a ADMIN no banco de dados.');
    } else {
      console.log('ℹ️ Usuario ainda nao criado no Auth. Crie sua conta no .EXE para se tornar Admin automaticamente no proximo login.');
    }

  } catch (err) {
    console.error('Erro fatal:', err.message);
  }
}

setup();
