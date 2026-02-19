const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function createTable() {
  console.log("Criando tabela authorized_users...");
  
  // Como não podemos rodar DDL arbitrário via API padrão de forma fácil sem RPC,
  // Vou usar uma estratégia de verificar se a tabela existe e, se não,
  // o usuário deve rodar o SQL no Editor.
  
  // No entanto, para ser proativo como o Lovable, vou tentar rodar via query SQL se houver uma RPC de exec_sql,
  // mas como não sei se existe, vou preparar o SQL exato para o usuário colar.
  
  const sql = `
-- 1. Criar a tabela de whitelist
CREATE TABLE IF NOT EXISTS public.authorized_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active',
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE public.authorized_users ENABLE ROW LEVEL SECURITY;

-- 3. Criar política de leitura pública (para o check de cadastro)
DROP POLICY IF EXISTS "Enable read for all" ON public.authorized_users;
CREATE POLICY "Enable read for all" ON public.authorized_users FOR SELECT USING (true);

-- 4. Criar trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_authorized_users_updated_at ON public.authorized_users;
CREATE TRIGGER update_authorized_users_updated_at
BEFORE UPDATE ON public.authorized_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Inserir o seu e-mail como admin inicial
INSERT INTO public.authorized_users (email, status)
VALUES ('pezanella94@gmail.com', 'active')
ON CONFLICT (email) DO UPDATE SET status = 'active';
  `;

  console.log("SQL PREPARADO:");
  console.log(sql);
}

createTable();
