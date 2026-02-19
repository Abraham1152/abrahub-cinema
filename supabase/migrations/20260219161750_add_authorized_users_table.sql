-- =============================================
-- TABELA: authorized_users (CONTROLE DE ACESSO EXCLUSIVO)
-- =============================================
CREATE TABLE IF NOT EXISTS public.authorized_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active',
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.authorized_users ENABLE ROW LEVEL SECURITY;

-- Permite que o sistema verifique se um e-mail existe antes do cadastro
CREATE POLICY "Enable read for all" ON public.authorized_users FOR SELECT USING (true);

-- =============================================
-- TRIGGER: Atualizar updated_at automaticamente
-- =============================================
CREATE TRIGGER update_authorized_users_updated_at
BEFORE UPDATE ON public.authorized_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- SEED: Autorizar o Admin (Lovable Mode)
-- =============================================
INSERT INTO public.authorized_users (email, status)
VALUES ('pezanella94@gmail.com', 'active')
ON CONFLICT (email) DO UPDATE SET status = 'active';
