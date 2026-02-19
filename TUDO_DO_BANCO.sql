-- =============================================
-- AI CAMPAIGN PIPELINE - DATABASE SCHEMA
-- =============================================

-- 1. Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Create subscription_status enum
CREATE TYPE public.subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing', 'incomplete');

-- 3. Create campaign_status enum
CREATE TYPE public.campaign_status AS ENUM ('draft', 'generating', 'ready', 'error');

-- 4. Create image_status enum
CREATE TYPE public.image_status AS ENUM ('pending', 'generating', 'ready', 'error');

-- =============================================
-- TABELA: authorized_users (CONTROLE DE ACESSO EXCLUSIVO)
-- =============================================
CREATE TABLE IF NOT EXISTS public.authorized_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active',
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.authorized_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for all" ON public.authorized_users FOR SELECT USING (true);

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- USER ROLES TABLE (for admin access)
-- =============================================
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'user',
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- =============================================
-- SUBSCRIPTIONS TABLE (Stripe integration)
-- =============================================
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    status subscription_status NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
ON public.subscriptions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription"
ON public.subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- USER CREDITS TABLE
-- =============================================
CREATE TABLE public.user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    available INTEGER NOT NULL DEFAULT 3,
    used INTEGER NOT NULL DEFAULT 0,
    last_reset_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credits"
ON public.user_credits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own credits"
ON public.user_credits FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credits"
ON public.user_credits FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- CREDIT LEDGER TABLE (transaction history)
-- =============================================
CREATE TABLE public.credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    reference_id UUID,
    reference_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ledger"
ON public.credit_ledger FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into their own ledger"
ON public.credit_ledger FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- CAMPAIGNS TABLE
-- =============================================
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    objective TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 30,
    mood TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    notes TEXT,
    status campaign_status NOT NULL DEFAULT 'draft',
    visual_identity_prompt TEXT,
    credits_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaigns"
ON public.campaigns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaigns"
ON public.campaigns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
ON public.campaigns FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
ON public.campaigns FOR DELETE
USING (auth.uid() = user_id);

-- =============================================
-- SCENES TABLE
-- =============================================
CREATE TABLE public.scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    narrative_function TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 5,
    emotion TEXT,
    camera_angle TEXT,
    video_prompt_kling TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

-- Helper function to check campaign ownership
CREATE OR REPLACE FUNCTION public.owns_campaign(_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.campaigns
        WHERE id = _campaign_id AND user_id = auth.uid()
    )
$$;

CREATE POLICY "Users can view scenes of their campaigns"
ON public.scenes FOR SELECT
USING (public.owns_campaign(campaign_id));

CREATE POLICY "Users can insert scenes for their campaigns"
ON public.scenes FOR INSERT
WITH CHECK (public.owns_campaign(campaign_id));

CREATE POLICY "Users can update scenes of their campaigns"
ON public.scenes FOR UPDATE
USING (public.owns_campaign(campaign_id));

CREATE POLICY "Users can delete scenes of their campaigns"
ON public.scenes FOR DELETE
USING (public.owns_campaign(campaign_id));

-- =============================================
-- SCENE IMAGES TABLE
-- =============================================
CREATE TABLE public.scene_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    url TEXT,
    prompt TEXT NOT NULL,
    status image_status NOT NULL DEFAULT 'pending',
    order_index INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scene_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view images of their campaigns"
ON public.scene_images FOR SELECT
USING (public.owns_campaign(campaign_id));

CREATE POLICY "Users can insert images for their campaigns"
ON public.scene_images FOR INSERT
WITH CHECK (public.owns_campaign(campaign_id));

CREATE POLICY "Users can update images of their campaigns"
ON public.scene_images FOR UPDATE
USING (public.owns_campaign(campaign_id));

CREATE POLICY "Users can delete images of their campaigns"
ON public.scene_images FOR DELETE
USING (public.owns_campaign(campaign_id));

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX idx_scenes_campaign_id ON public.scenes(campaign_id);
CREATE INDEX idx_scene_images_scene_id ON public.scene_images(scene_id);
CREATE INDEX idx_scene_images_campaign_id ON public.scene_images(campaign_id);
CREATE INDEX idx_credit_ledger_user_id ON public.credit_ledger(user_id);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_credits_updated_at
    BEFORE UPDATE ON public.user_credits
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scenes_updated_at
    BEFORE UPDATE ON public.scenes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scene_images_updated_at
    BEFORE UPDATE ON public.scene_images
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
    
    -- Create default credits (3 for free users)
    INSERT INTO public.user_credits (user_id, available)
    VALUES (NEW.id, 3);
    
    -- Create default subscription (free plan)
    INSERT INTO public.subscriptions (user_id, plan, status)
    VALUES (NEW.id, 'free', 'active');
    
    -- Create default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- CREDIT MANAGEMENT FUNCTIONS
-- =============================================

-- Function to check if user has enough credits
CREATE OR REPLACE FUNCTION public.has_sufficient_credits(_user_id UUID, _amount INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_credits
        WHERE user_id = _user_id AND available >= _amount
    )
$$;

-- Function to deduct credits with ledger entry
CREATE OR REPLACE FUNCTION public.deduct_credits(
    _user_id UUID,
    _amount INTEGER,
    _action TEXT,
    _description TEXT DEFAULT NULL,
    _reference_id UUID DEFAULT NULL,
    _reference_type TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _new_balance INTEGER;
BEGIN
    -- Update credits
    UPDATE public.user_credits
    SET available = available - _amount,
        used = used + _amount
    WHERE user_id = _user_id AND available >= _amount
    RETURNING available INTO _new_balance;
    
    IF _new_balance IS NULL THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;
    
    -- Record in ledger
    INSERT INTO public.credit_ledger (user_id, amount, balance_after, action, description, reference_id, reference_type)
    VALUES (_user_id, -_amount, _new_balance, _action, _description, _reference_id, _reference_type);
    
    RETURN _new_balance;
END;
$$;

-- Function to add credits with ledger entry
CREATE OR REPLACE FUNCTION public.add_credits(
    _user_id UUID,
    _amount INTEGER,
    _action TEXT,
    _description TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _new_balance INTEGER;
BEGIN
    -- Update credits
    UPDATE public.user_credits
    SET available = available + _amount
    WHERE user_id = _user_id
    RETURNING available INTO _new_balance;
    
    IF _new_balance IS NULL THEN
        -- Create credit record if doesn't exist
        INSERT INTO public.user_credits (user_id, available)
        VALUES (_user_id, _amount)
        RETURNING available INTO _new_balance;
    END IF;
    
    -- Record in ledger
    INSERT INTO public.credit_ledger (user_id, amount, balance_after, action, description)
    VALUES (_user_id, _amount, _new_balance, _action, _description);
    
    RETURN _new_balance;
END;
$$;

-- =============================================
-- STORAGE BUCKET FOR STORYBOARD IMAGES
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('storyboard-images', 'storyboard-images', true, 10485760);

-- Storage policies
CREATE POLICY "Anyone can view storyboard images"
ON storage.objects FOR SELECT
USING (bucket_id = 'storyboard-images');

CREATE POLICY "Authenticated users can upload storyboard images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'storyboard-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their uploaded images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'storyboard-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their uploaded images"
ON storage.objects FOR DELETE
USING (bucket_id = 'storyboard-images' AND auth.role() = 'authenticated');
-- Add SELECT policies for admin users to view all data

-- Profiles: admins can view all
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- User Credits: admins can view all
CREATE POLICY "Admins can view all credits"
ON public.user_credits FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Subscriptions: admins can view all
CREATE POLICY "Admins can view all subscriptions"
ON public.subscriptions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Campaigns: admins can view all
CREATE POLICY "Admins can view all campaigns"
ON public.campaigns FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Scenes: admins can view all
CREATE POLICY "Admins can view all scenes"
ON public.scenes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Scene Images: admins can view all
CREATE POLICY "Admins can view all scene_images"
ON public.scene_images FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Credit Ledger: admins can view all
CREATE POLICY "Admins can view all ledger entries"
ON public.credit_ledger FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- User Roles: admins can view all
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
-- Create storage bucket for storyboard images
INSERT INTO storage.buckets (id, name, public)
VALUES ('storyboard-images', 'storyboard-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for storyboard-images bucket
-- Users can view all images (public bucket)
CREATE POLICY "Public read access for storyboard images"
ON storage.objects FOR SELECT
USING (bucket_id = 'storyboard-images');

-- Users can upload their own images (path: user_id/...)
CREATE POLICY "Users can upload storyboard images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'storyboard-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own images
CREATE POLICY "Users can update own storyboard images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'storyboard-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own images
CREATE POLICY "Users can delete own storyboard images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'storyboard-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Service role can manage all images (for edge functions)
CREATE POLICY "Service role full access storyboard images"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'storyboard-images')
WITH CHECK (bucket_id = 'storyboard-images');

-- Create initial credits for new users via trigger
CREATE OR REPLACE FUNCTION public.create_user_credits()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create credits record with 10 free credits
  INSERT INTO public.user_credits (user_id, available, used)
  VALUES (NEW.id, 10, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create subscription record
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;

CREATE TRIGGER on_auth_user_created_credits
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_user_credits();
-- Drop existing RESTRICTIVE policies on scenes table
DROP POLICY IF EXISTS "Admins can view all scenes" ON public.scenes;
DROP POLICY IF EXISTS "Users can delete scenes of their campaigns" ON public.scenes;
DROP POLICY IF EXISTS "Users can insert scenes for their campaigns" ON public.scenes;
DROP POLICY IF EXISTS "Users can update scenes of their campaigns" ON public.scenes;
DROP POLICY IF EXISTS "Users can view scenes of their campaigns" ON public.scenes;

-- Recreate as PERMISSIVE policies (default)
CREATE POLICY "Users can view scenes of their campaigns"
ON public.scenes FOR SELECT
TO authenticated
USING (owns_campaign(campaign_id));

CREATE POLICY "Users can insert scenes for their campaigns"
ON public.scenes FOR INSERT
TO authenticated
WITH CHECK (owns_campaign(campaign_id));

CREATE POLICY "Users can update scenes of their campaigns"
ON public.scenes FOR UPDATE
TO authenticated
USING (owns_campaign(campaign_id));

CREATE POLICY "Users can delete scenes of their campaigns"
ON public.scenes FOR DELETE
TO authenticated
USING (owns_campaign(campaign_id));

CREATE POLICY "Admins can view all scenes"
ON public.scenes FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Also fix scene_images table (same issue)
DROP POLICY IF EXISTS "Admins can view all scene_images" ON public.scene_images;
DROP POLICY IF EXISTS "Users can delete images of their campaigns" ON public.scene_images;
DROP POLICY IF EXISTS "Users can insert images for their campaigns" ON public.scene_images;
DROP POLICY IF EXISTS "Users can update images of their campaigns" ON public.scene_images;
DROP POLICY IF EXISTS "Users can view images of their campaigns" ON public.scene_images;

CREATE POLICY "Users can view images of their campaigns"
ON public.scene_images FOR SELECT
TO authenticated
USING (owns_campaign(campaign_id));

CREATE POLICY "Users can insert images for their campaigns"
ON public.scene_images FOR INSERT
TO authenticated
WITH CHECK (owns_campaign(campaign_id));

CREATE POLICY "Users can update images of their campaigns"
ON public.scene_images FOR UPDATE
TO authenticated
USING (owns_campaign(campaign_id));

CREATE POLICY "Users can delete images of their campaigns"
ON public.scene_images FOR DELETE
TO authenticated
USING (owns_campaign(campaign_id));

CREATE POLICY "Admins can view all scene_images"
ON public.scene_images FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));
-- Change credit columns from integer to numeric to support decimal values (0.25)
ALTER TABLE public.user_credits 
  ALTER COLUMN available TYPE numeric(10,2) USING available::numeric,
  ALTER COLUMN used TYPE numeric(10,2) USING used::numeric;

ALTER TABLE public.credit_ledger
  ALTER COLUMN amount TYPE numeric(10,2) USING amount::numeric,
  ALTER COLUMN balance_after TYPE numeric(10,2) USING balance_after::numeric;

-- Update the deduct_credits function to handle decimals
CREATE OR REPLACE FUNCTION public.deduct_credits(
  _user_id uuid, 
  _amount numeric, 
  _action text, 
  _description text DEFAULT NULL, 
  _reference_id uuid DEFAULT NULL, 
  _reference_type text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _new_balance NUMERIC;
BEGIN
    -- Update credits
    UPDATE public.user_credits
    SET available = available - _amount,
        used = used + _amount
    WHERE user_id = _user_id AND available >= _amount
    RETURNING available INTO _new_balance;
    
    IF _new_balance IS NULL THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;
    
    -- Record in ledger
    INSERT INTO public.credit_ledger (user_id, amount, balance_after, action, description, reference_id, reference_type)
    VALUES (_user_id, -_amount, _new_balance, _action, _description, _reference_id, _reference_type);
    
    RETURN _new_balance;
END;
$$;

-- Update the add_credits function to handle decimals
CREATE OR REPLACE FUNCTION public.add_credits(
  _user_id uuid, 
  _amount numeric, 
  _action text, 
  _description text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _new_balance NUMERIC;
BEGIN
    -- Update credits
    UPDATE public.user_credits
    SET available = available + _amount
    WHERE user_id = _user_id
    RETURNING available INTO _new_balance;
    
    IF _new_balance IS NULL THEN
        -- Create credit record if doesn't exist
        INSERT INTO public.user_credits (user_id, available)
        VALUES (_user_id, _amount)
        RETURNING available INTO _new_balance;
    END IF;
    
    -- Record in ledger
    INSERT INTO public.credit_ledger (user_id, amount, balance_after, action, description)
    VALUES (_user_id, _amount, _new_balance, _action, _description);
    
    RETURN _new_balance;
END;
$$;

-- Update has_sufficient_credits to work with decimals
CREATE OR REPLACE FUNCTION public.has_sufficient_credits(_user_id uuid, _amount numeric)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_credits
        WHERE user_id = _user_id AND available >= _amount
    )
$$;
-- Create table for user image generations (standalone, outside campaigns)
CREATE TABLE public.user_generated_images (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    prompt TEXT NOT NULL,
    model TEXT NOT NULL,
    model_label TEXT,
    url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    credits_cost NUMERIC NOT NULL DEFAULT 10,
    aspect_ratio TEXT DEFAULT '16:9',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for user video generations (standalone, outside campaigns)
CREATE TABLE public.user_generated_videos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    prompt TEXT NOT NULL,
    model TEXT NOT NULL,
    model_label TEXT,
    source_image_url TEXT,
    video_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    credits_cost NUMERIC NOT NULL DEFAULT 35,
    duration_seconds INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_generated_videos ENABLE ROW LEVEL SECURITY;

-- RLS policies for images
CREATE POLICY "Users can view their own generated images"
ON public.user_generated_images FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generated images"
ON public.user_generated_images FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generated images"
ON public.user_generated_images FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generated images"
ON public.user_generated_images FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for videos
CREATE POLICY "Users can view their own generated videos"
ON public.user_generated_videos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generated videos"
ON public.user_generated_videos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generated videos"
ON public.user_generated_videos FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generated videos"
ON public.user_generated_videos FOR DELETE
USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_user_generated_images_updated_at
BEFORE UPDATE ON public.user_generated_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_generated_videos_updated_at
BEFORE UPDATE ON public.user_generated_videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- ================================================
-- TABELA: generation_queue
-- Sistema de fila para geração de imagens
-- ================================================
CREATE TABLE IF NOT EXISTS public.generation_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  quality TEXT NOT NULL DEFAULT '2K',
  preset_id TEXT NOT NULL DEFAULT 'arri-natural',
  focal_length TEXT NOT NULL DEFAULT '35mm',
  aperture TEXT NOT NULL DEFAULT 'f2.8',
  credits_cost NUMERIC NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  position_in_queue INTEGER,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  result_image_id UUID REFERENCES public.user_generated_images(id),
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ================================================
-- TABELA: generation_jobs
-- Trabalhos de geração em processamento
-- ================================================
CREATE TABLE IF NOT EXISTS public.generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idx SERIAL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_fk UUID NOT NULL,
    prompt TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL DEFAULT '16:9',
    status TEXT NOT NULL DEFAULT 'pending',
    credits_cost NUMERIC NOT NULL DEFAULT 0,
    preset_id TEXT,
    quality TEXT DEFAULT 'standard',
    focal_length TEXT DEFAULT '35mm',
    aperture TEXT DEFAULT 'f/1.8',
    image_url TEXT,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    reference_images JSONB DEFAULT '[]'::jsonb,
    reference_type TEXT,
    reference_prompt_injection TEXT,
    base_url TEXT,
    base_width INTEGER,
    base_height INTEGER,
    base_bytes INTEGER,
    preview_url TEXT,
    preview_width INTEGER,
    preview_height INTEGER,
    preview_bytes INTEGER,
    master_url TEXT,
    master_width INTEGER,
    master_height INTEGER,
    master_bytes INTEGER
);

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generation jobs"
ON public.generation_jobs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own generation jobs"
ON public.generation_jobs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generation jobs"
ON public.generation_jobs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generation jobs"
ON public.generation_jobs FOR DELETE
USING (auth.uid() = user_id);

-- Enable RLS
ALTER TABLE public.generation_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own queue items"
  ON public.generation_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own queue items"
  ON public.generation_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for background processing)
CREATE POLICY "Service role full access"
  ON public.generation_queue FOR ALL
  USING (auth.role() = 'service_role');

-- Index for queue processing
CREATE INDEX idx_generation_queue_status ON public.generation_queue(status, created_at);
CREATE INDEX idx_generation_queue_user ON public.generation_queue(user_id, created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_generation_queue_updated_at
  BEFORE UPDATE ON public.generation_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================
-- TABELA: rate_limit_state
-- Controle de rate limiting para API Gemini
-- ================================================

CREATE TABLE public.rate_limit_state (
  id TEXT PRIMARY KEY DEFAULT 'gemini_api',
  requests_this_minute INTEGER NOT NULL DEFAULT 0,
  minute_window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  requests_today INTEGER NOT NULL DEFAULT 0,
  day_window_start DATE NOT NULL DEFAULT CURRENT_DATE,
  last_request_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert initial state
INSERT INTO public.rate_limit_state (id) VALUES ('gemini_api');

-- Enable RLS (only service role should access)
ALTER TABLE public.rate_limit_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role access only"
  ON public.rate_limit_state FOR ALL
  USING (auth.role() = 'service_role');

-- ================================================
-- FUNÇÃO: get_queue_position
-- Retorna a posição atual de um item na fila
-- ================================================

CREATE OR REPLACE FUNCTION public.get_queue_position(queue_item_id UUID)
RETURNS INTEGER AS $$
DECLARE
  item_created_at TIMESTAMP WITH TIME ZONE;
  position INTEGER;
BEGIN
  -- Get the created_at of the target item
  SELECT created_at INTO item_created_at
  FROM public.generation_queue
  WHERE id = queue_item_id AND status = 'queued';
  
  IF item_created_at IS NULL THEN
    RETURN 0; -- Not in queue or doesn't exist
  END IF;
  
  -- Count items ahead in queue
  SELECT COUNT(*) + 1 INTO position
  FROM public.generation_queue
  WHERE status = 'queued' AND created_at < item_created_at;
  
  RETURN position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ================================================
-- FUNÇÃO: get_queue_stats
-- Retorna estatísticas da fila
-- ================================================

CREATE OR REPLACE FUNCTION public.get_queue_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'queued_count', (SELECT COUNT(*) FROM public.generation_queue WHERE status = 'queued'),
    'processing_count', (SELECT COUNT(*) FROM public.generation_queue WHERE status = 'processing'),
    'completed_today', (SELECT COUNT(*) FROM public.generation_queue WHERE status = 'completed' AND completed_at >= CURRENT_DATE),
    'average_wait_seconds', (
      SELECT COALESCE(
        EXTRACT(EPOCH FROM AVG(started_at - created_at)),
        0
      )
      FROM public.generation_queue
      WHERE status IN ('completed', 'processing') AND started_at IS NOT NULL
      AND created_at >= CURRENT_DATE
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable realtime for queue updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_queue;
-- Add INSERT policy: Only admins can create role assignments
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE policy: Only admins can update role assignments
CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policy: Only admins can delete role assignments
CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
-- Add columns for reference images and smart reference classification
ALTER TABLE public.generation_queue 
ADD COLUMN IF NOT EXISTS reference_images JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS reference_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reference_prompt_injection TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.generation_queue.reference_images IS 'Array of base64 reference images';
COMMENT ON COLUMN public.generation_queue.reference_type IS 'Classification: person or object';
COMMENT ON COLUMN public.generation_queue.reference_prompt_injection IS 'Injected prompt based on reference type';
-- Fix initial credits: Free plan starts with 1 credit, not 3 or 10
-- This migration updates the function that creates user credits on signup

-- First, update the column default on user_credits table
ALTER TABLE public.user_credits ALTER COLUMN available SET DEFAULT 1;

-- Update handle_new_user function to give 1 credit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
    
    -- Create default credits (1 for free users)
    INSERT INTO public.user_credits (user_id, available)
    VALUES (NEW.id, 1);
    
    -- Create default subscription (free plan)
    INSERT INTO public.subscriptions (user_id, plan, status)
    VALUES (NEW.id, 'free', 'active');
    
    -- Create default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update create_user_credits function to give 1 credit
CREATE OR REPLACE FUNCTION public.create_user_credits()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create credits record with 1 free credit
  INSERT INTO public.user_credits (user_id, available, used)
  VALUES (NEW.id, 1, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create subscription record
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;
-- Add columns for master and preview URLs
ALTER TABLE public.user_generated_images 
ADD COLUMN IF NOT EXISTS master_url TEXT,
ADD COLUMN IF NOT EXISTS preview_url TEXT;

-- Migrate existing data: current url becomes preview_url, master_url same as url
UPDATE public.user_generated_images 
SET master_url = url, preview_url = url 
WHERE url IS NOT NULL AND master_url IS NULL;
-- Add metadata columns to user_generated_images
ALTER TABLE public.user_generated_images
ADD COLUMN IF NOT EXISTS master_width INTEGER,
ADD COLUMN IF NOT EXISTS master_height INTEGER,
ADD COLUMN IF NOT EXISTS master_bytes INTEGER,
ADD COLUMN IF NOT EXISTS preview_width INTEGER,
ADD COLUMN IF NOT EXISTS preview_height INTEGER,
ADD COLUMN IF NOT EXISTS preview_bytes INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN public.user_generated_images.master_width IS 'Width of master image in pixels';
COMMENT ON COLUMN public.user_generated_images.master_height IS 'Height of master image in pixels';
COMMENT ON COLUMN public.user_generated_images.master_bytes IS 'File size of master image in bytes';
COMMENT ON COLUMN public.user_generated_images.preview_width IS 'Width of preview image in pixels';
COMMENT ON COLUMN public.user_generated_images.preview_height IS 'Height of preview image in pixels';
COMMENT ON COLUMN public.user_generated_images.preview_bytes IS 'File size of preview image in bytes';
-- Add upscale on-demand columns to user_generated_images
ALTER TABLE public.user_generated_images
ADD COLUMN IF NOT EXISTS upscale_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS upscaled_url TEXT,
ADD COLUMN IF NOT EXISTS upscaled_width INTEGER,
ADD COLUMN IF NOT EXISTS upscaled_height INTEGER,
ADD COLUMN IF NOT EXISTS upscaled_bytes INTEGER,
ADD COLUMN IF NOT EXISTS upscale_error_reason TEXT,
ADD COLUMN IF NOT EXISTS upscale_job_id TEXT,
ADD COLUMN IF NOT EXISTS upscale_created_at TIMESTAMP WITH TIME ZONE;

-- Update upscale_status to use new values if needed (none | processing | ready | failed)
-- First drop the default if it exists
ALTER TABLE public.user_generated_images
ALTER COLUMN upscale_status SET DEFAULT 'none';

-- Update any existing 'pending' values to 'none'
UPDATE public.user_generated_images
SET upscale_status = 'none'
WHERE upscale_status = 'pending' OR upscale_status IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.user_generated_images.upscaled_url IS 'URL of upscaled image (created on-demand when user requests upscale download)';
COMMENT ON COLUMN public.user_generated_images.upscaled_width IS 'Width of upscaled image in pixels';
COMMENT ON COLUMN public.user_generated_images.upscaled_height IS 'Height of upscaled image in pixels';
COMMENT ON COLUMN public.user_generated_images.upscaled_bytes IS 'File size of upscaled image in bytes';
COMMENT ON COLUMN public.user_generated_images.upscale_status IS 'Status of upscale: none, processing, ready, failed';
COMMENT ON COLUMN public.user_generated_images.upscale_error_reason IS 'Error message if upscale failed';
COMMENT ON COLUMN public.user_generated_images.upscale_job_id IS 'Job ID for tracking upscale progress';
COMMENT ON COLUMN public.user_generated_images.upscale_created_at IS 'Timestamp when upscale was initiated';
-- Add UPDATE policy for users to update their own queue items (only pending/queued status)
CREATE POLICY "Users can update their own pending queue items"
ON public.generation_queue
FOR UPDATE
USING (auth.uid() = user_id AND status IN ('queued', 'pending'))
WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy for users to delete their own queue items (only pending/queued status)
CREATE POLICY "Users can delete their own pending queue items"
ON public.generation_queue
FOR DELETE
USING (auth.uid() = user_id AND status IN ('queued', 'pending'));
-- Add explicit policies to restrict INSERT and UPDATE on user_credits to service role only
-- This prevents any user from directly manipulating their credit balances

-- Policy: Only service role can insert credits
CREATE POLICY "Only service role can insert credits"
ON public.user_credits
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Policy: Only service role can update credits
CREATE POLICY "Only service role can update credits"
ON public.user_credits
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Policy: Only service role can delete credits (extra protection)
CREATE POLICY "Only service role can delete credits"
ON public.user_credits
FOR DELETE
USING (auth.role() = 'service_role');
-- Make storyboard-images bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'storyboard-images';

-- Drop the public read policy if it exists
DROP POLICY IF EXISTS "Public read access for storyboard images" ON storage.objects;

-- Add authenticated read policy - users can only view their own images
CREATE POLICY "Users can view their own storyboard images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'storyboard-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
-- Enable realtime for user_generated_images table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_generated_images;
-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
-- Add liked column to user_generated_images table
ALTER TABLE public.user_generated_images 
ADD COLUMN IF NOT EXISTS liked boolean NOT NULL DEFAULT false;

-- Create index for filtering liked images
CREATE INDEX IF NOT EXISTS idx_user_generated_images_liked 
ON public.user_generated_images(user_id, liked) 
WHERE liked = true;
-- =============================================
-- STRIPE ENTITLEMENTS INTEGRATION TABLES
-- =============================================

-- 1) entitlements: stores user subscription state
CREATE TABLE public.entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'trialing', 'past_due', 'unpaid', 'canceled', 'inactive')),
  current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only read their own entitlements
CREATE POLICY "Users can view their own entitlements"
ON public.entitlements FOR SELECT
USING (auth.uid() = user_id);

-- RLS: Service role can do everything
CREATE POLICY "Service role full access on entitlements"
ON public.entitlements FOR ALL
USING (auth.role() = 'service_role');

-- Index for quick lookups
CREATE INDEX idx_entitlements_stripe_customer_id ON public.entitlements(stripe_customer_id);
CREATE INDEX idx_entitlements_stripe_subscription_id ON public.entitlements(stripe_subscription_id);

-- 2) credit_wallet: stores user credit balance
CREATE TABLE public.credit_wallet (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_balance int NOT NULL DEFAULT 0,
  monthly_allowance int NOT NULL DEFAULT 0,
  last_refill_invoice_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_wallet ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only read their own wallet
CREATE POLICY "Users can view their own credit_wallet"
ON public.credit_wallet FOR SELECT
USING (auth.uid() = user_id);

-- RLS: Service role can do everything
CREATE POLICY "Service role full access on credit_wallet"
ON public.credit_wallet FOR ALL
USING (auth.role() = 'service_role');

-- 3) stripe_customers: maps Stripe customers to users
CREATE TABLE public.stripe_customers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only read their own mapping
CREATE POLICY "Users can view their own stripe_customers"
ON public.stripe_customers FOR SELECT
USING (auth.uid() = user_id);

-- RLS: Service role can do everything
CREATE POLICY "Service role full access on stripe_customers"
ON public.stripe_customers FOR ALL
USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_stripe_customers_email ON public.stripe_customers(email);
CREATE INDEX idx_stripe_customers_stripe_customer_id ON public.stripe_customers(stripe_customer_id);

-- 4) pending_entitlements: for users who paid before creating an account
CREATE TABLE public.pending_entitlements (
  email text PRIMARY KEY,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'trialing', 'past_due', 'unpaid', 'canceled', 'inactive')),
  credits_to_grant int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (service role only)
ALTER TABLE public.pending_entitlements ENABLE ROW LEVEL SECURITY;

-- RLS: Only service role can access pending_entitlements
CREATE POLICY "Service role full access on pending_entitlements"
ON public.pending_entitlements FOR ALL
USING (auth.role() = 'service_role');

-- Index
CREATE INDEX idx_pending_entitlements_stripe_customer_id ON public.pending_entitlements(stripe_customer_id);

-- =============================================
-- ATOMIC CREDIT CONSUMPTION FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.consume_credits(_amount int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _new_balance int;
BEGIN
  -- Get the authenticated user
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  
  -- Lock the row and update atomically
  UPDATE public.credit_wallet
  SET 
    credits_balance = credits_balance - _amount,
    updated_at = now()
  WHERE user_id = _user_id
    AND credits_balance >= _amount
  RETURNING credits_balance INTO _new_balance;
  
  IF _new_balance IS NULL THEN
    -- Check if user exists or just insufficient balance
    IF NOT EXISTS (SELECT 1 FROM public.credit_wallet WHERE user_id = _user_id) THEN
      RAISE EXCEPTION 'No credit wallet found';
    ELSE
      RAISE EXCEPTION 'Insufficient credits';
    END IF;
  END IF;
  
  RETURN _new_balance;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.consume_credits(int) TO authenticated;

-- =============================================
-- TRIGGER FOR CLAIMING PENDING ENTITLEMENTS ON SIGNUP
-- =============================================

CREATE OR REPLACE FUNCTION public.claim_pending_entitlements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _pending record;
BEGIN
  -- Check if there are pending entitlements for this email
  SELECT * INTO _pending
  FROM public.pending_entitlements
  WHERE email = NEW.email;
  
  IF FOUND THEN
    -- Create stripe_customers mapping
    INSERT INTO public.stripe_customers (user_id, stripe_customer_id, email)
    VALUES (NEW.id, _pending.stripe_customer_id, NEW.email)
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      email = EXCLUDED.email;
    
    -- Create entitlements
    INSERT INTO public.entitlements (user_id, stripe_customer_id, stripe_subscription_id, plan, status)
    VALUES (NEW.id, _pending.stripe_customer_id, _pending.stripe_subscription_id, _pending.plan, _pending.status)
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      updated_at = now();
    
    -- Create credit_wallet with pending credits
    INSERT INTO public.credit_wallet (user_id, credits_balance, monthly_allowance)
    VALUES (NEW.id, _pending.credits_to_grant, CASE WHEN _pending.plan = 'pro' THEN 100 ELSE 0 END)
    ON CONFLICT (user_id) DO UPDATE SET
      credits_balance = EXCLUDED.credits_balance,
      monthly_allowance = EXCLUDED.monthly_allowance,
      updated_at = now();
    
    -- Delete the pending entitlement
    DELETE FROM public.pending_entitlements WHERE email = NEW.email;
  ELSE
    -- Create default free entitlements for new users
    INSERT INTO public.entitlements (user_id, plan, status)
    VALUES (NEW.id, 'free', 'inactive')
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO public.credit_wallet (user_id, credits_balance, monthly_allowance)
    VALUES (NEW.id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users for new signups
CREATE TRIGGER on_auth_user_created_claim_entitlements
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.claim_pending_entitlements();
-- Drop the trigger first if it exists (might not be properly attached)
DROP TRIGGER IF EXISTS on_auth_user_created_claim_entitlements ON auth.users;

-- Create or replace the claim function
CREATE OR REPLACE FUNCTION public.claim_pending_entitlements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _pending record;
BEGIN
  -- Check if there are pending entitlements for this email
  SELECT * INTO _pending
  FROM public.pending_entitlements
  WHERE email = NEW.email;
  
  IF FOUND THEN
    -- Create stripe_customers mapping
    INSERT INTO public.stripe_customers (user_id, stripe_customer_id, email)
    VALUES (NEW.id, _pending.stripe_customer_id, NEW.email)
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      email = EXCLUDED.email;
    
    -- Create entitlements
    INSERT INTO public.entitlements (user_id, stripe_customer_id, stripe_subscription_id, plan, status)
    VALUES (NEW.id, _pending.stripe_customer_id, _pending.stripe_subscription_id, _pending.plan, _pending.status)
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      updated_at = now();
    
    -- Create credit_wallet with pending credits
    INSERT INTO public.credit_wallet (user_id, credits_balance, monthly_allowance)
    VALUES (NEW.id, _pending.credits_to_grant, CASE WHEN _pending.plan = 'pro' THEN 100 ELSE 0 END)
    ON CONFLICT (user_id) DO UPDATE SET
      credits_balance = EXCLUDED.credits_balance,
      monthly_allowance = EXCLUDED.monthly_allowance,
      updated_at = now();
    
    -- Delete the pending entitlement
    DELETE FROM public.pending_entitlements WHERE email = NEW.email;
  ELSE
    -- Create default free entitlements for new users
    INSERT INTO public.entitlements (user_id, plan, status)
    VALUES (NEW.id, 'free', 'inactive')
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO public.credit_wallet (user_id, credits_balance, monthly_allowance)
    VALUES (NEW.id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger on auth.users
CREATE TRIGGER on_auth_user_created_claim_entitlements
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.claim_pending_entitlements();

-- Also create a callable RPC for manual claiming (in case trigger misses or for existing users)
CREATE OR REPLACE FUNCTION public.claim_entitlements_for_user()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _user_email text;
  _pending record;
  _result json;
BEGIN
  -- Get the authenticated user
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get user email from auth.users
  SELECT email INTO _user_email
  FROM auth.users
  WHERE id = _user_id;
  
  IF _user_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User email not found');
  END IF;
  
  -- Check for pending entitlements
  SELECT * INTO _pending
  FROM public.pending_entitlements
  WHERE email = _user_email;
  
  IF NOT FOUND THEN
    -- No pending entitlements, ensure defaults exist
    INSERT INTO public.entitlements (user_id, plan, status)
    VALUES (_user_id, 'free', 'inactive')
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO public.credit_wallet (user_id, credits_balance, monthly_allowance)
    VALUES (_user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN json_build_object('success', true, 'claimed', false, 'message', 'No pending entitlements');
  END IF;
  
  -- Claim the pending entitlements
  
  -- Create stripe_customers mapping
  INSERT INTO public.stripe_customers (user_id, stripe_customer_id, email)
  VALUES (_user_id, _pending.stripe_customer_id, _user_email)
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    email = EXCLUDED.email;
  
  -- Create/update entitlements
  INSERT INTO public.entitlements (user_id, stripe_customer_id, stripe_subscription_id, plan, status)
  VALUES (_user_id, _pending.stripe_customer_id, _pending.stripe_subscription_id, _pending.plan, _pending.status)
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    updated_at = now();
  
  -- Create/update credit_wallet
  INSERT INTO public.credit_wallet (user_id, credits_balance, monthly_allowance)
  VALUES (_user_id, _pending.credits_to_grant, CASE WHEN _pending.plan = 'pro' THEN 100 ELSE 0 END)
  ON CONFLICT (user_id) DO UPDATE SET
    credits_balance = EXCLUDED.credits_balance,
    monthly_allowance = EXCLUDED.monthly_allowance,
    updated_at = now();
  
  -- Delete the pending entitlement
  DELETE FROM public.pending_entitlements WHERE email = _user_email;
  
  RETURN json_build_object(
    'success', true, 
    'claimed', true, 
    'plan', _pending.plan,
    'credits', _pending.credits_to_grant
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_entitlements_for_user() TO authenticated;
-- Drop and recreate claim_entitlements_for_user with proper logic
CREATE OR REPLACE FUNCTION public.claim_entitlements_for_user()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _user_email text;
  _pending record;
  _result json;
BEGIN
  -- Get the authenticated user
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated', 'claimed', false);
  END IF;
  
  -- Get user email from auth.users
  SELECT email INTO _user_email
  FROM auth.users
  WHERE id = _user_id;
  
  IF _user_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User email not found', 'claimed', false);
  END IF;
  
  -- Check for pending entitlements - case insensitive, status active or pending
  SELECT * INTO _pending
  FROM public.pending_entitlements
  WHERE lower(email) = lower(_user_email)
    AND status IN ('active', 'pending', 'inactive');
  
  IF NOT FOUND THEN
    -- No pending entitlements, ensure defaults exist
    INSERT INTO public.entitlements (user_id, plan, status)
    VALUES (_user_id, 'free', 'inactive')
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO public.credit_wallet (user_id, credits_balance, monthly_allowance)
    VALUES (_user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN json_build_object(
      'success', true, 
      'claimed', false, 
      'message', 'No pending entitlements found',
      'email_checked', _user_email
    );
  END IF;
  
  -- Claim the pending entitlements
  
  -- Create stripe_customers mapping
  INSERT INTO public.stripe_customers (user_id, stripe_customer_id, email)
  VALUES (_user_id, _pending.stripe_customer_id, _user_email)
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    email = EXCLUDED.email;
  
  -- Create/update entitlements with active status for pro users
  INSERT INTO public.entitlements (user_id, stripe_customer_id, stripe_subscription_id, plan, status)
  VALUES (
    _user_id, 
    _pending.stripe_customer_id, 
    _pending.stripe_subscription_id, 
    _pending.plan, 
    CASE WHEN _pending.plan = 'pro' THEN 'active' ELSE _pending.status END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    updated_at = now();
  
  -- Create/update credit_wallet - PRO gets 100 credits immediately
  INSERT INTO public.credit_wallet (user_id, credits_balance, monthly_allowance)
  VALUES (
    _user_id, 
    CASE WHEN _pending.plan = 'pro' THEN GREATEST(_pending.credits_to_grant, 100) ELSE _pending.credits_to_grant END,
    CASE WHEN _pending.plan = 'pro' THEN 100 ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    credits_balance = EXCLUDED.credits_balance,
    monthly_allowance = EXCLUDED.monthly_allowance,
    updated_at = now();
  
  -- Also update subscriptions table for backward compatibility
  INSERT INTO public.subscriptions (user_id, plan, status, stripe_customer_id, stripe_subscription_id)
  VALUES (
    _user_id,
    _pending.plan,
    CASE WHEN _pending.plan = 'pro' THEN 'active'::subscription_status ELSE 'active'::subscription_status END,
    _pending.stripe_customer_id,
    _pending.stripe_subscription_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    updated_at = now();
  
  -- Also update user_credits table for backward compatibility
  INSERT INTO public.user_credits (user_id, available)
  VALUES (
    _user_id, 
    CASE WHEN _pending.plan = 'pro' THEN GREATEST(_pending.credits_to_grant, 100) ELSE _pending.credits_to_grant END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    available = EXCLUDED.available,
    updated_at = now();
  
  -- Delete the pending entitlement (claimed successfully)
  DELETE FROM public.pending_entitlements WHERE lower(email) = lower(_user_email);
  
  RETURN json_build_object(
    'success', true, 
    'claimed', true, 
    'plan_applied', _pending.plan,
    'credits_applied', CASE WHEN _pending.plan = 'pro' THEN GREATEST(_pending.credits_to_grant, 100) ELSE _pending.credits_to_grant END,
    'stripe_customer_id', _pending.stripe_customer_id
  );
END;
$function$;
-- Create credit_events table for idempotency (anti-duplicação de 100 créditos)
CREATE TABLE IF NOT EXISTS public.credit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_credit_events_lookup 
ON public.credit_events (user_id, stripe_subscription_id, type);

-- Enable RLS
ALTER TABLE public.credit_events ENABLE ROW LEVEL SECURITY;

-- Service role can manage credit_events
CREATE POLICY "Service role full access on credit_events" 
ON public.credit_events 
FOR ALL 
USING (auth.role() = 'service_role');

-- Users can view their own credit events
CREATE POLICY "Users can view their own credit_events" 
ON public.credit_events 
FOR SELECT 
USING (auth.uid() = user_id);

-- Add last_refill_at column to credit_wallet if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'credit_wallet' 
    AND column_name = 'last_refill_at'
  ) THEN
    ALTER TABLE public.credit_wallet 
    ADD COLUMN last_refill_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
END $$;
-- Create a version of consume_credits that accepts user_id parameter
-- for use by service_role (edge functions)
CREATE OR REPLACE FUNCTION public.consume_credits_admin(_user_id uuid, _amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_balance int;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  
  -- Lock the row and update atomically from credit_wallet
  UPDATE public.credit_wallet
  SET 
    credits_balance = credits_balance - _amount,
    updated_at = now()
  WHERE user_id = _user_id
    AND credits_balance >= _amount
  RETURNING credits_balance INTO _new_balance;
  
  IF _new_balance IS NULL THEN
    -- Check if user exists or just insufficient balance
    IF NOT EXISTS (SELECT 1 FROM public.credit_wallet WHERE user_id = _user_id) THEN
      RAISE EXCEPTION 'No credit wallet found';
    ELSE
      RAISE EXCEPTION 'Insufficient credits';
    END IF;
  END IF;
  
  -- Also keep user_credits in sync for backward compatibility
  UPDATE public.user_credits
  SET 
    available = available - _amount,
    used = used + _amount,
    updated_at = now()
  WHERE user_id = _user_id AND available >= _amount;
  
  RETURN _new_balance;
END;
$$;
-- Add grace_until and downgraded_at columns to entitlements table
ALTER TABLE public.entitlements 
ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS downgraded_at TIMESTAMPTZ DEFAULT NULL;
-- ==============================================
-- PRESET MANAGEMENT SYSTEM
-- ==============================================

-- 1. Create preset_configs table (main metadata)
CREATE TABLE public.preset_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_type TEXT NOT NULL CHECK (preset_type IN ('camera', 'focal', 'aperture')),
  preset_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  preview_image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(preset_type, preset_key)
);

-- 2. Create preset_prompt_blocks table (technical prompt data)
CREATE TABLE public.preset_prompt_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id UUID REFERENCES public.preset_configs(id) ON DELETE CASCADE,
  camera_body TEXT,
  lens_type TEXT,
  sensor_format TEXT,
  optics_behavior_text TEXT,
  color_science_text TEXT,
  sharpness_profile_text TEXT,
  realism_guard_text TEXT,
  physics_description TEXT,
  UNIQUE(preset_id)
);

-- 3. Enable RLS
ALTER TABLE public.preset_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_prompt_blocks ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for preset_configs
CREATE POLICY "Anyone can read active presets"
ON public.preset_configs FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert presets"
ON public.preset_configs FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update presets"
ON public.preset_configs FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete presets"
ON public.preset_configs FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. RLS Policies for preset_prompt_blocks
CREATE POLICY "Anyone can read prompt blocks"
ON public.preset_prompt_blocks FOR SELECT
USING (true);

CREATE POLICY "Admins can insert prompt blocks"
ON public.preset_prompt_blocks FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update prompt blocks"
ON public.preset_prompt_blocks FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete prompt blocks"
ON public.preset_prompt_blocks FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 6. Create storage bucket for preset images
INSERT INTO storage.buckets (id, name, public)
VALUES ('preset-images', 'preset-images', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage policies
CREATE POLICY "Public read for preset images"
ON storage.objects FOR SELECT
USING (bucket_id = 'preset-images');

CREATE POLICY "Admins upload preset images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'preset-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update preset images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'preset-images')
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete preset images"
ON storage.objects FOR DELETE
USING (bucket_id = 'preset-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- 8. Seed existing camera presets
INSERT INTO public.preset_configs (preset_type, preset_key, label, description, sort_order, preview_image_url) VALUES
  ('camera', 'arri-natural', 'ARRI Natural Narrative', 'Organic narrative, filmic tones, natural skin rendering', 1, '/presets/preset-arri.jpg'),
  ('camera', 'red-commercial', 'RED Commercial Precision', 'High-precision commercial visuals, sharp and vibrant', 2, '/presets/preset-red.jpg'),
  ('camera', 'sony-venice-night', 'Sony Venice Night Clean', 'Low-light optimized, clean shadows, rich color depth', 3, '/presets/preset-sony.jpg'),
  ('camera', 'anamorphic-film', 'Anamorphic Film Look', 'Widescreen cinematic with oval bokeh and lens flares', 4, '/presets/preset-anamorphic.jpg'),
  ('camera', 'documentary-street', 'Documentary Street Realism', 'Raw authentic documentary style, natural grain', 5, '/presets/preset-documentary.jpg');

-- 9. Seed existing focal length presets
INSERT INTO public.preset_configs (preset_type, preset_key, label, description, sort_order, preview_image_url) VALUES
  ('focal', '14mm', '14mm Ultra Wide', 'Dramatic ultra-wide perspective with visible distortion', 1, '/presets/focal-14mm.jpg'),
  ('focal', '24mm', '24mm Wide', 'Classic wide angle, minimal distortion', 2, '/presets/focal-24mm.jpg'),
  ('focal', '35mm', '35mm Standard', 'Natural perspective, versatile for most shots', 3, '/presets/focal-35mm.jpg'),
  ('focal', '50mm', '50mm Classic', 'Human eye perspective, natural compression', 4, '/presets/focal-50mm.jpg'),
  ('focal', '85mm', '85mm Portrait', 'Flattering compression, shallow depth of field', 5, '/presets/focal-85mm.jpg'),
  ('focal', '135mm', '135mm Telephoto', 'Strong background compression, isolated subjects', 6, '/presets/focal-135mm.jpg');

-- 10. Seed existing aperture presets
INSERT INTO public.preset_configs (preset_type, preset_key, label, description, sort_order, preview_image_url) VALUES
  ('aperture', 'f1.4', 'f/1.4 Ultra Wide', 'Extremely shallow depth of field, dreamy bokeh', 1, '/presets/aperture-f14.jpg'),
  ('aperture', 'f2.0', 'f/2.0 Wide', 'Shallow depth with more focus tolerance', 2, '/presets/aperture-f20.jpg'),
  ('aperture', 'f2.8', 'f/2.8 Standard', 'Cinema standard, balanced separation', 3, '/presets/aperture-f28.jpg'),
  ('aperture', 'f4.0', 'f/4.0 Moderate', 'Moderate depth, sharp across subjects', 4, '/presets/aperture-f40.jpg'),
  ('aperture', 'f5.6', 'f/5.6 Deep', 'Deep focus, good for scenes with multiple planes', 5, '/presets/aperture-f56.jpg'),
  ('aperture', 'f8.0', 'f/8.0 Maximum', 'Maximum depth of field, everything in focus', 6, '/presets/aperture-f80.jpg');

-- 11. Insert prompt blocks for camera presets
INSERT INTO public.preset_prompt_blocks (preset_id, camera_body, lens_type, sensor_format, optics_behavior_text, color_science_text, sharpness_profile_text, realism_guard_text)
SELECT 
  id,
  CASE preset_key
    WHEN 'arri-natural' THEN 'ARRI Alexa Mini LF'
    WHEN 'red-commercial' THEN 'RED V-RAPTOR 8K VV'
    WHEN 'sony-venice-night' THEN 'Sony VENICE 2'
    WHEN 'anamorphic-film' THEN 'ARRI Alexa 65'
    WHEN 'documentary-street' THEN 'Sony FX6'
  END,
  CASE preset_key
    WHEN 'arri-natural' THEN 'Cooke S4/i'
    WHEN 'red-commercial' THEN 'Zeiss Supreme Prime'
    WHEN 'sony-venice-night' THEN 'Sony CineAlta'
    WHEN 'anamorphic-film' THEN 'Panavision C-Series Anamorphic'
    WHEN 'documentary-street' THEN 'Canon K35'
  END,
  CASE preset_key
    WHEN 'arri-natural' THEN 'Large Format'
    WHEN 'red-commercial' THEN 'Vista Vision 8K'
    WHEN 'sony-venice-night' THEN 'Full Frame 6K'
    WHEN 'anamorphic-film' THEN '65mm'
    WHEN 'documentary-street' THEN 'Super 35mm'
  END,
  CASE preset_key
    WHEN 'arri-natural' THEN 'natural depth of field consistent with large-format cinema sensors, organic focus falloff, gentle bokeh rendering with minimal optical aberrations'
    WHEN 'red-commercial' THEN 'razor-sharp focus plane with precise depth transitions, clinical sharpness with controlled chromatic behavior'
    WHEN 'sony-venice-night' THEN 'exceptional low-light sensitivity, clean shadow separation, minimal noise in underexposed areas'
    WHEN 'anamorphic-film' THEN 'oval bokeh, horizontal lens flares, characteristic 2.39:1 squeeze look, edge softness with center sharpness'
    WHEN 'documentary-street' THEN 'handheld organic movement feel, natural vignetting, authentic street photography look'
  END,
  CASE preset_key
    WHEN 'arri-natural' THEN 'ARRI Alexa color science, soft highlight roll-off, rich mid-tones, natural skin rendering without over-saturation'
    WHEN 'red-commercial' THEN 'RED IPP2 color science, vibrant saturated colors, punchy contrast, commercial-grade color separation'
    WHEN 'sony-venice-night' THEN 'Sony S-Gamut3.Cine, extended dynamic range in shadows, neutral color base, clean highlights'
    WHEN 'anamorphic-film' THEN 'vintage film color response, warm amber highlights, cool shadow tones, nostalgic color grading'
    WHEN 'documentary-street' THEN 'neutral documentary color, authentic skin tones, minimal color manipulation, raw natural look'
  END,
  CASE preset_key
    WHEN 'arri-natural' THEN 'moderate sharpness, organic micro-texture, filmic grain structure'
    WHEN 'red-commercial' THEN 'ultra-sharp, pixel-level detail, clinical precision'
    WHEN 'sony-venice-night' THEN 'balanced sharpness, noise-aware processing, clean detail retention'
    WHEN 'anamorphic-film' THEN 'center sharpness with soft edges, vintage lens character'
    WHEN 'documentary-street' THEN 'natural sharpness, authentic texture, documentary grain'
  END,
  CASE preset_key
    WHEN 'arri-natural' THEN 'cinematic photorealism, real optics behavior, no AI enhancement artifacts, authentic film look'
    WHEN 'red-commercial' THEN 'commercial photorealism, product-accurate colors, no fantasy elements, advertising quality'
    WHEN 'sony-venice-night' THEN 'night photography realism, natural low-light behavior, no artificial brightening'
    WHEN 'anamorphic-film' THEN 'film era authenticity, optical imperfections are features, classic cinema aesthetic'
    WHEN 'documentary-street' THEN 'documentary truth, unmanipulated reality, photojournalistic integrity'
  END
FROM public.preset_configs 
WHERE preset_type = 'camera';

-- 12. Insert prompt blocks for focal length presets
INSERT INTO public.preset_prompt_blocks (preset_id, physics_description)
SELECT 
  id,
  CASE preset_key
    WHEN '14mm' THEN 'extreme wide-angle perspective with pronounced barrel distortion at edges, dramatic spatial exaggeration, subjects appear stretched when close to frame edges, vast environmental context, architectural and landscape emphasis'
    WHEN '24mm' THEN 'wide perspective with minimal distortion, natural spatial representation, good for establishing shots, environmental portraiture context, classic cinematography standard'
    WHEN '35mm' THEN 'natural perspective closest to human vision, minimal spatial distortion, versatile framing, balanced between environmental and subject focus, documentary standard'
    WHEN '50mm' THEN 'neutral perspective matching human eye perception, natural compression, flattering for portraits, subtle background separation, classic narrative cinematography'
    WHEN '85mm' THEN 'portrait-optimized compression, flattering facial proportions, smooth background separation, intimate subject isolation, shallow depth rendering'
    WHEN '135mm' THEN 'telephoto compression, strong background blur, isolated subjects, compressed spatial planes, dramatic separation between foreground and background'
  END
FROM public.preset_configs 
WHERE preset_type = 'focal';

-- 13. Insert prompt blocks for aperture presets
INSERT INTO public.preset_prompt_blocks (preset_id, physics_description)
SELECT 
  id,
  CASE preset_key
    WHEN 'f1.4' THEN 'extremely shallow depth of field, razor-thin focus plane, dreamy bokeh rendering, subject isolation in busy environments, cinematic intimacy'
    WHEN 'f2.0' THEN 'shallow depth of field with slightly more focus tolerance, beautiful bokeh, good subject-background separation, portrait-optimized'
    WHEN 'f2.8' THEN 'cinema standard depth of field, natural background softness, professional focus falloff, balanced sharpness and separation'
    WHEN 'f4.0' THEN 'moderate depth of field, sharp across primary subject, subtle background softening, versatile focus range'
    WHEN 'f5.6' THEN 'deeper focus range, multiple focal planes sharp, controlled background blur, good for group compositions'
    WHEN 'f8.0' THEN 'maximum depth of field, near-to-far sharpness, minimal bokeh, environmental clarity, landscape and architectural standard'
  END
FROM public.preset_configs 
WHERE preset_type = 'aperture';

-- 14. Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_preset_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_preset_configs_updated_at
BEFORE UPDATE ON public.preset_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_preset_configs_updated_at();
-- Fix function search path for update_preset_configs_updated_at
CREATE OR REPLACE FUNCTION public.update_preset_configs_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
-- Drop the existing check constraint on preset_type to allow 'angle'
ALTER TABLE public.preset_configs DROP CONSTRAINT IF EXISTS preset_configs_preset_type_check;

-- Add camera_angle column to generation_queue
ALTER TABLE public.generation_queue 
ADD COLUMN IF NOT EXISTS camera_angle text DEFAULT 'eye-level';

-- Add camera_angle column to generation_jobs
ALTER TABLE public.generation_jobs 
ADD COLUMN IF NOT EXISTS camera_angle text DEFAULT 'eye-level';

-- Insert 10 camera angle presets into preset_configs
INSERT INTO public.preset_configs (preset_key, preset_type, label, description, is_active, sort_order)
VALUES 
  ('eye-level', 'angle', 'Eye Level', 'Ângulo neutro na altura dos olhos, perspectiva natural e imersiva', true, 1),
  ('low-angle', 'angle', 'Low Angle', 'Ângulo baixo olhando para cima, enfatiza poder e dominância', true, 2),
  ('high-angle', 'angle', 'High Angle', 'Ângulo alto olhando para baixo, cria vulnerabilidade e diminui presença', true, 3),
  ('dutch-angle', 'angle', 'Dutch Angle', 'Eixo inclinado criando linha de horizonte diagonal, tensão e desorientação', true, 4),
  ('birds-eye', 'angle', 'Bird''s Eye', 'Vista aérea extrema olhando diretamente para baixo, perspectiva de deus', true, 5),
  ('worms-eye', 'angle', 'Worm''s Eye', 'Ângulo extremamente baixo do nível do chão, verticalidade dramática', true, 6),
  ('over-shoulder', 'angle', 'Over the Shoulder', 'Câmera posicionada atrás do ombro de um personagem, estabelece relação espacial', true, 7),
  ('pov', 'angle', 'Point of View', 'Perspectiva em primeira pessoa, câmera representa o ponto de vista do personagem', true, 8),
  ('close-up', 'angle', 'Close Up', 'Enquadramento fechado em rosto ou objeto, enfatiza emoção e detalhe', true, 9),
  ('wide-shot', 'angle', 'Wide Shot', 'Plano aberto mostrando ambiente completo e sujeito em contexto', true, 10)
ON CONFLICT (preset_key, preset_type) DO NOTHING;

-- Insert prompt blocks for each angle preset
INSERT INTO public.preset_prompt_blocks (preset_id, physics_description)
SELECT pc.id, 
  CASE pc.preset_key
    WHEN 'eye-level' THEN 'Standard eye-level camera angle, natural perspective at subject''s eye height, neutral and immersive framing that creates direct connection with viewer, no vertical distortion'
    WHEN 'low-angle' THEN 'Low angle shot looking upward at the subject, camera positioned below eye level tilted up, emphasizes power, dominance and heroic presence, vertical lines converge upward, subject appears larger and more imposing'
    WHEN 'high-angle' THEN 'High angle shot looking down at the subject, camera positioned above eye level tilted down, creates sense of vulnerability and diminished presence, subject appears smaller and less powerful, reveals more of ground plane'
    WHEN 'dutch-angle' THEN 'Dutch angle with tilted camera axis creating diagonal horizon line, suggests psychological tension, disorientation and unease, world appears off-kilter, commonly used for suspense and instability'
    WHEN 'birds-eye' THEN 'Extreme overhead bird''s eye view shot looking straight down from above, god''s-eye perspective, reveals spatial relationships and geometric patterns, subject appears flattened, provides omniscient viewpoint'
    WHEN 'worms-eye' THEN 'Extreme low angle worm''s eye view from ground level looking straight up, dramatic verticality and architectural emphasis, sky visible above subject, creates sense of awe and monumental scale'
    WHEN 'over-shoulder' THEN 'Over the shoulder shot with camera positioned behind one character looking past their shoulder, establishes spatial relationship between characters, commonly used in dialogue scenes, creates sense of perspective and depth'
    WHEN 'pov' THEN 'First-person point of view shot, camera represents character''s exact subjective viewpoint, highly immersive and personal perspective, viewer sees exactly what character sees, hands or body parts may be visible'
    WHEN 'close-up' THEN 'Tight close-up framing on face or specific object, fills frame with subject detail, emphasizes emotion, reaction and subtle nuances, isolates subject from environment, creates intimacy'
    WHEN 'wide-shot' THEN 'Wide establishing shot showing full environment with subject in context, emphasizes location, scale and spatial relationships, provides geographic orientation, subject appears smaller within larger scene'
  END
FROM public.preset_configs pc
WHERE pc.preset_type = 'angle'
AND NOT EXISTS (
  SELECT 1 FROM public.preset_prompt_blocks ppb WHERE ppb.preset_id = pc.id
);
-- 1. Adicionar coluna film_look nas tabelas de geração
ALTER TABLE generation_queue ADD COLUMN IF NOT EXISTS film_look TEXT;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS film_look TEXT;

-- 2. Inserir 20 presets de Film Look com paletas DISTINTAS
INSERT INTO preset_configs (preset_key, preset_type, label, description, sort_order, is_active) VALUES
('blade-runner-2049', 'film_look', 'Blade Runner 2049', 'Orange/teal neon fog, Roger Deakins dystopia', 1, true),
('the-matrix', 'film_look', 'The Matrix', 'Green digital tint, cyberpunk high contrast', 2, true),
('sin-city', 'film_look', 'Sin City', 'B&W noir with selective red color pops', 3, true),
('grand-budapest-hotel', 'film_look', 'Grand Budapest Hotel', 'Wes Anderson pastels, symmetrical candy', 4, true),
('mad-max-fury-road', 'film_look', 'Mad Max: Fury Road', 'Bleached orange, crushed blacks, dust', 5, true),
('moonlight', 'film_look', 'Moonlight', 'Deep blues and purples, intimate night', 6, true),
('her', 'film_look', 'Her', 'Warm pastels, soft orange nostalgia', 7, true),
('drive', 'film_look', 'Drive', 'Neon pink/cyan, synthwave noir', 8, true),
('amelie', 'film_look', 'Amélie', 'Vibrant yellow/green, whimsical Paris', 9, true),
('the-revenant', 'film_look', 'The Revenant', 'Icy blue, raw natural light, wilderness', 10, true),
('joker', 'film_look', 'Joker', 'Dirty browns/greens, 70s urban decay', 11, true),
('la-la-land', 'film_look', 'La La Land', 'Saturated primaries, golden hour magic', 12, true),
('dune-2021', 'film_look', 'Dune', 'Golden desert, cool interiors, epic scale', 13, true),
('midsommar', 'film_look', 'Midsommar', 'Bright daylight horror, floral whites', 14, true),
('the-neon-demon', 'film_look', 'The Neon Demon', 'Saturated reds/magentas, fashion nightmare', 15, true),
('suspiria', 'film_look', 'Suspiria', 'Giallo primary colors, Italian horror', 16, true),
('in-the-mood-for-love', 'film_look', 'In the Mood for Love', 'Deep reds, Wong Kar-wai romance', 17, true),
('the-lighthouse', 'film_look', 'The Lighthouse', 'Grainy B&W, claustrophobic 1.19:1', 18, true),
('akira', 'film_look', 'Akira', 'Anime neon, Tokyo night cyberpunk', 19, true),
('barbie', 'film_look', 'Barbie', 'Hot pink saturated, plastic dreamhouse', 20, true);

-- 3. Inserir prompt blocks detalhados para cada filme (usando subselects)
INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'Blade Runner 2049 cinematography: dominant orange and teal color palette throughout the entire frame, thick volumetric fog with neon light bleeding through atmosphere, Roger Deakins lighting style with silhouetted subjects against glowing diffused backgrounds, crushed black levels with lifted shadows in teal, lens flares from practical neon sources, dystopian neo-noir mood, futuristic urban decay aesthetic, anamorphic lens characteristics'
FROM preset_configs WHERE preset_key = 'blade-runner-2049' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'The Matrix cinematography: distinctive green color cast over entire image simulating CRT monitor phosphors, high contrast with deep blacks, cyberpunk digital aesthetic, green-tinted highlights, desaturated skin tones with green undertones, sharp digital clarity, noir lighting with hard shadows, 1999 tech aesthetic'
FROM preset_configs WHERE preset_key = 'the-matrix' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'Sin City visual style: extreme high contrast black and white, film noir aesthetic, selective color elements in bright red or yellow against monochrome, harsh shadows with no midtones, comic book inspired lighting, rain-slicked surfaces reflecting white highlights, graphic novel composition'
FROM preset_configs WHERE preset_key = 'sin-city' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'Wes Anderson Grand Budapest Hotel palette: pastel pink and lavender walls, mint green and peach accents, perfectly symmetrical framing, candy-colored production design, vintage European elegance, muted but saturated pastels, storybook aesthetic, whimsical dollhouse quality'
FROM preset_configs WHERE preset_key = 'grand-budapest-hotel' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'Mad Max Fury Road grading: extreme orange desert tones with teal shadows, bleached highlights blown to white, crushed blacks in shadows, dust particles catching orange light, apocalyptic heat distortion, high saturation oranges, desaturated everything else, survival intensity'
FROM preset_configs WHERE preset_key = 'mad-max-fury-road' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'Moonlight cinematography by James Laxton: deep ocean blues and purples dominating night scenes, rich true blacks, intimate close-up warmth on skin tones, naturalistic but stylized, moonlight reflecting on dark skin, melancholic beauty, Miami night atmosphere'
FROM preset_configs WHERE preset_key = 'moonlight' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'Her movie aesthetic: warm soft pastels throughout, peachy oranges and creamy whites, nostalgic haze filter, slightly overexposed highlights, retro-futuristic warmth, lonely romanticism, soft focus edges, melancholic sunshine, Spike Jonze visual poetry'
FROM preset_configs WHERE preset_key = 'her' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'Drive movie aesthetic: neon pink and cyan lighting against deep black shadows, synthwave visual style, 80s Los Angeles night, reflective wet streets, hot pink signage bleeding into frame, chrome reflections, ultra-stylized noir, Nicolas Winding Refn neon noir'
FROM preset_configs WHERE preset_key = 'drive' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'Amélie Poulain color grading: warm golden yellows and olive greens dominating, Parisian whimsy, saturated but cozy, vintage French aesthetic, playful color enhancement, storybook warmth, Jean-Pierre Jeunet fantastical realism'
FROM preset_configs WHERE preset_key = 'amelie' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'The Revenant cinematography by Emmanuel Lubezki: icy blue-gray natural light, overcast sky diffusion, raw wilderness cold, breath visible in air, snow reflecting pale blue, minimal color grading preserving natural tones, survival realism, golden hour used sparingly for warmth contrast'
FROM preset_configs WHERE preset_key = 'the-revenant' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'Joker 2019 color grading: gritty 1970s New York aesthetic, dirty yellows and muddy greens, urban decay browns, desaturated except for Joker makeup colors, Taxi Driver and King of Comedy inspired, grimy fluorescent lighting, film grain texture'
FROM preset_configs WHERE preset_key = 'joker' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'La La Land cinematography: bold saturated primary colors especially in costumes, magic hour golden light, romantic purple twilight skies, classic Hollywood musical vibrancy, dreamlike glow on faces, jewel tones against night sky, Technicolor homage'
FROM preset_configs WHERE preset_key = 'la-la-land' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'Dune 2021 cinematography by Greig Fraser: golden desert sand tones, cool steel-blue interiors, epic scale with tiny human figures, IMAX grandeur, desaturated but rich, atmospheric dust particles, harsh sunlight with deep shadows, futuristic brutalist architecture'
FROM preset_configs WHERE preset_key = 'dune-2021' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'Midsommar visual style: bright daylight horror, overexposed whites, Swedish midsummer eternal sunshine, floral whites and yellows, unsettling clarity, no shadows to hide in, folk horror pastoral beauty, psychedelic subtle distortions, Ari Aster brightness as horror'
FROM preset_configs WHERE preset_key = 'midsommar' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'The Neon Demon aesthetic: extreme saturated reds magentas and electric blues, fashion photography nightmare, glossy reflective surfaces, beauty industry horror, strobe lighting effects, runway model lighting, Nicolas Winding Refn color extremism'
FROM preset_configs WHERE preset_key = 'the-neon-demon' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'Suspiria 1977 Dario Argento Giallo style: extreme primary color lighting in reds blues and greens, Italian horror expressionism, theatrical colored gels on all light sources, gothic fairy tale nightmare, saturated to surreal levels, every frame a painting'
FROM preset_configs WHERE preset_key = 'suspiria' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'In the Mood for Love Wong Kar-wai aesthetic: deep romantic reds from cheongsam dresses, smoky Hong Kong atmosphere, slow motion rain, nostalgic 1960s elegance, Christopher Doyle cinematography, unrequited love melancholy, warm lamp lighting, curtain shadows'
FROM preset_configs WHERE preset_key = 'in-the-mood-for-love' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'The Lighthouse 2019 aesthetic: orthochromatic black and white film look, extreme 1.19:1 aspect ratio feeling, heavy film grain, 1890s photography simulation, harsh contrast, foggy maritime atmosphere, madness-inducing claustrophobia, Robert Eggers period authenticity'
FROM preset_configs WHERE preset_key = 'the-lighthouse' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'Akira anime aesthetic: vibrant neon reds and blues against black Tokyo night, 1988 cyberpunk animation style, motorcycle light trails, urban dystopia, hand-painted cel animation colors, Japanese cyberpunk, detailed night city backgrounds, Katsuhiro Otomo vision'
FROM preset_configs WHERE preset_key = 'akira' AND preset_type = 'film_look';

INSERT INTO preset_prompt_blocks (preset_id, physics_description)
SELECT id, 'Barbie 2023 movie aesthetic: hyper-saturated hot pink dominating every surface, plastic dreamhouse perfection, candy-colored everything, Barbie pink with Ken blue accents, artificial studio lighting, impossibly perfect, Greta Gerwig maximalist pink fantasy'
FROM preset_configs WHERE preset_key = 'barbie' AND preset_type = 'film_look';
UPDATE preset_prompt_blocks 
SET physics_description = 'The Lighthouse 2019 aesthetic: orthochromatic black and white film look, heavy film grain, 1890s photography simulation, harsh contrast with deep blacks and bright whites, foggy maritime atmosphere, claustrophobic framing, madness-inducing tension, Robert Eggers period authenticity, salt-worn textures'
WHERE preset_id = (
  SELECT id FROM preset_configs 
  WHERE preset_key = 'the-lighthouse' 
  AND preset_type = 'film_look'
);
-- Add blocking columns to entitlements table
ALTER TABLE public.entitlements
ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_reason text,
ADD COLUMN IF NOT EXISTS blocked_at timestamp with time zone;

-- Create credit_purchases table for one-off credit purchases
CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text UNIQUE,
  package_id text NOT NULL,
  credits_purchased integer NOT NULL,
  amount_paid integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view their own credit purchases"
ON public.credit_purchases
FOR SELECT
USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role full access on credit_purchases"
ON public.credit_purchases
FOR ALL
USING (auth.role() = 'service_role');
-- Fix claim_entitlements_for_user to properly handle PRO (10 credits) and PRO+ (100 credits) tiers
-- The function was hardcoded to give 100 credits for 'pro' plan, but now we need to respect credits_to_grant

CREATE OR REPLACE FUNCTION public.claim_entitlements_for_user()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _user_email text;
  _pending record;
  _result json;
  _credits_to_apply integer;
  _monthly_allowance integer;
BEGIN
  -- Get the authenticated user
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated', 'claimed', false);
  END IF;
  
  -- Get user email from auth.users
  SELECT email INTO _user_email
  FROM auth.users
  WHERE id = _user_id;
  
  IF _user_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User email not found', 'claimed', false);
  END IF;
  
  -- Check for pending entitlements - case insensitive, status active or pending
  SELECT * INTO _pending
  FROM public.pending_entitlements
  WHERE lower(email) = lower(_user_email)
    AND status IN ('active', 'pending', 'inactive');
  
  IF NOT FOUND THEN
    -- No pending entitlements, ensure defaults exist
    INSERT INTO public.entitlements (user_id, plan, status)
    VALUES (_user_id, 'free', 'inactive')
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO public.credit_wallet (user_id, credits_balance, monthly_allowance)
    VALUES (_user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN json_build_object(
      'success', true, 
      'claimed', false, 
      'message', 'No pending entitlements found',
      'email_checked', _user_email
    );
  END IF;
  
  -- Calculate credits and allowance based on plan
  -- PRO (Circle) = 10 credits, PRO+ = 100 credits
  -- Use credits_to_grant directly (set by webhook: 10 for pro, 100 for proplus)
  IF _pending.plan IN ('pro', 'proplus') THEN
    _credits_to_apply := _pending.credits_to_grant;
    _monthly_allowance := _pending.credits_to_grant;
  ELSE
    _credits_to_apply := _pending.credits_to_grant;
    _monthly_allowance := 0;
  END IF;
  
  -- Claim the pending entitlements
  
  -- Create stripe_customers mapping
  INSERT INTO public.stripe_customers (user_id, stripe_customer_id, email)
  VALUES (_user_id, _pending.stripe_customer_id, _user_email)
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    email = EXCLUDED.email;
  
  -- Create/update entitlements with active status for paid users
  INSERT INTO public.entitlements (user_id, stripe_customer_id, stripe_subscription_id, plan, status)
  VALUES (
    _user_id, 
    _pending.stripe_customer_id, 
    _pending.stripe_subscription_id, 
    _pending.plan, 
    CASE WHEN _pending.plan IN ('pro', 'proplus') THEN 'active' ELSE _pending.status END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    updated_at = now();
  
  -- Create/update credit_wallet with correct credits for tier
  INSERT INTO public.credit_wallet (user_id, credits_balance, monthly_allowance)
  VALUES (_user_id, _credits_to_apply, _monthly_allowance)
  ON CONFLICT (user_id) DO UPDATE SET
    credits_balance = EXCLUDED.credits_balance,
    monthly_allowance = EXCLUDED.monthly_allowance,
    updated_at = now();
  
  -- Also update subscriptions table for backward compatibility
  INSERT INTO public.subscriptions (user_id, plan, status, stripe_customer_id, stripe_subscription_id)
  VALUES (
    _user_id,
    _pending.plan,
    'active'::subscription_status,
    _pending.stripe_customer_id,
    _pending.stripe_subscription_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    updated_at = now();
  
  -- Also update user_credits table for backward compatibility
  INSERT INTO public.user_credits (user_id, available)
  VALUES (_user_id, _credits_to_apply)
  ON CONFLICT (user_id) DO UPDATE SET
    available = EXCLUDED.available,
    updated_at = now();
  
  -- Delete the pending entitlement (claimed successfully)
  DELETE FROM public.pending_entitlements WHERE lower(email) = lower(_user_email);
  
  RETURN json_build_object(
    'success', true, 
    'claimed', true, 
    'plan_applied', _pending.plan,
    'credits_applied', _credits_to_apply,
    'monthly_allowance', _monthly_allowance,
    'stripe_customer_id', _pending.stripe_customer_id
  );
END;
$function$;
-- Drop the existing check constraint
ALTER TABLE entitlements DROP CONSTRAINT entitlements_plan_check;

-- Add new check constraint with proplus option
ALTER TABLE entitlements ADD CONSTRAINT entitlements_plan_check 
CHECK (plan = ANY (ARRAY['free'::text, 'pro'::text, 'proplus'::text]));

-- Table to store user API keys securely
CREATE TABLE public.user_api_keys (
  user_id uuid PRIMARY KEY,
  gemini_api_key text NOT NULL,
  is_valid boolean DEFAULT false,
  last_validated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS: users can only manage their own keys
CREATE POLICY "Users can manage their own API keys"
  ON public.user_api_keys FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on user_api_keys"
  ON public.user_api_keys FOR ALL
  USING (auth.role() = 'service_role');

-- Add use_user_key flag to generation_queue
ALTER TABLE public.generation_queue
  ADD COLUMN use_user_key boolean DEFAULT false;

-- Add use_user_key flag to generation_jobs
ALTER TABLE public.generation_jobs
  ADD COLUMN use_user_key boolean DEFAULT false;

-- =============================================
-- STORYBOARD MODULE - 3 NEW ISOLATED TABLES
-- =============================================

-- 1. storyboard_projects
CREATE TABLE public.storyboard_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Novo Storyboard',
  canvas_state jsonb DEFAULT '{"zoom": 1, "panX": 0, "panY": 0}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.storyboard_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own storyboard projects"
  ON public.storyboard_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own storyboard projects"
  ON public.storyboard_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own storyboard projects"
  ON public.storyboard_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own storyboard projects"
  ON public.storyboard_projects FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_storyboard_projects_updated_at
  BEFORE UPDATE ON public.storyboard_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. storyboard_scenes
CREATE TABLE public.storyboard_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.storyboard_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Nova Cena',
  description text,
  position_x double precision NOT NULL DEFAULT 100,
  position_y double precision NOT NULL DEFAULT 100,
  width double precision NOT NULL DEFAULT 360,
  height double precision NOT NULL DEFAULT 300,
  filters jsonb DEFAULT '{"character_consistency": false, "environment_continuity": false, "avoid_distortions": false, "cinematic_camera": false, "natural_movement": false}'::jsonb,
  generated_prompt text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.storyboard_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own storyboard scenes"
  ON public.storyboard_scenes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own storyboard scenes"
  ON public.storyboard_scenes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own storyboard scenes"
  ON public.storyboard_scenes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own storyboard scenes"
  ON public.storyboard_scenes FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_storyboard_scenes_updated_at
  BEFORE UPDATE ON public.storyboard_scenes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. storyboard_scene_images
CREATE TABLE public.storyboard_scene_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid NOT NULL REFERENCES public.storyboard_scenes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  image_id uuid,
  image_url text,
  master_url text,
  prompt text,
  role text NOT NULL DEFAULT 'main_frame',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.storyboard_scene_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own storyboard scene images"
  ON public.storyboard_scene_images FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own storyboard scene images"
  ON public.storyboard_scene_images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own storyboard scene images"
  ON public.storyboard_scene_images FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own storyboard scene images"
  ON public.storyboard_scene_images FOR DELETE
  USING (auth.uid() = user_id);
ALTER TABLE public.storyboard_scenes ADD COLUMN duration integer NOT NULL DEFAULT 5;
ALTER TABLE public.generation_queue ADD COLUMN IF NOT EXISTS sequence_mode boolean DEFAULT false;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS sequence_mode boolean DEFAULT false;

ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS is_story6 boolean DEFAULT false;
ALTER TABLE public.user_generated_images ADD COLUMN IF NOT EXISTS is_story6 boolean DEFAULT false;

-- Add animation_prompts array to storyboard_scenes for storing generated animation prompt cards
ALTER TABLE public.storyboard_scenes
ADD COLUMN animation_prompts jsonb DEFAULT '[]'::jsonb;

-- Add is_grid flag to storyboard_scene_images so we know if the source image was a Grid
ALTER TABLE public.storyboard_scene_images
ADD COLUMN is_grid boolean DEFAULT false;
DROP FUNCTION IF EXISTS public.add_credits(uuid, numeric, text, text);
DROP FUNCTION IF EXISTS public.deduct_credits(uuid, numeric, text, text, uuid, text);
DROP FUNCTION IF EXISTS public.has_sufficient_credits(uuid, numeric);
UPDATE storage.buckets SET public = true WHERE id = 'storyboard-images';

-- A) New columns on storyboard_scenes
ALTER TABLE public.storyboard_scenes
  ADD COLUMN IF NOT EXISTS prompt_base text,
  ADD COLUMN IF NOT EXISTS aspect_ratio text NOT NULL DEFAULT '16:9',
  ADD COLUMN IF NOT EXISTS style_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- B) New table: storyboard_scene_references
CREATE TABLE public.storyboard_scene_references (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scene_id uuid NOT NULL REFERENCES public.storyboard_scenes(id) ON DELETE CASCADE,
  image_id uuid NOT NULL REFERENCES public.user_generated_images(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.storyboard_scene_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scene references"
  ON public.storyboard_scene_references FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scene references"
  ON public.storyboard_scene_references FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scene references"
  ON public.storyboard_scene_references FOR DELETE
  USING (auth.uid() = user_id);

-- C) New table: storyboard_scene_connections
CREATE TABLE public.storyboard_scene_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_scene_id uuid NOT NULL REFERENCES public.storyboard_scenes(id) ON DELETE CASCADE,
  to_scene_id uuid NOT NULL REFERENCES public.storyboard_scenes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.storyboard_scene_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scene connections"
  ON public.storyboard_scene_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scene connections"
  ON public.storyboard_scene_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scene connections"
  ON public.storyboard_scene_connections FOR DELETE
  USING (auth.uid() = user_id);

-- D) Add is_primary to storyboard_scene_images
ALTER TABLE public.storyboard_scene_images
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- Update existing role values from start_frame/end_frame to generated
UPDATE public.storyboard_scene_images
  SET role = 'generated'
  WHERE role IN ('start_frame', 'end_frame', 'main_frame');

-- Set default role to 'generated'
ALTER TABLE public.storyboard_scene_images
  ALTER COLUMN role SET DEFAULT 'generated';
ALTER TABLE public.storyboard_scenes 
  ADD COLUMN parent_scene_id uuid REFERENCES public.storyboard_scenes(id) ON DELETE SET NULL,
  ADD COLUMN inherit_style boolean NOT NULL DEFAULT true;
