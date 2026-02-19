CREATE TABLE IF NOT EXISTS public.authorized_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active',
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.authorized_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all" ON public.authorized_users;
CREATE POLICY "Enable read for all" ON public.authorized_users FOR SELECT USING (true);

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

INSERT INTO public.authorized_users (email, status)
VALUES ('pezanella94@gmail.com', 'active')
ON CONFLICT (email) DO UPDATE SET status = 'active';
