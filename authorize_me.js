import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Nota: isso pode falhar se o RLS de insert for restrito, mas tentaremos.

const supabase = createClient(supabaseUrl, supabaseKey);

async function authorize() {
  const email = 'pezanella94@gmail.com';
  console.log(`Tentando autorizar e-mail: ${email}`);
  
  const { data, error } = await supabase
    .from('authorized_users')
    .upsert({ email: email.toLowerCase(), status: 'active' }, { onConflict: 'email' });

  if (error) {
    console.error('Erro ao autorizar:', error.message);
    process.exit(1);
  }
  
  console.log('Sucesso! E-mail autorisado com sucesso.');
}

authorize();
