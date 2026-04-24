
-- ==========================================
-- MIGRATION: 20251002224023_36a949e1-26bf-4524-8bd0-1fccd73ed6c1.sql
-- ==========================================
-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM (
  'garcom',
  'garconete',
  'atendente',
  'lider',
  'cozinheiro',
  'cozinheiro_lider',
  'auxiliar_cozinha',
  'barman',
  'lider_bar',
  'admin'
);

-- Create enum for checklist status
CREATE TYPE public.checklist_status AS ENUM ('ok', 'nok', 'pendente');

-- Create enum for checklist area
CREATE TYPE public.checklist_area AS ENUM ('loja', 'cozinha', 'bar');

-- Create enum for shift type
CREATE TYPE public.shift_type AS ENUM ('abertura', 'fechamento');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create trigger for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'garcom')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create checklist types table
CREATE TABLE public.checklist_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  area checklist_area NOT NULL,
  turno shift_type NOT NULL,
  allowed_roles user_role[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on checklist_types
ALTER TABLE public.checklist_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view checklist types"
  ON public.checklist_types FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage checklist types"
  ON public.checklist_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create checklist items table
CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_type_id UUID NOT NULL REFERENCES public.checklist_types(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on checklist_items
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view checklist items"
  ON public.checklist_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage checklist items"
  ON public.checklist_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create checklist responses table
CREATE TABLE public.checklist_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  checklist_type_id UUID NOT NULL REFERENCES public.checklist_types(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status checklist_status NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(checklist_item_id, user_id, data)
);

-- Enable RLS on checklist_responses
ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own responses"
  ON public.checklist_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own responses"
  ON public.checklist_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses for today"
  ON public.checklist_responses FOR UPDATE
  USING (auth.uid() = user_id AND data = CURRENT_DATE);

CREATE POLICY "Admins can view all responses"
  ON public.checklist_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default checklist types
INSERT INTO public.checklist_types (nome, area, turno, allowed_roles) VALUES
  ('Abertura Loja', 'loja', 'abertura', ARRAY['garcom', 'garconete', 'atendente', 'lider']::user_role[]),
  ('Fechamento Loja', 'loja', 'fechamento', ARRAY['garcom', 'garconete', 'atendente', 'lider']::user_role[]),
  ('Abertura Cozinha', 'cozinha', 'abertura', ARRAY['cozinheiro', 'cozinheiro_lider', 'auxiliar_cozinha']::user_role[]),
  ('Fechamento Cozinha', 'cozinha', 'fechamento', ARRAY['cozinheiro', 'cozinheiro_lider', 'auxiliar_cozinha']::user_role[]),
  ('Abertura Bar', 'bar', 'abertura', ARRAY['barman', 'lider_bar', 'lider']::user_role[]),
  ('Fechamento Bar', 'bar', 'fechamento', ARRAY['barman', 'lider_bar', 'lider']::user_role[]);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- MIGRATION: 20251002235608_13876a82-efa4-4192-b1fd-1173057fce51.sql
-- ==========================================
-- Fix infinite recursion in profiles RLS by creating separate user_roles table

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Admins can manage checklist types" ON public.checklist_types;
DROP POLICY IF EXISTS "Everyone can view checklist types" ON public.checklist_types;

DROP POLICY IF EXISTS "Admins can manage checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Everyone can view checklist items" ON public.checklist_items;

DROP POLICY IF EXISTS "Admins can view all responses" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can insert their own responses" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can update their own responses for today" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can view their own responses" ON public.checklist_responses;

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Recreate profiles policies without recursion
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Recreate checklist_types policies
CREATE POLICY "Everyone can view checklist types"
ON public.checklist_types
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage checklist types"
ON public.checklist_types
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Recreate checklist_items policies
CREATE POLICY "Everyone can view checklist items"
ON public.checklist_items
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage checklist items"
ON public.checklist_items
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Recreate checklist_responses policies
CREATE POLICY "Users can view their own responses"
ON public.checklist_responses
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all responses"
ON public.checklist_responses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own responses"
ON public.checklist_responses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses for today"
ON public.checklist_responses
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND data = CURRENT_DATE);

-- Update the trigger function to also insert into user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role_val user_role;
BEGIN
  -- Get the role from metadata, default to 'garcom'
  user_role_val := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'garcom');
  
  -- Insert into profiles
  INSERT INTO public.profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    user_role_val
  );
  
  -- Insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_val);
  
  RETURN NEW;
END;
$function$;

-- ==========================================
-- MIGRATION: 20251003002528_b3aa37ee-227b-4b8d-a0ad-effed333e4ab.sql
-- ==========================================
-- Create storage bucket for checklist photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist-photos', 'checklist-photos', true);

-- Create RLS policies for the bucket
CREATE POLICY "Users can upload their own checklist photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'checklist-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own checklist photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'checklist-photos' AND
  (
    auth.uid()::text = (storage.foldername(name))[1] OR
    has_role(auth.uid(), 'admin'::user_role)
  )
);

CREATE POLICY "Users can update their own checklist photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'checklist-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own checklist photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'checklist-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add photo_url column to checklist_responses
ALTER TABLE public.checklist_responses
ADD COLUMN photo_url TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN public.checklist_responses.photo_url IS 'URL of the photo evidence uploaded by the user';

-- ==========================================
-- MIGRATION: 20251003005448_6b851d5e-5b37-4182-bfb8-dc0f37c8b733.sql
-- ==========================================
-- Create admin_settings table for notification configuration
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_email text NOT NULL,
  notification_time time NOT NULL DEFAULT '18:00:00',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage settings"
ON public.admin_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Create trigger for updated_at
CREATE TRIGGER update_admin_settings_updated_at
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- MIGRATION: 20251003005750_cadb38bb-42fe-448c-9071-1e71c628ce18.sql
-- ==========================================
-- Drop existing table to recreate with new structure
DROP TABLE IF EXISTS public.admin_settings CASCADE;

-- Create improved admin_settings table
CREATE TABLE public.admin_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_email text NOT NULL,
  notification_time_abertura time NOT NULL DEFAULT '09:00:00',
  notification_time_fechamento time NOT NULL DEFAULT '18:00:00',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create table to map checklists to notification schedules
CREATE TABLE public.checklist_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_type_id uuid NOT NULL REFERENCES public.checklist_types(id) ON DELETE CASCADE,
  turno shift_type NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(checklist_type_id, turno)
);

-- Enable RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for admin_settings
CREATE POLICY "Admins can manage settings"
ON public.admin_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Policies for checklist_notifications
CREATE POLICY "Admins can manage checklist notifications"
ON public.checklist_notifications
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Everyone can view checklist notifications"
ON public.checklist_notifications
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_admin_settings_updated_at
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- MIGRATION: 20251003010134_4e222019-66fb-4e48-a6f2-caa9530a6579.sql
-- ==========================================
-- Update shift_type enum to include new values
ALTER TYPE shift_type RENAME TO shift_type_old;

CREATE TYPE shift_type AS ENUM ('manha', 'tarde', 'noite');

-- Update admin_settings table
ALTER TABLE public.admin_settings 
  DROP COLUMN IF EXISTS notification_time_abertura,
  DROP COLUMN IF EXISTS notification_time_fechamento,
  ADD COLUMN notification_time_manha time NOT NULL DEFAULT '09:00:00',
  ADD COLUMN notification_time_tarde time NOT NULL DEFAULT '14:00:00',
  ADD COLUMN notification_time_noite time NOT NULL DEFAULT '22:00:00';

-- Update checklist_notifications table
ALTER TABLE public.checklist_notifications 
  ALTER COLUMN turno TYPE shift_type USING 
    CASE 
      WHEN turno::text = 'abertura' THEN 'manha'::shift_type
      WHEN turno::text = 'fechamento' THEN 'noite'::shift_type
      ELSE 'tarde'::shift_type
    END;

-- Update checklist_types table
ALTER TABLE public.checklist_types
  ALTER COLUMN turno TYPE shift_type USING
    CASE
      WHEN turno::text = 'abertura' THEN 'manha'::shift_type
      WHEN turno::text = 'fechamento' THEN 'noite'::shift_type
      ELSE 'tarde'::shift_type
    END;

-- Drop old enum
DROP TYPE shift_type_old;

-- ==========================================
-- MIGRATION: 20251003010522_e7e97dac-deb7-4f28-9405-77fc73fcb84c.sql
-- ==========================================
-- First, let's check current state and update accordingly
DO $$ 
BEGIN
  -- Update shift_type enum
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_type') THEN
    ALTER TYPE shift_type RENAME TO shift_type_old;
  END IF;
END $$;

CREATE TYPE shift_type AS ENUM ('manha', 'tarde', 'noite');

-- Update admin_settings columns
ALTER TABLE public.admin_settings 
  DROP COLUMN IF EXISTS notification_time_abertura,
  DROP COLUMN IF EXISTS notification_time_fechamento;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_settings' 
                 AND column_name = 'notification_time_manha') THEN
    ALTER TABLE public.admin_settings ADD COLUMN notification_time_manha time NOT NULL DEFAULT '09:00:00';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_settings' 
                 AND column_name = 'notification_time_tarde') THEN
    ALTER TABLE public.admin_settings ADD COLUMN notification_time_tarde time NOT NULL DEFAULT '14:00:00';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_settings' 
                 AND column_name = 'notification_time_noite') THEN
    ALTER TABLE public.admin_settings ADD COLUMN notification_time_noite time NOT NULL DEFAULT '22:00:00';
  END IF;
END $$;

-- Update checklist_notifications turno column
ALTER TABLE public.checklist_notifications 
  ALTER COLUMN turno TYPE shift_type USING 
    CASE 
      WHEN turno::text = 'abertura' THEN 'manha'::shift_type
      WHEN turno::text = 'fechamento' THEN 'noite'::shift_type
      WHEN turno::text = 'manha' THEN 'manha'::shift_type
      WHEN turno::text = 'tarde' THEN 'tarde'::shift_type
      WHEN turno::text = 'noite' THEN 'noite'::shift_type
      ELSE 'tarde'::shift_type
    END;

-- Update checklist_types turno column
ALTER TABLE public.checklist_types
  ALTER COLUMN turno TYPE shift_type USING
    CASE
      WHEN turno::text = 'abertura' THEN 'manha'::shift_type
      WHEN turno::text = 'fechamento' THEN 'noite'::shift_type
      WHEN turno::text = 'manha' THEN 'manha'::shift_type
      WHEN turno::text = 'tarde' THEN 'tarde'::shift_type
      WHEN turno::text = 'noite' THEN 'noite'::shift_type
      ELSE 'tarde'::shift_type
    END;

-- Drop old enum if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_type_old') THEN
    DROP TYPE shift_type_old;
  END IF;
END $$;

-- ==========================================
-- MIGRATION: 20251003011107_0ce8fb3a-0730-47bb-930c-c8f03db9346f.sql
-- ==========================================
-- Create stores table
CREATE TABLE public.stores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Everyone can view stores
CREATE POLICY "Everyone can view stores"
ON public.stores
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can manage stores
CREATE POLICY "Admins can manage stores"
ON public.stores
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Insert the three stores
INSERT INTO public.stores (nome) VALUES
  ('Bendito Boteco - Pedra Branca'),
  ('Bendito Boteco - Mercadoteca'),
  ('Z Smash Burger');

-- Add store_id to profiles
ALTER TABLE public.profiles 
  ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

-- Add store_id to checklist_types
ALTER TABLE public.checklist_types 
  ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

-- Add store_id to checklist_items  
ALTER TABLE public.checklist_items 
  ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

-- Add store_id to checklist_responses
ALTER TABLE public.checklist_responses 
  ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

-- Create trigger for stores updated_at
CREATE TRIGGER update_stores_updated_at
BEFORE UPDATE ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update existing data to use first store (Bendito Boteco - Pedra Branca)
DO $$
DECLARE
  first_store_id uuid;
BEGIN
  SELECT id INTO first_store_id FROM public.stores WHERE nome = 'Bendito Boteco - Pedra Branca' LIMIT 1;
  
  UPDATE public.profiles SET store_id = first_store_id WHERE store_id IS NULL;
  UPDATE public.checklist_types SET store_id = first_store_id WHERE store_id IS NULL;
  UPDATE public.checklist_items SET store_id = first_store_id WHERE store_id IS NULL;
  UPDATE public.checklist_responses SET store_id = first_store_id WHERE store_id IS NULL;
END $$;

-- Make store_id NOT NULL after populating
ALTER TABLE public.profiles ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.checklist_types ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.checklist_items ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.checklist_responses ALTER COLUMN store_id SET NOT NULL;

-- Update RLS policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles in same store"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins can update profiles in same store"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can insert profiles in same store"
ON public.profiles
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

-- Update RLS policies for checklist_types
DROP POLICY IF EXISTS "Everyone can view checklist types" ON public.checklist_types;
DROP POLICY IF EXISTS "Admins can manage checklist types" ON public.checklist_types;

CREATE POLICY "Users can view checklist types in same store"
ON public.checklist_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can manage checklist types in same store"
ON public.checklist_types
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

-- Update RLS policies for checklist_items
DROP POLICY IF EXISTS "Everyone can view checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Admins can manage checklist items" ON public.checklist_items;

CREATE POLICY "Users can view checklist items in same store"
ON public.checklist_items
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can manage checklist items in same store"
ON public.checklist_items
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

-- Update RLS policies for checklist_responses
DROP POLICY IF EXISTS "Users can view their own responses" ON public.checklist_responses;
DROP POLICY IF EXISTS "Admins can view all responses" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can insert their own responses" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can update their own responses for today" ON public.checklist_responses;

CREATE POLICY "Users can view their own responses in same store"
ON public.checklist_responses
FOR SELECT
USING (
  auth.uid() = user_id AND
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can view all responses in same store"
ON public.checklist_responses
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can insert responses in same store"
ON public.checklist_responses
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can update their own responses in same store"
ON public.checklist_responses
FOR UPDATE
USING (
  auth.uid() = user_id AND
  data = CURRENT_DATE AND
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

-- ==========================================
-- MIGRATION: 20251003011522_43c90ae2-60d5-4c41-9e31-434e270ef091.sql
-- ==========================================
-- Create security definer function to get user's store_id
CREATE OR REPLACE FUNCTION public.get_user_store_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Drop and recreate policies for profiles without recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in same store" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in same store" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles in same store" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles in same store"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins can update profiles in same store"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Admins can insert profiles in same store"
ON public.profiles
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

-- Update policies for checklist_types
DROP POLICY IF EXISTS "Users can view checklist types in same store" ON public.checklist_types;
DROP POLICY IF EXISTS "Admins can manage checklist types in same store" ON public.checklist_types;

CREATE POLICY "Users can view checklist types in same store"
ON public.checklist_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Admins can manage checklist types in same store"
ON public.checklist_types
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

-- Update policies for checklist_items
DROP POLICY IF EXISTS "Users can view checklist items in same store" ON public.checklist_items;
DROP POLICY IF EXISTS "Admins can manage checklist items in same store" ON public.checklist_items;

CREATE POLICY "Users can view checklist items in same store"
ON public.checklist_items
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Admins can manage checklist items in same store"
ON public.checklist_items
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

-- Update policies for checklist_responses
DROP POLICY IF EXISTS "Users can view their own responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Admins can view all responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can insert responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can update their own responses in same store" ON public.checklist_responses;

CREATE POLICY "Users can view their own responses in same store"
ON public.checklist_responses
FOR SELECT
USING (
  auth.uid() = user_id AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Admins can view all responses in same store"
ON public.checklist_responses
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Users can insert responses in same store"
ON public.checklist_responses
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Users can update their own responses in same store"
ON public.checklist_responses
FOR UPDATE
USING (
  auth.uid() = user_id AND
  data = CURRENT_DATE AND
  store_id = get_user_store_id(auth.uid())
);

-- ==========================================
-- MIGRATION: 20251003011539_81baa4d5-7348-4d65-9610-cad5379023e6.sql
-- ==========================================
-- Create security definer function to get user's store_id
CREATE OR REPLACE FUNCTION public.get_user_store_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Drop and recreate policies for profiles without recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in same store" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in same store" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles in same store" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles in same store"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins can update profiles in same store"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Admins can insert profiles in same store"
ON public.profiles
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

-- Update policies for checklist_types
DROP POLICY IF EXISTS "Users can view checklist types in same store" ON public.checklist_types;
DROP POLICY IF EXISTS "Admins can manage checklist types in same store" ON public.checklist_types;

CREATE POLICY "Users can view checklist types in same store"
ON public.checklist_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Admins can manage checklist types in same store"
ON public.checklist_types
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

-- Update policies for checklist_items
DROP POLICY IF EXISTS "Users can view checklist items in same store" ON public.checklist_items;
DROP POLICY IF EXISTS "Admins can manage checklist items in same store" ON public.checklist_items;

CREATE POLICY "Users can view checklist items in same store"
ON public.checklist_items
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Admins can manage checklist items in same store"
ON public.checklist_items
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

-- Update policies for checklist_responses
DROP POLICY IF EXISTS "Users can view their own responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Admins can view all responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can insert responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can update their own responses in same store" ON public.checklist_responses;

CREATE POLICY "Users can view their own responses in same store"
ON public.checklist_responses
FOR SELECT
USING (
  auth.uid() = user_id AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Admins can view all responses in same store"
ON public.checklist_responses
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Users can insert responses in same store"
ON public.checklist_responses
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Users can update their own responses in same store"
ON public.checklist_responses
FOR UPDATE
USING (
  auth.uid() = user_id AND
  data = CURRENT_DATE AND
  store_id = get_user_store_id(auth.uid())
);

-- ==========================================
-- MIGRATION: 20251003012011_5367521d-5aa8-415f-a84c-bc076945bcc7.sql
-- ==========================================
-- First, let's check what data we have
-- The issue is that RLS policies are allowing users to see data from all stores

-- Let's recreate the policies to be more restrictive
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view checklist types in same store" ON public.checklist_types;
DROP POLICY IF EXISTS "Admins can manage checklist types in same store" ON public.checklist_types;

-- Recreate with proper filtering - users can ONLY see their own store
CREATE POLICY "Users can view checklist types in same store"
ON public.checklist_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  store_id = get_user_store_id(auth.uid())
);

-- Admins can manage ONLY in their own store
CREATE POLICY "Admins can manage checklist types in same store"
ON public.checklist_types
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

-- Same for checklist_items
DROP POLICY IF EXISTS "Users can view checklist items in same store" ON public.checklist_items;
DROP POLICY IF EXISTS "Admins can manage checklist items in same store" ON public.checklist_items;

CREATE POLICY "Users can view checklist items in same store"
ON public.checklist_items
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Admins can manage checklist items in same store"
ON public.checklist_items
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

-- Check current data distribution
DO $$
DECLARE
  store_count INTEGER;
  pb_store_id UUID;
  mc_store_id UUID;
  zs_store_id UUID;
BEGIN
  -- Get store IDs
  SELECT id INTO pb_store_id FROM public.stores WHERE nome = 'Bendito Boteco - Pedra Branca';
  SELECT id INTO mc_store_id FROM public.stores WHERE nome = 'Bendito Boteco - Mercadoteca';
  SELECT id INTO zs_store_id FROM public.stores WHERE nome = 'Z Smash Burger';
  
  -- Log current distribution
  RAISE NOTICE 'Bendito Boteco - Pedra Branca ID: %', pb_store_id;
  RAISE NOTICE 'Bendito Boteco - Mercadoteca ID: %', mc_store_id;
  RAISE NOTICE 'Z Smash Burger ID: %', zs_store_id;
  
  SELECT COUNT(*) INTO store_count FROM public.checklist_types WHERE store_id = pb_store_id;
  RAISE NOTICE 'Bendito Boteco - Pedra Branca has % checklists', store_count;
  
  SELECT COUNT(*) INTO store_count FROM public.checklist_types WHERE store_id = mc_store_id;
  RAISE NOTICE 'Bendito Boteco - Mercadoteca has % checklists', store_count;
  
  SELECT COUNT(*) INTO store_count FROM public.checklist_types WHERE store_id = zs_store_id;
  RAISE NOTICE 'Z Smash Burger has % checklists', store_count;
END $$;

-- ==========================================
-- MIGRATION: 20251003012058_6aad4b9a-1d1e-4b68-b66b-4122051181d8.sql
-- ==========================================
-- The issue is conceptual: we need to allow admins to manage ALL stores
-- Not just their own store. Let's fix the policies for admins.

-- Update policies to allow admins to see and manage ALL stores
DROP POLICY IF EXISTS "Admins can view all profiles in same store" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in same store" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles in same store" ON public.profiles;

-- Admins can view profiles from any store
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- Admins can update profiles from any store
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::user_role));

-- Admins can insert profiles for any store
CREATE POLICY "Admins can insert all profiles"
ON public.profiles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Update checklist_types policies for admins
DROP POLICY IF EXISTS "Users can view checklist types in same store" ON public.checklist_types;
DROP POLICY IF EXISTS "Admins can manage checklist types in same store" ON public.checklist_types;

-- Regular users see only their store's checklists
CREATE POLICY "Users can view checklist types in same store"
ON public.checklist_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  (
    has_role(auth.uid(), 'admin'::user_role) OR
    store_id = get_user_store_id(auth.uid())
  )
);

-- Admins can manage all stores' checklists
CREATE POLICY "Admins can manage all checklist types"
ON public.checklist_types
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Update checklist_items policies
DROP POLICY IF EXISTS "Users can view checklist items in same store" ON public.checklist_items;
DROP POLICY IF EXISTS "Admins can manage checklist items in same store" ON public.checklist_items;

CREATE POLICY "Users can view checklist items in same store"
ON public.checklist_items
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  (
    has_role(auth.uid(), 'admin'::user_role) OR
    store_id = get_user_store_id(auth.uid())
  )
);

CREATE POLICY "Admins can manage all checklist items"
ON public.checklist_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Update checklist_responses policies
DROP POLICY IF EXISTS "Users can view their own responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Admins can view all responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can insert responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can update their own responses in same store" ON public.checklist_responses;

CREATE POLICY "Users can view their own responses"
ON public.checklist_responses
FOR SELECT
USING (
  auth.uid() = user_id OR
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Admins can view all responses"
ON public.checklist_responses
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can insert their own responses"
ON public.checklist_responses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses"
ON public.checklist_responses
FOR UPDATE
USING (
  auth.uid() = user_id AND
  data = CURRENT_DATE
);

-- ==========================================
-- MIGRATION: 20251003012847_0087f997-5c96-425e-9153-503e9b6010fd.sql
-- ==========================================
-- Create table for email whitelist/invites
CREATE TABLE IF NOT EXISTS public.email_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  invited_by uuid REFERENCES auth.users(id),
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  used_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.email_invites ENABLE ROW LEVEL SECURITY;

-- Only admins can manage email invites
CREATE POLICY "Admins can manage email invites"
ON public.email_invites
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Create function to check if email is invited
CREATE OR REPLACE FUNCTION public.is_email_invited(user_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.email_invites 
    WHERE email = user_email 
    AND used = false
  );
$$;

-- Update the handle_new_user function to check for invites
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role_val user_role;
  user_store_id uuid;
  invite_record RECORD;
BEGIN
  -- Check if email is invited
  SELECT * INTO invite_record
  FROM public.email_invites
  WHERE email = NEW.email AND used = false
  LIMIT 1;
  
  -- If no invite found, reject the signup
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Email não autorizado. Solicite um convite ao administrador.';
  END IF;
  
  -- Get role and store from invite
  user_role_val := invite_record.role;
  user_store_id := invite_record.store_id;
  
  -- Insert into profiles
  INSERT INTO public.profiles (id, nome, email, role, store_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    user_role_val,
    user_store_id
  );
  
  -- Insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_val);
  
  -- Mark invite as used
  UPDATE public.email_invites
  SET used = true, used_at = NOW()
  WHERE id = invite_record.id;
  
  RETURN NEW;
END;
$function$;

-- ==========================================
-- MIGRATION: 20251003013249_6d3994d4-6ee8-4b6d-80a5-210117e0b9a7.sql
-- ==========================================
-- Create table for email whitelist/invites if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'email_invites') THEN
    CREATE TABLE public.email_invites (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      email text NOT NULL UNIQUE,
      store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
      role user_role NOT NULL,
      invited_by uuid REFERENCES auth.users(id),
      used boolean DEFAULT false,
      created_at timestamp with time zone DEFAULT now(),
      used_at timestamp with time zone
    );
    
    ALTER TABLE public.email_invites ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Admins can manage email invites" ON public.email_invites;

-- Create policy
CREATE POLICY "Admins can manage email invites"
ON public.email_invites
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Create function to check if email is invited
CREATE OR REPLACE FUNCTION public.is_email_invited(user_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.email_invites 
    WHERE email = user_email 
    AND used = false
  );
$$;

-- Update the handle_new_user function to check for invites
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role_val user_role;
  user_store_id uuid;
  invite_record RECORD;
BEGIN
  -- Check if email is invited
  SELECT * INTO invite_record
  FROM public.email_invites
  WHERE email = NEW.email AND used = false
  LIMIT 1;
  
  -- If no invite found, reject the signup
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Email não autorizado. Solicite um convite ao administrador.';
  END IF;
  
  -- Get role and store from invite
  user_role_val := invite_record.role;
  user_store_id := invite_record.store_id;
  
  -- Insert into profiles
  INSERT INTO public.profiles (id, nome, email, role, store_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    user_role_val,
    user_store_id
  );
  
  -- Insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_val);
  
  -- Mark invite as used
  UPDATE public.email_invites
  SET used = true, used_at = NOW()
  WHERE id = invite_record.id;
  
  RETURN NEW;
END;
$function$;

-- ==========================================
-- MIGRATION: 20251003020640_02336dc0-231f-4404-beb2-55e7fa0cce33.sql
-- ==========================================
-- CRITICAL SECURITY FIX: Remove role from profiles table to prevent privilege escalation

-- 1. Create security definer function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = _user_id 
  LIMIT 1;
$$;

-- 2. Update handle_new_user function to only insert into user_roles (not profiles.role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_val user_role;
  user_store_id uuid;
  invite_record RECORD;
BEGIN
  -- Check if email is invited
  SELECT * INTO invite_record
  FROM public.email_invites
  WHERE email = NEW.email AND used = false
  LIMIT 1;
  
  -- If no invite found, reject the signup
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Email não autorizado. Solicite um convite ao administrador.';
  END IF;
  
  -- Get role and store from invite
  user_role_val := invite_record.role;
  user_store_id := invite_record.store_id;
  
  -- Insert into profiles WITHOUT role (SECURITY FIX)
  INSERT INTO public.profiles (id, nome, email, store_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    user_store_id
  );
  
  -- Insert into user_roles (role stored ONLY here)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_val);
  
  -- Mark invite as used
  UPDATE public.email_invites
  SET used = true, used_at = NOW()
  WHERE id = invite_record.id;
  
  RETURN NEW;
END;
$$;

-- 3. Fix update_updated_at_column to have proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4. Drop the role column from profiles table (CRITICAL FIX)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- 5. Add column-level UPDATE restrictions on profiles table
-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create restrictive update policy that only allows updating specific columns
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  -- Ensure critical fields cannot be changed
  id = (SELECT id FROM public.profiles WHERE id = auth.uid()) AND
  email = (SELECT email FROM public.profiles WHERE id = auth.uid()) AND
  store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

-- 6. Add store_id to admin_settings for better isolation
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

-- Update admin_settings RLS policy to check store_id
DROP POLICY IF EXISTS "Admins can manage settings" ON public.admin_settings;

CREATE POLICY "Admins can manage settings"
ON public.admin_settings
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  (store_id IS NULL OR store_id = get_user_store_id(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  (store_id IS NULL OR store_id = get_user_store_id(auth.uid()))
);

-- ==========================================
-- MIGRATION: 20251003182725_6921ab9d-86f5-4ebf-99fb-50d80775e4fa.sql
-- ==========================================
-- Fix profiles table: Consolidate SELECT policies into one explicit policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile, admins can view all" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = id) OR has_role(auth.uid(), 'admin'::user_role)
);

-- Fix email_invites table: Add explicit SELECT policy
CREATE POLICY "Only admins can view email invites" 
ON public.email_invites 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role));

-- Fix admin_settings table: Add explicit SELECT policy
CREATE POLICY "Only admins can view admin settings" 
ON public.admin_settings 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role));

-- ==========================================
-- MIGRATION: 20251003191015_3938321d-4e9e-41fa-b811-4ef3f9ee5615.sql
-- ==========================================
-- Add columns to checklist_items to configure if observation and photo are required
ALTER TABLE public.checklist_items
ADD COLUMN requer_observacao boolean NOT NULL DEFAULT false,
ADD COLUMN requer_foto boolean NOT NULL DEFAULT false;

-- ==========================================
-- MIGRATION: 20251003193326_045e19c1-03d5-4f64-9237-2127b94071a7.sql
-- ==========================================
-- Reset observation and photo fields for all existing checklist items
UPDATE public.checklist_items
SET requer_observacao = false, requer_foto = false;

-- ==========================================
-- MIGRATION: 20251003201028_e2dd5e82-baab-444c-b106-08c0bf5ed1fa.sql
-- ==========================================
-- Fix email exposure in profiles table
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view own profile, admins can view all" ON public.profiles;

-- Create a new policy that only allows users to see their own email
-- and admins to see emails only for users in their own store
CREATE POLICY "Users can view own profile, admins can view store profiles"
ON public.profiles
FOR SELECT
USING (
  (auth.uid() = id) 
  OR 
  (
    has_role(auth.uid(), 'admin'::user_role) 
    AND store_id = get_user_store_id(auth.uid())
  )
);

-- Also restrict the stores table so users can only see their own store
DROP POLICY IF EXISTS "Everyone can view stores" ON public.stores;

CREATE POLICY "Users can view their own store"
ON public.stores
FOR SELECT
USING (
  (auth.uid() IS NOT NULL) 
  AND 
  (
    id = get_user_store_id(auth.uid())
    OR has_role(auth.uid(), 'admin'::user_role)
  )
);

-- ==========================================
-- MIGRATION: 20251005215656_64154474-0aac-41c3-912c-bfa897413d23.sql
-- ==========================================
-- Create edge function to delete users (requires service role)
-- This will be called from the frontend and will delete the user from auth.users
-- as well as cascade delete from profiles and user_roles

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_store_id uuid;
  caller_store_id uuid;
BEGIN
  -- Get the store_id of the target user
  SELECT store_id INTO target_store_id
  FROM public.profiles
  WHERE id = target_user_id;

  -- Get the store_id of the caller
  SELECT store_id INTO caller_store_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- Verify caller is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  -- Verify both users are in the same store
  IF target_store_id IS NULL OR caller_store_id IS NULL OR target_store_id != caller_store_id THEN
    RAISE EXCEPTION 'Você só pode excluir usuários da sua loja';
  END IF;

  -- Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta';
  END IF;

  -- Delete from user_roles (will cascade from profiles due to FK)
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- Delete from profiles (this will NOT cascade to auth.users)
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Delete from auth.users using admin API
  -- Note: This requires the auth.users table modification or using service role via RPC
  -- For now we'll use a workaround by calling auth admin delete
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário excluído com sucesso'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$;

-- ==========================================
-- MIGRATION: 20251016170615_4770a1ca-11bc-4553-80d1-185c369a3688.sql
-- ==========================================
-- Update RLS policy for checklist_responses to allow admins to view ALL responses across all stores
DROP POLICY IF EXISTS "Admins can view all responses" ON checklist_responses;

CREATE POLICY "Admins can view all responses across all stores" 
ON checklist_responses 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::user_role)
);

-- Also update the policy for viewing profiles across stores
DROP POLICY IF EXISTS "Users can view own profile, admins can view store profiles" ON profiles;

CREATE POLICY "Users can view own profile, admins can view all profiles" 
ON profiles 
FOR SELECT 
USING (
  (auth.uid() = id) OR has_role(auth.uid(), 'admin'::user_role)
);

-- ==========================================
-- MIGRATION: 20251017022031_a798e3e8-2f24-445c-8701-db9b4ca8a4a2.sql
-- ==========================================
-- Adicionar coluna para registrar horário de conclusão do checklist
ALTER TABLE public.checklist_responses
ADD COLUMN completed_at timestamp with time zone;

-- Atualizar registros existentes para usar created_at como completed_at
UPDATE public.checklist_responses
SET completed_at = created_at
WHERE completed_at IS NULL;

-- ==========================================
-- MIGRATION: 20251031163317_e63992db-867f-479c-aa2f-33ef87e6f597.sql
-- ==========================================
-- Fix hardcoded credentials in trigger_checklist_notification function
-- Use Supabase vault to securely store and retrieve credentials

-- Recreate the function to use vault for credentials
CREATE OR REPLACE FUNCTION public.trigger_checklist_notification(turno_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  anon_key text;
BEGIN
  -- Retrieve credentials from vault or use current project environment
  -- Since this is calling an internal edge function, we use the project's own credentials
  SELECT decrypted_secret INTO anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  
  -- Fallback to environment-based retrieval if vault is empty
  -- This uses pg_net's ability to access Supabase project context
  IF supabase_url IS NULL THEN
    supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;
  
  IF anon_key IS NULL THEN
    anon_key := current_setting('app.settings.supabase_anon_key', true);
  END IF;

  -- Call the edge function with proper authentication
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-checklist-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object('turno', turno_param)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger notification: %', SQLERRM;
END;
$$;

-- ==========================================
-- MIGRATION: 20251031164119_c63a452f-401b-4d07-bfce-e7fb86c03b5f.sql
-- ==========================================
-- Make checklist-photos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'checklist-photos';

-- Add RLS policies for storage.objects
CREATE POLICY "Users can upload their own photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'checklist-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'checklist-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'checklist-photos' AND
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'checklist-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ==========================================
-- MIGRATION: 20251031173905_d885c1da-d543-4987-aecf-28a729f000d2.sql
-- ==========================================
-- Etapa 1: Adicionar super_admin ao enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- ==========================================
-- MIGRATION: 20251031174058_43df29eb-cf8c-45fc-83c4-ddc2024412ca.sql
-- ==========================================
-- Etapa 3: Atualizar Políticas RLS para suportar super_admin

-- 3.1 Admin Settings
DROP POLICY IF EXISTS "Admins can manage settings" ON admin_settings;
CREATE POLICY "Admins can manage settings" ON admin_settings
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  (has_role(auth.uid(), 'admin'::user_role) AND (store_id IS NULL OR store_id = get_user_store_id(auth.uid())))
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  (has_role(auth.uid(), 'admin'::user_role) AND (store_id IS NULL OR store_id = get_user_store_id(auth.uid())))
);

-- 3.2 Checklist Types
DROP POLICY IF EXISTS "Admins can manage all checklist types" ON checklist_types;
CREATE POLICY "Admins can manage all checklist types" ON checklist_types
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

-- 3.3 Checklist Items
DROP POLICY IF EXISTS "Admins can manage all checklist items" ON checklist_items;
CREATE POLICY "Admins can manage all checklist items" ON checklist_items
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

-- 3.4 Stores
DROP POLICY IF EXISTS "Admins can manage stores" ON stores;
DROP POLICY IF EXISTS "Users can view their own store" ON stores;

CREATE POLICY "Admins and super_admins can manage stores" ON stores
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Users can view stores" ON stores
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin'::user_role) OR
    id = get_user_store_id(auth.uid())
  )
);

-- 3.5 Profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles" ON profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

-- 3.6 Checklist Responses
DROP POLICY IF EXISTS "Admins can view all responses across all stores" ON checklist_responses;
CREATE POLICY "Admins can view all responses" ON checklist_responses
FOR SELECT
USING (
  auth.uid() = user_id OR
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

-- ==========================================
-- MIGRATION: 20251031182737_61b7b074-40d7-4e7b-985f-869a94c38c86.sql
-- ==========================================
-- Atualizar políticas RLS para incluir super_admin em todas as verificações

-- 1. CHECKLIST_RESPONSES - Admins podem ver todas as respostas
DROP POLICY IF EXISTS "Admins can view all responses" ON public.checklist_responses;
CREATE POLICY "Admins can view all responses" 
ON public.checklist_responses 
FOR SELECT 
USING (
  (auth.uid() = user_id) 
  OR has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 2. CHECKLIST_TYPES - Admins podem gerenciar todos os tipos
DROP POLICY IF EXISTS "Admins can manage all checklist types" ON public.checklist_types;
CREATE POLICY "Admins can manage all checklist types" 
ON public.checklist_types 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 3. CHECKLIST_TYPES - Usuários podem ver tipos da mesma loja
DROP POLICY IF EXISTS "Users can view checklist types in same store" ON public.checklist_types;
CREATE POLICY "Users can view checklist types in same store" 
ON public.checklist_types 
FOR SELECT 
USING (
  (auth.uid() IS NOT NULL) 
  AND (
    has_role(auth.uid(), 'super_admin'::user_role)
    OR has_role(auth.uid(), 'admin'::user_role) 
    OR (store_id = get_user_store_id(auth.uid()))
  )
);

-- 4. CHECKLIST_ITEMS - Admins podem gerenciar todos os itens
DROP POLICY IF EXISTS "Admins can manage all checklist items" ON public.checklist_items;
CREATE POLICY "Admins can manage all checklist items" 
ON public.checklist_items 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 5. CHECKLIST_ITEMS - Usuários podem ver itens da mesma loja
DROP POLICY IF EXISTS "Users can view checklist items in same store" ON public.checklist_items;
CREATE POLICY "Users can view checklist items in same store" 
ON public.checklist_items 
FOR SELECT 
USING (
  (auth.uid() IS NOT NULL) 
  AND (
    has_role(auth.uid(), 'super_admin'::user_role)
    OR has_role(auth.uid(), 'admin'::user_role) 
    OR (store_id = get_user_store_id(auth.uid()))
  )
);

-- 6. EMAIL_INVITES - Admins podem gerenciar convites
DROP POLICY IF EXISTS "Admins can manage email invites" ON public.email_invites;
CREATE POLICY "Admins can manage email invites" 
ON public.email_invites 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 7. EMAIL_INVITES - Ver convites
DROP POLICY IF EXISTS "Only admins can view email invites" ON public.email_invites;
CREATE POLICY "Only admins can view email invites" 
ON public.email_invites 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 8. USER_ROLES - Admins podem gerenciar roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" 
ON public.user_roles 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 9. USER_ROLES - Ver todas as roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 10. PROFILES - Admins podem atualizar todos os perfis
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 11. PROFILES - Ver perfis
DROP POLICY IF EXISTS "Users can view own profile, admins can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile, admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = id) 
  OR has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 12. PROFILES - Admins podem inserir perfis
DROP POLICY IF EXISTS "Admins can insert all profiles" ON public.profiles;
CREATE POLICY "Admins can insert all profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 13. ADMIN_SETTINGS - Admins podem gerenciar configurações
DROP POLICY IF EXISTS "Admins can manage settings" ON public.admin_settings;
CREATE POLICY "Admins can manage settings" 
ON public.admin_settings 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR (
    has_role(auth.uid(), 'admin'::user_role) 
    AND ((store_id IS NULL) OR (store_id = get_user_store_id(auth.uid())))
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR (
    has_role(auth.uid(), 'admin'::user_role) 
    AND ((store_id IS NULL) OR (store_id = get_user_store_id(auth.uid())))
  )
);

-- 14. ADMIN_SETTINGS - Ver configurações
DROP POLICY IF EXISTS "Only admins can view admin settings" ON public.admin_settings;
CREATE POLICY "Only admins can view admin settings" 
ON public.admin_settings 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 15. STORES - Admins e super_admins podem gerenciar lojas
DROP POLICY IF EXISTS "Admins and super_admins can manage stores" ON public.stores;
CREATE POLICY "Admins and super_admins can manage stores" 
ON public.stores 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 16. STORES - Usuários podem ver lojas
DROP POLICY IF EXISTS "Users can view stores" ON public.stores;
CREATE POLICY "Users can view stores" 
ON public.stores 
FOR SELECT 
USING (
  (auth.uid() IS NOT NULL) 
  AND (
    has_role(auth.uid(), 'super_admin'::user_role) 
    OR (id = get_user_store_id(auth.uid()))
  )
);

-- 17. CHECKLIST_NOTIFICATIONS - Admins podem gerenciar notificações
DROP POLICY IF EXISTS "Admins can manage checklist notifications" ON public.checklist_notifications;
CREATE POLICY "Admins can manage checklist notifications" 
ON public.checklist_notifications 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- ==========================================
-- MIGRATION: 20251031182804_9286eb3f-be13-499e-94f3-fa706e76f826.sql
-- ==========================================
-- Atualizar políticas RLS para incluir super_admin em todas as verificações

-- 1. CHECKLIST_RESPONSES - Admins podem ver todas as respostas
DROP POLICY IF EXISTS "Admins can view all responses" ON public.checklist_responses;
CREATE POLICY "Admins can view all responses" 
ON public.checklist_responses 
FOR SELECT 
USING (
  (auth.uid() = user_id) 
  OR has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 2. CHECKLIST_TYPES - Admins podem gerenciar todos os tipos
DROP POLICY IF EXISTS "Admins can manage all checklist types" ON public.checklist_types;
CREATE POLICY "Admins can manage all checklist types" 
ON public.checklist_types 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 3. CHECKLIST_TYPES - Usuários podem ver tipos da mesma loja
DROP POLICY IF EXISTS "Users can view checklist types in same store" ON public.checklist_types;
CREATE POLICY "Users can view checklist types in same store" 
ON public.checklist_types 
FOR SELECT 
USING (
  (auth.uid() IS NOT NULL) 
  AND (
    has_role(auth.uid(), 'super_admin'::user_role)
    OR has_role(auth.uid(), 'admin'::user_role) 
    OR (store_id = get_user_store_id(auth.uid()))
  )
);

-- 4. CHECKLIST_ITEMS - Admins podem gerenciar todos os itens
DROP POLICY IF EXISTS "Admins can manage all checklist items" ON public.checklist_items;
CREATE POLICY "Admins can manage all checklist items" 
ON public.checklist_items 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 5. CHECKLIST_ITEMS - Usuários podem ver itens da mesma loja
DROP POLICY IF EXISTS "Users can view checklist items in same store" ON public.checklist_items;
CREATE POLICY "Users can view checklist items in same store" 
ON public.checklist_items 
FOR SELECT 
USING (
  (auth.uid() IS NOT NULL) 
  AND (
    has_role(auth.uid(), 'super_admin'::user_role)
    OR has_role(auth.uid(), 'admin'::user_role) 
    OR (store_id = get_user_store_id(auth.uid()))
  )
);

-- 6. EMAIL_INVITES - Admins podem gerenciar convites
DROP POLICY IF EXISTS "Admins can manage email invites" ON public.email_invites;
CREATE POLICY "Admins can manage email invites" 
ON public.email_invites 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 7. EMAIL_INVITES - Ver convites
DROP POLICY IF EXISTS "Only admins can view email invites" ON public.email_invites;
CREATE POLICY "Only admins can view email invites" 
ON public.email_invites 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 8. USER_ROLES - Admins podem gerenciar roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" 
ON public.user_roles 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 9. USER_ROLES - Ver todas as roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 10. PROFILES - Admins podem atualizar todos os perfis
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 11. PROFILES - Ver perfis
DROP POLICY IF EXISTS "Users can view own profile, admins can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile, admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = id) 
  OR has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 12. PROFILES - Admins podem inserir perfis
DROP POLICY IF EXISTS "Admins can insert all profiles" ON public.profiles;
CREATE POLICY "Admins can insert all profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 13. ADMIN_SETTINGS - Admins podem gerenciar configurações
DROP POLICY IF EXISTS "Admins can manage settings" ON public.admin_settings;
CREATE POLICY "Admins can manage settings" 
ON public.admin_settings 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR (
    has_role(auth.uid(), 'admin'::user_role) 
    AND ((store_id IS NULL) OR (store_id = get_user_store_id(auth.uid())))
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR (
    has_role(auth.uid(), 'admin'::user_role) 
    AND ((store_id IS NULL) OR (store_id = get_user_store_id(auth.uid())))
  )
);

-- 14. ADMIN_SETTINGS - Ver configurações
DROP POLICY IF EXISTS "Only admins can view admin settings" ON public.admin_settings;
CREATE POLICY "Only admins can view admin settings" 
ON public.admin_settings 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 15. STORES - Admins e super_admins podem gerenciar lojas
DROP POLICY IF EXISTS "Admins and super_admins can manage stores" ON public.stores;
CREATE POLICY "Admins and super_admins can manage stores" 
ON public.stores 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 16. STORES - Usuários podem ver lojas
DROP POLICY IF EXISTS "Users can view stores" ON public.stores;
CREATE POLICY "Users can view stores" 
ON public.stores 
FOR SELECT 
USING (
  (auth.uid() IS NOT NULL) 
  AND (
    has_role(auth.uid(), 'super_admin'::user_role) 
    OR (id = get_user_store_id(auth.uid()))
  )
);

-- 17. CHECKLIST_NOTIFICATIONS - Admins podem gerenciar notificações
DROP POLICY IF EXISTS "Admins can manage checklist notifications" ON public.checklist_notifications;
CREATE POLICY "Admins can manage checklist notifications" 
ON public.checklist_notifications 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- ==========================================
-- MIGRATION: 20251031182902_db471da0-cf3f-45f3-a147-bdccda6ea5ba.sql
-- ==========================================
-- Atualizar função delete_user_account para incluir super_admin

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_store_id uuid;
  caller_store_id uuid;
  is_super_admin boolean;
BEGIN
  -- Check if caller is super_admin
  SELECT has_role(auth.uid(), 'super_admin'::user_role) INTO is_super_admin;

  -- Get the store_id of the target user
  SELECT store_id INTO target_store_id
  FROM public.profiles
  WHERE id = target_user_id;

  -- Get the store_id of the caller
  SELECT store_id INTO caller_store_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- Verify caller is admin or super_admin
  IF NOT (has_role(auth.uid(), 'admin'::user_role) OR is_super_admin) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  -- Super_admin can delete users from any store
  -- Admin can only delete users from their own store
  IF NOT is_super_admin THEN
    IF target_store_id IS NULL OR caller_store_id IS NULL OR target_store_id != caller_store_id THEN
      RAISE EXCEPTION 'Você só pode excluir usuários da sua loja';
    END IF;
  END IF;

  -- Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta';
  END IF;

  -- Delete from user_roles (will cascade from profiles due to FK)
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- Delete from profiles (this will NOT cascade to auth.users)
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Delete from auth.users using admin API
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário excluído com sucesso'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$function$;

-- ==========================================
-- MIGRATION: 20251101001706_0a3f43ab-8026-4834-ac0c-9e8096f26234.sql
-- ==========================================
-- Create audit_logs table for tracking all system actions
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL, -- 'create', 'update', 'delete', 'complete', 'export'
  resource_type TEXT NOT NULL, -- 'checklist_type', 'checklist_item', 'checklist_response', 'admin_settings', 'user', 'report'
  resource_id UUID,
  resource_name TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB
);

-- Create index for better query performance
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_store_id ON public.audit_logs(store_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs(resource_type);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view audit logs from their store"
ON public.audit_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR 
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
);

CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action_type TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_resource_name TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
  v_store_id UUID;
  v_audit_id UUID;
BEGIN
  -- Get current user info
  v_user_id := auth.uid();
  
  SELECT nome, email, store_id 
  INTO v_user_name, v_user_email, v_store_id
  FROM public.profiles
  WHERE id = v_user_id;
  
  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    user_name,
    user_email,
    store_id,
    action_type,
    resource_type,
    resource_id,
    resource_name,
    old_values,
    new_values,
    metadata
  ) VALUES (
    v_user_id,
    COALESCE(v_user_name, 'Sistema'),
    COALESCE(v_user_email, 'sistema@app.com'),
    v_store_id,
    p_action_type,
    p_resource_type,
    p_resource_id,
    p_resource_name,
    p_old_values,
    p_new_values,
    p_metadata
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- ==========================================
-- MIGRATION: 20251101004159_eeea4d46-4b1c-4685-9f1d-d30568c92f14.sql
-- ==========================================
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- System can insert notifications
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to notify admins about NOK items
CREATE OR REPLACE FUNCTION public.notify_nok_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name TEXT;
  v_checklist_name TEXT;
  v_user_name TEXT;
  v_admin RECORD;
BEGIN
  -- Only notify on NOK status
  IF NEW.status != 'nok' THEN
    RETURN NEW;
  END IF;

  -- Get item and checklist names
  SELECT ci.nome INTO v_item_name
  FROM checklist_items ci
  WHERE ci.id = NEW.checklist_item_id;

  SELECT ct.nome INTO v_checklist_name
  FROM checklist_types ct
  WHERE ct.id = NEW.checklist_type_id;

  SELECT p.nome INTO v_user_name
  FROM profiles p
  WHERE p.id = NEW.user_id;

  -- Notify all admins and super_admins in the same store
  FOR v_admin IN 
    SELECT DISTINCT p.id, p.store_id
    FROM profiles p
    INNER JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.store_id = NEW.store_id
      AND ur.role IN ('admin', 'super_admin')
  LOOP
    INSERT INTO notifications (
      user_id,
      store_id,
      type,
      title,
      message,
      data
    ) VALUES (
      v_admin.id,
      NEW.store_id,
      'nok_item',
      'Item NOK Identificado',
      v_user_name || ' marcou "' || v_item_name || '" como NOK no checklist "' || v_checklist_name || '"',
      jsonb_build_object(
        'checklist_type_id', NEW.checklist_type_id,
        'checklist_item_id', NEW.checklist_item_id,
        'response_id', NEW.id,
        'user_name', v_user_name
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger on checklist_responses
DROP TRIGGER IF EXISTS trigger_notify_nok_item ON public.checklist_responses;
CREATE TRIGGER trigger_notify_nok_item
  AFTER INSERT OR UPDATE OF status
  ON public.checklist_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_nok_item();

-- ==========================================
-- MIGRATION: 20251101005121_43c82313-a812-40fe-80b5-db1de2f15f6c.sql
-- ==========================================
-- Add unique constraint to prevent duplicate admin_settings per store
ALTER TABLE public.admin_settings 
DROP CONSTRAINT IF EXISTS admin_settings_store_id_unique;

ALTER TABLE public.admin_settings
ADD CONSTRAINT admin_settings_store_id_unique UNIQUE (store_id);

-- ==========================================
-- MIGRATION: 20251101180248_d938c07b-cd6e-4847-8504-403e9779ff6a.sql
-- ==========================================
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view own profile, admins can view all profiles" ON public.profiles;

-- Create simplified policy for users to view their own profile (no role check needed)
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create separate policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- ==========================================
-- MIGRATION: 20251101180906_d7d93b5c-e11d-4e16-a9a7-ce4df0b4cdc4.sql
-- ==========================================
-- Remover todas as políticas SELECT antigas da tabela profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles " ON public.profiles;

-- Criar UMA ÚNICA política SELECT unificada
CREATE POLICY "Allow profile access"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Usuários podem ver seu próprio perfil (sem verificação de role para evitar recursão)
  auth.uid() = id
  OR
  -- OU admins/super_admins podem ver todos os perfis
  has_role(auth.uid(), 'super_admin'::user_role)
  OR
  has_role(auth.uid(), 'admin'::user_role)
);

-- ==========================================
-- MIGRATION: 20251101181954_ce4780a4-645a-496d-ae91-32b020e6c531.sql
-- ==========================================
-- Manter bucket privado e criar RLS policies para acesso restrito a admins
-- O bucket já existe como privado, vamos apenas garantir que está privado
UPDATE storage.buckets 
SET public = false 
WHERE id = 'checklist-photos';

-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "Usuários podem fazer upload de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem visualizar suas fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem atualizar suas fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar suas fotos" ON storage.objects;

-- Policy para SELECT - apenas admin e super_admin
CREATE POLICY "Admins e super_admins podem visualizar fotos de checklist"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'checklist-photos' 
  AND (
    has_role(auth.uid(), 'admin'::user_role) 
    OR has_role(auth.uid(), 'super_admin'::user_role)
  )
);

-- Policy para INSERT - usuários autenticados podem fazer upload
CREATE POLICY "Usuários autenticados podem fazer upload de fotos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'checklist-photos' 
  AND auth.uid() IS NOT NULL
);

-- Policy para DELETE - apenas admin, super_admin ou dono
CREATE POLICY "Admins e donos podem deletar fotos de checklist"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'checklist-photos' 
  AND (
    auth.uid() = owner 
    OR has_role(auth.uid(), 'admin'::user_role)
    OR has_role(auth.uid(), 'super_admin'::user_role)
  )
);

-- ==========================================
-- MIGRATION: 20251101215518_76608584-ed84-44d8-abbf-18c1df6f3b7f.sql
-- ==========================================
-- FASE 1: Corrigir Foreign Key para preservar checklists
-- Remover constraint CASCADE atual
ALTER TABLE public.checklist_responses 
DROP CONSTRAINT IF EXISTS checklist_responses_user_id_fkey;

-- Tornar user_id nullable
ALTER TABLE public.checklist_responses 
ALTER COLUMN user_id DROP NOT NULL;

-- Adicionar nova constraint com SET NULL
ALTER TABLE public.checklist_responses 
ADD CONSTRAINT checklist_responses_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;

-- Adicionar comentário de documentação
COMMENT ON COLUMN public.checklist_responses.user_id IS 
'ID do usuário que preencheu o checklist. Pode ser NULL se o usuário foi excluído, preservando o histórico.';

-- FASE 2: Adicionar campos de auditoria
-- Adicionar colunas para preservar informações do usuário
ALTER TABLE public.checklist_responses 
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Preencher registros existentes com dados dos usuários atuais
UPDATE public.checklist_responses cr
SET 
  user_name = p.nome,
  user_email = p.email
FROM public.profiles p
WHERE cr.user_id = p.id
  AND cr.user_name IS NULL;

-- FASE 3: Criar trigger para preencher automaticamente
CREATE OR REPLACE FUNCTION public.set_response_user_info()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT nome, email 
    INTO NEW.user_name, NEW.user_email
    FROM public.profiles
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Criar trigger para BEFORE INSERT
DROP TRIGGER IF EXISTS before_insert_response_user_info ON public.checklist_responses;
CREATE TRIGGER before_insert_response_user_info
BEFORE INSERT ON public.checklist_responses
FOR EACH ROW
EXECUTE FUNCTION public.set_response_user_info();

-- ==========================================
-- MIGRATION: 20251102031717_6bc899d6-3f8e-45ae-a7f3-6ddece607323.sql
-- ==========================================
-- Corrigir políticas RLS da tabela checklist_responses

-- FASE 1: Corrigir política de INSERT
DROP POLICY IF EXISTS "Users can insert their own responses" ON public.checklist_responses;

CREATE POLICY "Users can insert their own responses"
ON public.checklist_responses
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    user_id IS NULL  -- Permite NULL durante inserção (trigger preencherá)
    OR auth.uid() = user_id  -- Ou se já estiver preenchido, deve ser o próprio usuário
  )
);

-- FASE 2: Corrigir política de UPDATE
DROP POLICY IF EXISTS "Users can update their own responses" ON public.checklist_responses;

CREATE POLICY "Users can update their own responses"
ON public.checklist_responses
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id  -- Usuário só pode editar suas próprias respostas
  AND data = CURRENT_DATE  -- Apenas respostas do dia atual
)
WITH CHECK (
  auth.uid() = user_id  -- Garantir que user_id não seja alterado para outro usuário
  AND data = CURRENT_DATE
);

-- ==========================================
-- MIGRATION: 20251102223815_eccdcbc9-6848-4683-b65b-48212be22637.sql
-- ==========================================
-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Admins and users can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;

-- Política para SELECT (visualizar/baixar fotos)
CREATE POLICY "Admins and users can view photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'checklist-photos' 
  AND (
    -- Usuário pode ver suas próprias fotos
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Admins podem ver todas as fotos
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  )
);

-- Política para INSERT (upload de fotos)
CREATE POLICY "Users can upload their own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'checklist-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para DELETE (remover fotos)
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'checklist-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ==========================================
-- MIGRATION: 20251103020149_d8ec3cdf-57d8-41b0-b5ed-c55023fbd06f.sql
-- ==========================================
-- Adicionar coluna para marcar observação como obrigatória
ALTER TABLE checklist_items 
ADD COLUMN observacao_obrigatoria boolean NOT NULL DEFAULT false;

-- ==========================================
-- MIGRATION: 20251104192807_cc4b6693-034d-4cb8-8e42-86df05828698.sql
-- ==========================================
-- 1. Criar tabela de organizações
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id UUID NOT NULL,
  UNIQUE(owner_id)
);

-- 2. Habilitar RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS para organizations
CREATE POLICY "Super_admins can view their organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid() 
  AND has_role(auth.uid(), 'super_admin'::user_role)
);

CREATE POLICY "Super_admins can manage their organization"
ON public.organizations
FOR ALL
TO authenticated
USING (
  owner_id = auth.uid() 
  AND has_role(auth.uid(), 'super_admin'::user_role)
)
WITH CHECK (
  owner_id = auth.uid() 
  AND has_role(auth.uid(), 'super_admin'::user_role)
);

-- 4. Adicionar coluna organization_id à tabela stores
ALTER TABLE public.stores 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 5. Criar organização para a usuária atual (Bendito Boteco & Z Smash)
INSERT INTO public.organizations (nome, owner_id)
VALUES ('Bendito Boteco & Z Smash', 'e7c9e1e0-8835-4b1e-b6f4-55fa1af5e495');

-- 6. Vincular as 3 lojas existentes à organização criada
UPDATE public.stores
SET organization_id = (
  SELECT id FROM public.organizations 
  WHERE owner_id = 'e7c9e1e0-8835-4b1e-b6f4-55fa1af5e495' 
  LIMIT 1
)
WHERE id IN (
  'd2118d7f-a6d2-4cea-a077-3d93a0cb5663', -- Bendito Boteco - Pedra Branca
  'ee15ca04-eb0b-4d53-96b4-b45b7e1c42f9', -- Bendito Boteco - Mercadoteca
  '9cc8182f-5502-4416-a701-05665a56088f'  -- Z Smash Burger
);

-- 7. Atualizar RLS de checklist_responses para respeitar organizações
DROP POLICY IF EXISTS "Users can view responses from their store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Admins can view all responses" ON public.checklist_responses;

CREATE POLICY "Users can view responses based on organization"
ON public.checklist_responses
FOR SELECT
TO authenticated
USING (
  -- Usuário vê suas próprias respostas
  auth.uid() = user_id
  OR
  -- Admin vê respostas da própria loja
  (
    has_role(auth.uid(), 'admin'::user_role) 
    AND store_id = get_user_store_id(auth.uid())
  )
  OR
  -- Super_admin vê respostas de TODAS as lojas da sua organização
  (
    has_role(auth.uid(), 'super_admin'::user_role)
    AND store_id IN (
      SELECT s.id 
      FROM public.stores s
      INNER JOIN public.organizations o ON o.id = s.organization_id
      WHERE o.owner_id = auth.uid()
    )
  )
);

-- 8. Atualizar RLS de stores para incluir organization_id
DROP POLICY IF EXISTS "Users can view stores" ON public.stores;

CREATE POLICY "Users can view stores based on access"
ON public.stores
FOR SELECT
TO authenticated
USING (
  -- Super_admin vê lojas da própria organização
  (
    has_role(auth.uid(), 'super_admin'::user_role)
    AND organization_id IN (
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
  )
  OR
  -- Usuários comuns veem apenas sua loja
  (id = get_user_store_id(auth.uid()))
);

-- 9. Atualizar função de clonagem para suportar organizações
CREATE OR REPLACE FUNCTION public.clone_checklists_to_store(
  source_store_id UUID,
  target_store_id UUID,
  create_new_organization BOOLEAN DEFAULT FALSE,
  new_org_name TEXT DEFAULT NULL,
  new_org_owner_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  checklist_type RECORD;
  new_checklist_id UUID;
  items_copied INTEGER := 0;
  types_copied INTEGER := 0;
  new_organization_id UUID;
  caller_org_id UUID;
  row_count_temp INTEGER;
BEGIN
  -- 1. Verificar se usuário é super_admin
  IF NOT has_role(auth.uid(), 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'Apenas super_admins podem clonar checklists';
  END IF;

  -- 2. Obter organization_id da loja origem
  SELECT organization_id INTO caller_org_id
  FROM public.stores
  WHERE id = source_store_id;

  -- 3. Verificar se loja origem pertence à organização do caller
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = caller_org_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Você só pode clonar checklists das suas próprias lojas';
  END IF;

  -- 4. Se criar nova organização
  IF create_new_organization THEN
    IF new_org_name IS NULL OR new_org_owner_id IS NULL THEN
      RAISE EXCEPTION 'Nome e owner_id são obrigatórios para nova organização';
    END IF;

    -- Criar nova organização
    INSERT INTO public.organizations (nome, owner_id)
    VALUES (new_org_name, new_org_owner_id)
    RETURNING id INTO new_organization_id;

    -- Vincular loja destino à nova organização
    UPDATE public.stores
    SET organization_id = new_organization_id
    WHERE id = target_store_id;
  ELSE
    -- Vincular loja destino à organização do caller
    UPDATE public.stores
    SET organization_id = caller_org_id
    WHERE id = target_store_id;
  END IF;

  -- 5. Clonar checklists
  FOR checklist_type IN 
    SELECT * FROM public.checklist_types 
    WHERE store_id = source_store_id
    ORDER BY created_at
  LOOP
    INSERT INTO public.checklist_types (nome, area, turno, allowed_roles, store_id)
    VALUES (
      checklist_type.nome,
      checklist_type.area,
      checklist_type.turno,
      checklist_type.allowed_roles,
      target_store_id
    )
    RETURNING id INTO new_checklist_id;
    
    types_copied := types_copied + 1;

    INSERT INTO public.checklist_items (
      checklist_type_id,
      nome,
      ordem,
      requer_observacao,
      observacao_obrigatoria,
      requer_foto,
      store_id
    )
    SELECT
      new_checklist_id,
      nome,
      ordem,
      requer_observacao,
      observacao_obrigatoria,
      requer_foto,
      target_store_id
    FROM public.checklist_items
    WHERE checklist_type_id = checklist_type.id
    ORDER BY ordem;
    
    GET DIAGNOSTICS row_count_temp = ROW_COUNT;
    items_copied := items_copied + row_count_temp;
  END LOOP;

  -- 6. Registrar auditoria
  PERFORM log_audit_event(
    p_action_type := 'clone',
    p_resource_type := 'checklists',
    p_resource_id := target_store_id,
    p_resource_name := 'Checklist Templates',
    p_metadata := jsonb_build_object(
      'source_store_id', source_store_id,
      'target_store_id', target_store_id,
      'types_copied', types_copied,
      'items_copied', items_copied,
      'new_organization', create_new_organization,
      'new_org_name', new_org_name
    )
  );

  RETURN json_build_object(
    'success', true,
    'types_copied', types_copied,
    'items_copied', items_copied,
    'message', format('Clonados %s checklists com %s itens', types_copied, items_copied)
  );
END;
$$;

-- 10. Adicionar trigger para updated_at em organizations
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- MIGRATION: 20251104194822_6490647c-ff4c-4235-9f57-48c2522de7db.sql
-- ==========================================
-- Add sent_at column to email_invites table for tracking email delivery
ALTER TABLE public.email_invites
ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE;

-- ==========================================
-- MIGRATION: 20251105135048_07ad37a8-f529-48db-9815-b20eb54600b0.sql
-- ==========================================
-- Drop existing unique constraints
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_nome_key;
ALTER TABLE public.email_invites DROP CONSTRAINT IF EXISTS email_invites_email_key;

-- Add composite unique constraints to allow duplicates across organizations
ALTER TABLE public.stores 
  ADD CONSTRAINT stores_nome_organization_key 
  UNIQUE (nome, organization_id);

ALTER TABLE public.email_invites 
  ADD CONSTRAINT email_invites_email_store_key 
  UNIQUE (email, store_id);

-- ==========================================
-- MIGRATION: 20251105144857_b6746b3f-8047-482a-9bde-9aacf25551d9.sql
-- ==========================================
-- 1. Criar tabela de roles
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_name text NOT NULL,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, name)
);

-- 2. Habilitar RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS
CREATE POLICY "Users can view roles from their store"
  ON public.roles FOR SELECT
  TO authenticated
  USING (
    store_id = get_user_store_id(auth.uid()) OR
    has_role(auth.uid(), 'super_admin'::user_role)
  );

CREATE POLICY "Admins can manage roles"
  ON public.roles FOR ALL
  TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid())) OR
    has_role(auth.uid(), 'super_admin'::user_role)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid())) OR
    has_role(auth.uid(), 'super_admin'::user_role)
  );

-- 4. Popular com roles padrão para cada loja existente
INSERT INTO public.roles (store_id, name, display_name, is_system)
SELECT 
  s.id as store_id,
  role_data.name,
  role_data.display_name,
  true as is_system
FROM stores s
CROSS JOIN (
  VALUES 
    ('garcom', 'Garçom'),
    ('garconete', 'Garçonete'),
    ('atendente', 'Atendente'),
    ('lider', 'Líder'),
    ('cozinheiro', 'Cozinheiro'),
    ('cozinheiro_lider', 'Cozinheiro Líder'),
    ('auxiliar_cozinha', 'Auxiliar de Cozinha'),
    ('barman', 'Barman'),
    ('lider_bar', 'Líder de Bar'),
    ('admin', 'Admin'),
    ('super_admin', 'Super Admin')
) AS role_data(name, display_name)
ON CONFLICT (store_id, name) DO NOTHING;

-- 5. Adicionar coluna role_id em user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE;

-- 6. Migrar dados existentes de user_roles
UPDATE public.user_roles ur
SET role_id = r.id
FROM public.roles r
JOIN public.profiles p ON p.store_id = r.store_id
WHERE ur.user_id = p.id
  AND r.name = ur.role::text
  AND ur.role_id IS NULL;

-- 7. Adicionar coluna allowed_role_ids em checklist_types
ALTER TABLE public.checklist_types ADD COLUMN IF NOT EXISTS allowed_role_ids uuid[];

-- 8. Migrar allowed_roles para allowed_role_ids
UPDATE public.checklist_types ct
SET allowed_role_ids = (
  SELECT array_agg(DISTINCT r.id)
  FROM unnest(ct.allowed_roles) AS role_name
  JOIN public.roles r ON r.name = role_name::text AND r.store_id = ct.store_id
)
WHERE ct.allowed_role_ids IS NULL;

-- 9. Criar função para criar roles padrão em novas lojas
CREATE OR REPLACE FUNCTION public.create_default_roles_for_store()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.roles (store_id, name, display_name, is_system)
  VALUES 
    (NEW.id, 'garcom', 'Garçom', true),
    (NEW.id, 'garconete', 'Garçonete', true),
    (NEW.id, 'atendente', 'Atendente', true),
    (NEW.id, 'lider', 'Líder', true),
    (NEW.id, 'cozinheiro', 'Cozinheiro', true),
    (NEW.id, 'cozinheiro_lider', 'Cozinheiro Líder', true),
    (NEW.id, 'auxiliar_cozinha', 'Auxiliar de Cozinha', true),
    (NEW.id, 'barman', 'Barman', true),
    (NEW.id, 'lider_bar', 'Líder de Bar', true),
    (NEW.id, 'admin', 'Admin', true),
    (NEW.id, 'super_admin', 'Super Admin', true)
  ON CONFLICT (store_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 10. Criar trigger para novas lojas
DROP TRIGGER IF EXISTS on_store_created_roles ON public.stores;
CREATE TRIGGER on_store_created_roles
  AFTER INSERT ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_roles_for_store();

-- 11. Criar função auxiliar para obter role_id por nome
CREATE OR REPLACE FUNCTION public.get_role_id_by_name(_store_id uuid, _role_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.roles 
  WHERE store_id = _store_id AND name = _role_name
  LIMIT 1;
$$;

-- 12. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_roles_updated_at()
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

DROP TRIGGER IF EXISTS update_roles_timestamp ON public.roles;
CREATE TRIGGER update_roles_timestamp
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_roles_updated_at();

-- ==========================================
-- MIGRATION: 20251105222041_44919dff-810f-4fb4-9786-455754d2e65f.sql
-- ==========================================
-- Create staging table for checklist items import
CREATE TABLE IF NOT EXISTS public.checklist_items_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  imported_by UUID NOT NULL REFERENCES public.profiles(id),
  nome TEXT NOT NULL,
  checklist_nome TEXT NOT NULL,
  checklist_type_id UUID REFERENCES public.checklist_types(id),
  ordem INTEGER,
  requer_observacao BOOLEAN DEFAULT false,
  observacao_obrigatoria BOOLEAN DEFAULT false,
  requer_foto BOOLEAN DEFAULT false,
  import_batch_id UUID NOT NULL,
  validation_status TEXT DEFAULT 'pending',
  validation_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staging_batch ON public.checklist_items_staging(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_staging_store ON public.checklist_items_staging(store_id);
CREATE INDEX IF NOT EXISTS idx_staging_checklist ON public.checklist_items_staging(checklist_type_id);

-- Enable RLS
ALTER TABLE public.checklist_items_staging ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage staging items"
ON public.checklist_items_staging
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

-- Create function to validate and import items from staging
CREATE OR REPLACE FUNCTION public.import_items_from_staging(p_batch_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id UUID;
  v_items_imported INTEGER := 0;
  v_checklist_stats JSONB := '[]'::jsonb;
  staging_item RECORD;
  v_max_order INTEGER;
BEGIN
  -- Get store_id from batch
  SELECT store_id INTO v_store_id
  FROM checklist_items_staging
  WHERE import_batch_id = p_batch_id
  LIMIT 1;

  -- Verify user has permission
  IF NOT (
    has_role(auth.uid(), 'super_admin'::user_role) OR
    (has_role(auth.uid(), 'admin'::user_role) AND v_store_id = get_user_store_id(auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão para importar itens';
  END IF;

  -- Process each staging item
  FOR staging_item IN 
    SELECT * FROM checklist_items_staging 
    WHERE import_batch_id = p_batch_id 
    AND validation_status = 'valid'
    ORDER BY checklist_type_id, ordem NULLS LAST
  LOOP
    -- Calculate order if not provided
    IF staging_item.ordem IS NULL THEN
      SELECT COALESCE(MAX(ordem), 0) INTO v_max_order
      FROM checklist_items
      WHERE checklist_type_id = staging_item.checklist_type_id;
      
      staging_item.ordem := v_max_order + 10;
    END IF;

    -- Insert item
    INSERT INTO checklist_items (
      checklist_type_id,
      nome,
      ordem,
      requer_observacao,
      observacao_obrigatoria,
      requer_foto,
      store_id
    ) VALUES (
      staging_item.checklist_type_id,
      staging_item.nome,
      staging_item.ordem,
      staging_item.requer_observacao,
      staging_item.observacao_obrigatoria,
      staging_item.requer_foto,
      staging_item.store_id
    );

    v_items_imported := v_items_imported + 1;
  END LOOP;

  -- Build stats
  SELECT jsonb_agg(
    jsonb_build_object(
      'checklist_id', ct.id,
      'checklist_nome', ct.nome,
      'items_added', COUNT(*)
    )
  ) INTO v_checklist_stats
  FROM checklist_items_staging s
  JOIN checklist_types ct ON ct.id = s.checklist_type_id
  WHERE s.import_batch_id = p_batch_id
  GROUP BY ct.id, ct.nome;

  -- Delete staging items
  DELETE FROM checklist_items_staging WHERE import_batch_id = p_batch_id;

  -- Log audit
  PERFORM log_audit_event(
    p_action_type := 'import',
    p_resource_type := 'checklist_items',
    p_resource_id := v_store_id,
    p_resource_name := 'Checklist Items Import',
    p_metadata := jsonb_build_object(
      'batch_id', p_batch_id,
      'items_imported', v_items_imported,
      'checklists_affected', v_checklist_stats
    )
  );

  RETURN json_build_object(
    'success', true,
    'items_imported', v_items_imported,
    'checklists_affected', v_checklist_stats
  );
END;
$$;

-- ==========================================
-- MIGRATION: 20251107003032_6b27f698-e477-4948-adc8-15360234b1e5.sql
-- ==========================================
-- ETAPA 1.1: Melhorias na tabela email_invites
-- Adicionar colunas para controle de reenvios e validade
ALTER TABLE email_invites 
ADD COLUMN IF NOT EXISTS resend_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days');

-- Criar índice para performance em consultas de convites expirados
CREATE INDEX IF NOT EXISTS idx_email_invites_expires_at ON email_invites(expires_at) WHERE used = false;

-- ETAPA 1.2: Melhorias na tabela stores
-- Adicionar colunas para informações completas do estabelecimento
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS endereco TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS email_contato TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Adicionar constraint de status separadamente
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'stores_status_check' 
    AND conrelid = 'stores'::regclass
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT stores_status_check CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;

-- Criar índice para filtros por status
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);

-- Criar trigger para atualizar updated_at automaticamente (drop primeiro se existir)
DROP TRIGGER IF EXISTS set_stores_updated_at ON stores;
CREATE TRIGGER set_stores_updated_at 
BEFORE UPDATE ON stores
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- MIGRATION: 20251107010643_225ae2d3-1bea-4cec-817b-9be033d43cf3.sql
-- ==========================================
-- ETAPA 4: Atualizar RLS Policies para garantir privacidade entre organizações

-- 1. Atualizar policy de checklist_responses para super_admins
DROP POLICY IF EXISTS "Users can view responses based on organization" ON checklist_responses;

CREATE POLICY "Super_admins can view responses from owned stores"
ON checklist_responses FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid())) OR
  (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
    SELECT s.id FROM stores s
    JOIN organizations o ON o.id = s.organization_id
    WHERE o.owner_id = auth.uid()
  ))
);

-- 2. Atualizar policy de checklist_items para super_admins
DROP POLICY IF EXISTS "Users can view checklist items in same store" ON checklist_items;

CREATE POLICY "Users can view checklist items from owned stores"
ON checklist_items FOR SELECT
TO authenticated
USING (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      JOIN organizations o ON o.id = s.organization_id
      WHERE o.owner_id = auth.uid()
    ) OR
    store_id = get_user_store_id(auth.uid())
  )
);

-- 3. Atualizar policy de checklist_types para super_admins
DROP POLICY IF EXISTS "Users can view checklist types in same store" ON checklist_types;

CREATE POLICY "Users can view checklist types from owned stores"
ON checklist_types FOR SELECT
TO authenticated
USING (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      JOIN organizations o ON o.id = s.organization_id
      WHERE o.owner_id = auth.uid()
    ) OR
    store_id = get_user_store_id(auth.uid())
  )
);

-- 4. Atualizar policy de audit_logs para super_admins
DROP POLICY IF EXISTS "Admins can view audit logs from their store" ON audit_logs;

CREATE POLICY "Admins can view audit logs from owned stores"
ON audit_logs FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()) OR
  has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
    SELECT s.id FROM stores s
    JOIN organizations o ON o.id = s.organization_id
    WHERE o.owner_id = auth.uid()
  )
);

-- 5. Atualizar policy de profiles para super_admins
DROP POLICY IF EXISTS "Allow profile access" ON profiles;

CREATE POLICY "Allow profile access from owned stores"
ON profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR
  has_role(auth.uid(), 'admin'::user_role) OR
  has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
    SELECT s.id FROM stores s
    JOIN organizations o ON o.id = s.organization_id
    WHERE o.owner_id = auth.uid()
  )
);

-- ==========================================
-- MIGRATION: 20251107013243_89e3587a-6a64-406b-8a34-cb3ad588b48a.sql
-- ==========================================
-- Modify clone_checklists_to_store to allow super_admins to clone without organization validation
CREATE OR REPLACE FUNCTION public.clone_checklists_to_store(
  source_store_id uuid, 
  target_store_id uuid, 
  create_new_organization boolean DEFAULT false, 
  new_org_name text DEFAULT NULL::text, 
  new_org_owner_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  checklist_type RECORD;
  new_checklist_id UUID;
  items_copied INTEGER := 0;
  types_copied INTEGER := 0;
  new_organization_id UUID;
  caller_org_id UUID;
  row_count_temp INTEGER;
  is_super_admin BOOLEAN;
BEGIN
  -- 1. Verificar se usuário é super_admin
  SELECT has_role(auth.uid(), 'super_admin'::user_role) INTO is_super_admin;
  
  IF NOT is_super_admin AND NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem clonar checklists';
  END IF;

  -- 2. Obter organization_id da loja origem (pode ser NULL)
  SELECT organization_id INTO caller_org_id
  FROM public.stores
  WHERE id = source_store_id;

  -- 3. Validação de organização APENAS para admins regulares (não super_admins)
  IF NOT is_super_admin THEN
    -- Admins regulares precisam ter organização válida
    IF caller_org_id IS NULL THEN
      RAISE EXCEPTION 'A loja de origem precisa ter uma organização vinculada';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = caller_org_id AND owner_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Você só pode clonar checklists das suas próprias lojas';
    END IF;
  END IF;

  -- 4. Se criar nova organização
  IF create_new_organization THEN
    IF new_org_name IS NULL OR new_org_owner_id IS NULL THEN
      RAISE EXCEPTION 'Nome e owner_id são obrigatórios para nova organização';
    END IF;

    -- Criar nova organização
    INSERT INTO public.organizations (nome, owner_id)
    VALUES (new_org_name, new_org_owner_id)
    RETURNING id INTO new_organization_id;

    -- Vincular loja destino à nova organização
    UPDATE public.stores
    SET organization_id = new_organization_id
    WHERE id = target_store_id;
  ELSE
    -- Vincular loja destino à organização do caller (se existir)
    IF caller_org_id IS NOT NULL THEN
      UPDATE public.stores
      SET organization_id = caller_org_id
      WHERE id = target_store_id;
    END IF;
  END IF;

  -- 5. Clonar checklists
  FOR checklist_type IN 
    SELECT * FROM public.checklist_types 
    WHERE store_id = source_store_id
    ORDER BY created_at
  LOOP
    INSERT INTO public.checklist_types (nome, area, turno, allowed_roles, store_id)
    VALUES (
      checklist_type.nome,
      checklist_type.area,
      checklist_type.turno,
      checklist_type.allowed_roles,
      target_store_id
    )
    RETURNING id INTO new_checklist_id;
    
    types_copied := types_copied + 1;

    INSERT INTO public.checklist_items (
      checklist_type_id,
      nome,
      ordem,
      requer_observacao,
      observacao_obrigatoria,
      requer_foto,
      store_id
    )
    SELECT
      new_checklist_id,
      nome,
      ordem,
      requer_observacao,
      observacao_obrigatoria,
      requer_foto,
      target_store_id
    FROM public.checklist_items
    WHERE checklist_type_id = checklist_type.id
    ORDER BY ordem;
    
    GET DIAGNOSTICS row_count_temp = ROW_COUNT;
    items_copied := items_copied + row_count_temp;
  END LOOP;

  -- 6. Registrar auditoria
  PERFORM log_audit_event(
    p_action_type := 'clone',
    p_resource_type := 'checklists',
    p_resource_id := target_store_id,
    p_resource_name := 'Checklist Templates',
    p_metadata := jsonb_build_object(
      'source_store_id', source_store_id,
      'target_store_id', target_store_id,
      'types_copied', types_copied,
      'items_copied', items_copied,
      'new_organization', create_new_organization,
      'new_org_name', new_org_name
    )
  );

  RETURN json_build_object(
    'success', true,
    'types_copied', types_copied,
    'items_copied', items_copied,
    'message', format('Clonados %s checklists com %s itens', types_copied, items_copied)
  );
END;
$function$;

-- ==========================================
-- MIGRATION: 20251107021855_898649d3-c6ec-44b3-8e1e-501835433ffe.sql
-- ==========================================
-- Modificar função handle_new_user para transferir ownership automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role_val user_role;
  user_store_id uuid;
  invite_record RECORD;
  store_org_id uuid;
BEGIN
  -- Check if email is invited
  SELECT * INTO invite_record
  FROM public.email_invites
  WHERE email = NEW.email AND used = false
  LIMIT 1;
  
  -- If no invite found, reject the signup
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Email não autorizado. Solicite um convite ao administrador.';
  END IF;
  
  -- Get role and store from invite
  user_role_val := invite_record.role;
  user_store_id := invite_record.store_id;
  
  -- Insert into profiles WITHOUT role (SECURITY FIX)
  INSERT INTO public.profiles (id, nome, email, store_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    user_store_id
  );
  
  -- Insert into user_roles (role stored ONLY here)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_val);
  
  -- Mark invite as used
  UPDATE public.email_invites
  SET used = true, used_at = NOW()
  WHERE id = invite_record.id;
  
  -- Se o role é 'admin', transferir ownership da organization
  IF user_role_val = 'admin' THEN
    -- Buscar organization_id da loja
    SELECT organization_id INTO store_org_id
    FROM public.stores
    WHERE id = user_store_id;
    
    -- Se a loja tem uma organization, transferir ownership
    IF store_org_id IS NOT NULL THEN
      UPDATE public.organizations
      SET owner_id = NEW.id, updated_at = NOW()
      WHERE id = store_org_id AND owner_id != NEW.id;
      
      -- Registrar auditoria da transferência
      PERFORM log_audit_event(
        p_action_type := 'ownership_transfer',
        p_resource_type := 'organization',
        p_resource_id := store_org_id,
        p_resource_name := 'Organization Ownership',
        p_old_values := jsonb_build_object('owner_id', (
          SELECT owner_id FROM public.organizations WHERE id = store_org_id
        )),
        p_new_values := jsonb_build_object('owner_id', NEW.id),
        p_metadata := jsonb_build_object(
          'new_admin_email', NEW.email,
          'store_id', user_store_id,
          'invite_id', invite_record.id,
          'transfer_reason', 'admin_invite_acceptance'
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ==========================================
-- MIGRATION: 20251107195624_a035d13f-5e92-4c84-9b41-a41f6bee8691.sql
-- ==========================================
-- ETAPA 3: Adicionar Foreign Key e NOT NULL em role_id

-- Adicionar foreign key (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_role_id_fkey'
  ) THEN
    ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey
    FOREIGN KEY (role_id)
    REFERENCES public.roles(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Tornar role_id obrigatório
ALTER TABLE public.user_roles
ALTER COLUMN role_id SET NOT NULL;

-- ETAPA 4: Corrigir a função handle_new_user() para preencher role_id automaticamente

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_role_val user_role;
  user_store_id uuid;
  invite_record RECORD;
  store_org_id uuid;
  role_uuid uuid;
BEGIN
  -- Check if email is invited
  SELECT * INTO invite_record
  FROM public.email_invites
  WHERE email = NEW.email AND used = false
  LIMIT 1;
  
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Email não autorizado. Solicite um convite ao administrador.';
  END IF;
  
  user_role_val := invite_record.role;
  user_store_id := invite_record.store_id;
  
  -- Buscar o role_id baseado no nome do role
  SELECT id INTO role_uuid
  FROM public.roles
  WHERE store_id = user_store_id
  AND name = user_role_val::text
  LIMIT 1;
  
  -- Insert into profiles WITHOUT role (SECURITY FIX)
  INSERT INTO public.profiles (id, nome, email, store_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    user_store_id
  );
  
  -- Insert into user_roles with role_id
  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (NEW.id, user_role_val, role_uuid);
  
  -- Mark invite as used
  UPDATE public.email_invites
  SET used = true, used_at = NOW()
  WHERE id = invite_record.id;
  
  -- Se o role é 'admin', transferir ownership da organization
  IF user_role_val = 'admin' THEN
    SELECT organization_id INTO store_org_id
    FROM public.stores
    WHERE id = user_store_id;
    
    IF store_org_id IS NOT NULL THEN
      UPDATE public.organizations
      SET owner_id = NEW.id, updated_at = NOW()
      WHERE id = store_org_id AND owner_id != NEW.id;
      
      PERFORM log_audit_event(
        p_action_type := 'ownership_transfer',
        p_resource_type := 'organization',
        p_resource_id := store_org_id,
        p_resource_name := 'Organization Ownership',
        p_old_values := jsonb_build_object('owner_id', (
          SELECT owner_id FROM public.organizations WHERE id = store_org_id
        )),
        p_new_values := jsonb_build_object('owner_id', NEW.id),
        p_metadata := jsonb_build_object(
          'new_admin_email', NEW.email,
          'store_id', user_store_id,
          'invite_id', invite_record.id,
          'transfer_reason', 'admin_invite_acceptance'
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ==========================================
-- MIGRATION: 20251107222823_333a7bc1-c3c6-48a2-b6ac-3701beecb000.sql
-- ==========================================
-- Remove UNIQUE constraint on organizations.owner_id to allow super_admins to manage multiple client organizations
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_owner_id_key;

-- Create index for performance on owner_id lookups
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);

-- Update RLS policy to allow super_admins to view all organizations they own (not just one)
DROP POLICY IF EXISTS "Super_admins can view their organization" ON public.organizations;

CREATE POLICY "Super_admins can view their organizations"
ON public.organizations FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  AND owner_id = auth.uid()
);

-- ==========================================
-- MIGRATION: 20251107223852_a56fb2ec-5a70-4c1c-b258-68800931045d.sql
-- ==========================================
-- Allow public read access to valid email invites during signup validation
CREATE POLICY "Allow public read for valid invites during signup"
ON public.email_invites FOR SELECT
USING (
  used = false 
  AND expires_at > now()
);

-- ==========================================
-- MIGRATION: 20251107224400_44b37a69-c5a7-4818-9861-2635498ddd6f.sql
-- ==========================================
-- Update log_audit_event to accept optional store_id parameter
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action_type text, 
  p_resource_type text, 
  p_resource_id uuid DEFAULT NULL::uuid, 
  p_resource_name text DEFAULT NULL::text, 
  p_old_values jsonb DEFAULT NULL::jsonb, 
  p_new_values jsonb DEFAULT NULL::jsonb, 
  p_metadata jsonb DEFAULT NULL::jsonb,
  p_store_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
  v_store_id UUID;
  v_audit_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Se store_id foi fornecido explicitamente, usa ele
  IF p_store_id IS NOT NULL THEN
    v_store_id := p_store_id;
    
    -- Buscar apenas nome e email
    SELECT nome, email 
    INTO v_user_name, v_user_email
    FROM public.profiles
    WHERE id = v_user_id;
  ELSE
    -- Comportamento antigo: buscar tudo do perfil
    SELECT nome, email, store_id 
    INTO v_user_name, v_user_email, v_store_id
    FROM public.profiles
    WHERE id = v_user_id;
  END IF;
  
  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    user_name,
    user_email,
    store_id,
    action_type,
    resource_type,
    resource_id,
    resource_name,
    old_values,
    new_values,
    metadata
  ) VALUES (
    v_user_id,
    COALESCE(v_user_name, 'Sistema'),
    COALESCE(v_user_email, 'sistema@app.com'),
    v_store_id,
    p_action_type,
    p_resource_type,
    p_resource_id,
    p_resource_name,
    p_old_values,
    p_new_values,
    p_metadata
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$function$;

-- Update handle_new_user to pass store_id explicitly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role_val user_role;
  user_store_id uuid;
  invite_record RECORD;
  store_org_id uuid;
  role_uuid uuid;
BEGIN
  -- Check if email is invited
  SELECT * INTO invite_record
  FROM public.email_invites
  WHERE email = NEW.email AND used = false
  LIMIT 1;
  
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Email não autorizado. Solicite um convite ao administrador.';
  END IF;
  
  user_role_val := invite_record.role;
  user_store_id := invite_record.store_id;
  
  -- Buscar o role_id baseado no nome do role
  SELECT id INTO role_uuid
  FROM public.roles
  WHERE store_id = user_store_id
  AND name = user_role_val::text
  LIMIT 1;
  
  -- Insert into profiles WITHOUT role (SECURITY FIX)
  INSERT INTO public.profiles (id, nome, email, store_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    user_store_id
  );
  
  -- Insert into user_roles with role_id
  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (NEW.id, user_role_val, role_uuid);
  
  -- Mark invite as used
  UPDATE public.email_invites
  SET used = true, used_at = NOW()
  WHERE id = invite_record.id;
  
  -- Se o role é 'admin', transferir ownership da organization
  IF user_role_val = 'admin' THEN
    SELECT organization_id INTO store_org_id
    FROM public.stores
    WHERE id = user_store_id;
    
    IF store_org_id IS NOT NULL THEN
      UPDATE public.organizations
      SET owner_id = NEW.id, updated_at = NOW()
      WHERE id = store_org_id AND owner_id != NEW.id;
      
      -- Passar store_id explicitamente para evitar NULL
      PERFORM log_audit_event(
        p_action_type := 'ownership_transfer',
        p_resource_type := 'organization',
        p_resource_id := store_org_id,
        p_resource_name := 'Organization Ownership',
        p_old_values := jsonb_build_object('owner_id', (
          SELECT owner_id FROM public.organizations WHERE id = store_org_id
        )),
        p_new_values := jsonb_build_object('owner_id', NEW.id),
        p_metadata := jsonb_build_object(
          'new_admin_email', NEW.email,
          'store_id', user_store_id,
          'invite_id', invite_record.id,
          'transfer_reason', 'admin_invite_acceptance'
        ),
        p_store_id := user_store_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ==========================================
-- MIGRATION: 20251108015831_052fbde3-014e-444d-bde8-52085187f573.sql
-- ==========================================
-- Fix RLS policy for stores table to ensure all users can see their own store
-- Drop existing policy
DROP POLICY IF EXISTS "Users can view stores based on access" ON public.stores;

-- Create improved policy that prioritizes user's own store access
CREATE POLICY "Users can view stores based on access"
ON public.stores
FOR SELECT
TO authenticated
USING (
  -- Super admins can see stores from organizations they own
  (
    has_role(auth.uid(), 'super_admin'::user_role) 
    AND organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  )
  -- OR any authenticated user can see their own store (prioritized check)
  OR (
    id IN (
      SELECT store_id FROM profiles WHERE id = auth.uid()
    )
  )
);

-- ==========================================
-- MIGRATION: 20251108020149_26057245-686b-4440-92ac-4b3648a8dd71.sql
-- ==========================================
-- Simplify RLS policy for stores table - remove has_role dependency
DROP POLICY IF EXISTS "Users can view stores based on access" ON public.stores;

CREATE POLICY "Users can view stores based on access"
ON public.stores
FOR SELECT
TO authenticated
USING (
  -- Super admins podem ver stores de organizations que possuem
  organization_id IN (
    SELECT id FROM organizations WHERE owner_id = auth.uid()
  )
  -- OU usuário pode ver sua própria store (via profile)
  OR id IN (
    SELECT store_id FROM profiles WHERE id = auth.uid()
  )
);

-- ==========================================
-- MIGRATION: 20251108020621_ec07989a-901c-46a1-918d-33b86c3669cc.sql
-- ==========================================
-- Criar função SECURITY DEFINER para verificar acesso a stores
CREATE OR REPLACE FUNCTION public.can_view_store(store_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_store_id uuid;
  store_org_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Buscar store_id do profile do usuário
  SELECT store_id INTO user_store_id
  FROM profiles
  WHERE id = current_user_id;
  
  -- Buscar organization_id da store
  SELECT organization_id INTO store_org_id
  FROM stores
  WHERE id = store_id_param;
  
  -- Verificar se usuário pode ver a loja
  RETURN (
    -- Usuário pode ver sua própria loja
    store_id_param = user_store_id
    OR
    -- Ou se a loja pertence a uma organization que o usuário possui
    EXISTS (
      SELECT 1 FROM organizations
      WHERE id = store_org_id
      AND owner_id = current_user_id
    )
  );
END;
$$;

-- Recriar política RLS usando a função
DROP POLICY IF EXISTS "Users can view stores based on access" ON public.stores;

CREATE POLICY "Users can view stores based on access"
ON public.stores
FOR SELECT
TO authenticated
USING (public.can_view_store(id));

-- ==========================================
-- MIGRATION: 20251108020958_46de4be3-96b7-4937-8dea-4f1277f3b890.sql
-- ==========================================
-- Recriar função can_view_store com lógica corrigida
CREATE OR REPLACE FUNCTION public.can_view_store(store_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Obter o user_id atual
  current_user_id := auth.uid();
  
  -- Se não há usuário autenticado, retornar false
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar acesso de duas formas:
  -- 1. Usuário pode ver sua própria loja (store_id do profile)
  -- 2. Usuário é owner da organization que contém a store
  RETURN (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = current_user_id
      AND store_id = store_id_param
    )
    OR
    EXISTS (
      SELECT 1 
      FROM stores s
      JOIN organizations o ON o.id = s.organization_id
      WHERE s.id = store_id_param
      AND o.owner_id = current_user_id
    )
  );
END;
$$;

-- ==========================================
-- MIGRATION: 20251108151759_93cc0b9a-215b-4631-a8ad-941f8d41c193.sql
-- ==========================================
-- Recriar função can_view_store com SECURITY INVOKER para manter contexto de autenticação
CREATE OR REPLACE FUNCTION public.can_view_store(store_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER  -- MUDANÇA CRÍTICA: usar INVOKER ao invés de DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Obter o user_id atual
  current_user_id := auth.uid();
  
  -- Se não há usuário autenticado, retornar false
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar acesso de duas formas:
  -- 1. Usuário pode ver sua própria loja (store_id do profile)
  -- 2. Usuário é owner da organization que contém a store
  RETURN (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = current_user_id
      AND store_id = store_id_param
    )
    OR
    EXISTS (
      SELECT 1 
      FROM stores s
      JOIN organizations o ON o.id = s.organization_id
      WHERE s.id = store_id_param
      AND o.owner_id = current_user_id
    )
  );
END;
$$;

-- ==========================================
-- MIGRATION: 20251108153155_27e1e672-6c19-47b6-b486-aeb91fca55a2.sql
-- ==========================================
-- 1. Remover a política RLS existente que usa can_view_store
DROP POLICY IF EXISTS "Users can view stores based on access" ON public.stores;

-- 2. Remover a função can_view_store (causa recursão)
DROP FUNCTION IF EXISTS public.can_view_store(uuid);

-- 3. Criar políticas RLS diretas (SEM RECURSÃO)
CREATE POLICY "Users can view their own store"
ON public.stores
FOR SELECT
USING (
  id IN (
    SELECT store_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Organization owners can view all stores"
ON public.stores
FOR SELECT
USING (
  organization_id IN (
    SELECT id 
    FROM public.organizations 
    WHERE owner_id = auth.uid()
  )
);

-- ==========================================
-- MIGRATION: 20251108154937_94d5c92c-e259-4c71-90a2-3753dbf0ae6d.sql
-- ==========================================
-- PASSO 1: Criar funções SECURITY DEFINER para quebrar loops de recursão

-- Função para obter store_id do usuário SEM acionar RLS
CREATE OR REPLACE FUNCTION public.get_user_store_id_direct(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Função para verificar role SEM recursão
CREATE OR REPLACE FUNCTION public.check_user_role_direct(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- PASSO 2: Recriar políticas de user_roles (SEM usar has_role)

-- Remover políticas antigas que causam recursão
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Admins podem ver todos os roles (SEM usar has_role para evitar recursão)
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- Admins podem gerenciar roles (SEM usar has_role)
CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- PASSO 3: Recriar políticas de profiles (SEM recursão)

-- Remover política que causa recursão com stores
DROP POLICY IF EXISTS "Allow profile access from owned stores" ON public.profiles;

-- Política 1: Usuário vê seu próprio perfil
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Política 2: Admin vê perfis da sua loja (usando função SECURITY DEFINER)
CREATE POLICY "Admins can view profiles from their store"
ON public.profiles
FOR SELECT
USING (
  public.check_user_role_direct(auth.uid(), 'admin'::user_role)
  AND store_id = public.get_user_store_id_direct(auth.uid())
);

-- Política 3: Super admin vê TODOS os perfis de lojas da sua organização
CREATE POLICY "Super admins can view all profiles from owned orgs"
ON public.profiles
FOR SELECT
USING (
  public.check_user_role_direct(auth.uid(), 'super_admin'::user_role)
  AND store_id IN (
    SELECT s.id 
    FROM public.stores s
    JOIN public.organizations o ON o.id = s.organization_id
    WHERE o.owner_id = auth.uid()
  )
);

-- PASSO 4: Adicionar política para admins verem sua própria loja

CREATE POLICY "Admins can view their own store"
ON public.stores
FOR SELECT
USING (
  id = public.get_user_store_id_direct(auth.uid())
  AND public.check_user_role_direct(auth.uid(), 'admin'::user_role)
);

-- ==========================================
-- MIGRATION: 20251108155305_fc0d68dd-5935-4f1f-9e5b-434efe28d417.sql
-- ==========================================
-- CORREÇÃO DEFINITIVA: Eliminar TODAS as recursões RLS

-- PASSO 1: Remover políticas problemáticas de profiles
DROP POLICY IF EXISTS "Admins can insert all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- PASSO 2: Recriar políticas de profiles SEM recursão

-- INSERT: Usar check_user_role_direct (SECURITY DEFINER)
CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (
  public.check_user_role_direct(auth.uid(), 'admin'::user_role) OR
  public.check_user_role_direct(auth.uid(), 'super_admin'::user_role)
);

-- UPDATE: Admins podem atualizar (usando SECURITY DEFINER)
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
USING (
  public.check_user_role_direct(auth.uid(), 'admin'::user_role) OR
  public.check_user_role_direct(auth.uid(), 'super_admin'::user_role)
);

-- UPDATE: Usuários podem atualizar apenas seu próprio nome (SEM subqueries!)
CREATE POLICY "Users can update own name"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
);

-- PASSO 3: Remover políticas problemáticas de stores
DROP POLICY IF EXISTS "Admins and super_admins can manage stores" ON public.stores;
DROP POLICY IF EXISTS "Users can view their own store" ON public.stores;

-- PASSO 4: Recriar políticas de stores SEM recursão

-- Admins podem gerenciar (usando check_user_role_direct)
CREATE POLICY "Admins can manage stores"
ON public.stores
FOR ALL
USING (
  public.check_user_role_direct(auth.uid(), 'admin'::user_role) OR
  public.check_user_role_direct(auth.uid(), 'super_admin'::user_role)
)
WITH CHECK (
  public.check_user_role_direct(auth.uid(), 'admin'::user_role) OR
  public.check_user_role_direct(auth.uid(), 'super_admin'::user_role)
);

-- Usuários veem sua loja (usando get_user_store_id_direct)
CREATE POLICY "Users can view own store"
ON public.stores
FOR SELECT
USING (
  id = public.get_user_store_id_direct(auth.uid())
);

-- ==========================================
-- MIGRATION: 20251108160040_8052232d-a960-47e5-83b2-d396718d0d34.sql
-- ==========================================
-- PLANO COMPLETO DE CORREÇÃO RLS
-- Objetivo: Colaboradores → apenas checklists | Admins → apenas própria loja | Super_admins → todas lojas da organização

-- ============================================
-- PASSO 1: CORRIGIR user_roles (URGENTE)
-- ============================================

-- Remover políticas recursivas
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Criar políticas SIMPLES sem recursão
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Permitir SELECT para funções SECURITY DEFINER funcionarem
CREATE POLICY "Enable read access for authenticated users"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Função SECURITY DEFINER para gerenciar roles (evita recursão)
CREATE OR REPLACE FUNCTION public.manage_user_role(
  p_user_id UUID,
  p_role user_role,
  p_role_id UUID,
  p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = ANY(ARRAY['admin'::user_role, 'super_admin'::user_role])
  ) INTO caller_is_admin;
  
  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem gerenciar roles';
  END IF;
  
  IF p_action = 'insert' THEN
    INSERT INTO public.user_roles (user_id, role, role_id)
    VALUES (p_user_id, p_role, p_role_id);
  ELSIF p_action = 'update' THEN
    UPDATE public.user_roles
    SET role = p_role, role_id = p_role_id
    WHERE user_id = p_user_id;
  ELSIF p_action = 'delete' THEN
    DELETE FROM public.user_roles WHERE user_id = p_user_id;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- ============================================
-- PASSO 2: CORRIGIR checklist_responses (SEGURANÇA - ISOLAMENTO DE LOJAS)
-- ============================================

-- Remover política insegura que permite admin ver TODAS as lojas
DROP POLICY IF EXISTS "Users can view their own responses" ON public.checklist_responses;
DROP POLICY IF EXISTS "Super_admins can view responses from owned stores" ON public.checklist_responses;

-- Recriar com isolamento correto por loja
CREATE POLICY "Users can view their own responses"
ON public.checklist_responses
FOR SELECT
USING (
  auth.uid() = user_id OR
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid())) OR
  (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
    SELECT s.id FROM stores s
    JOIN organizations o ON o.id = s.organization_id
    WHERE o.owner_id = auth.uid()
  ))
);

-- ============================================
-- PASSO 3: REVISAR checklist_items (ISOLAMENTO DE LOJAS)
-- ============================================

DROP POLICY IF EXISTS "Users can view checklist items from owned stores" ON public.checklist_items;

CREATE POLICY "Users can view checklist items from owned stores"
ON public.checklist_items
FOR SELECT
USING (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid())
    OR
    (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      JOIN organizations o ON o.id = s.organization_id
      WHERE o.owner_id = auth.uid()
    ))
    OR
    store_id = get_user_store_id(auth.uid())
  )
);

-- ============================================
-- PASSO 4: REVISAR checklist_types (ISOLAMENTO DE LOJAS)
-- ============================================

DROP POLICY IF EXISTS "Users can view checklist types from owned stores" ON public.checklist_types;

CREATE POLICY "Users can view checklist types from owned stores"
ON public.checklist_types
FOR SELECT
USING (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid())
    OR
    (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      JOIN organizations o ON o.id = s.organization_id
      WHERE o.owner_id = auth.uid()
    ))
    OR
    store_id = get_user_store_id(auth.uid())
  )
);

-- ============================================
-- PASSO 5: REVISAR profiles (ISOLAMENTO DE LOJAS)
-- ============================================

DROP POLICY IF EXISTS "Admins can view profiles from their store" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles from owned orgs" ON public.profiles;

-- Admin vê APENAS perfis da PRÓPRIA loja
CREATE POLICY "Admins can view profiles from their store"
ON public.profiles
FOR SELECT
USING (
  check_user_role_direct(auth.uid(), 'admin'::user_role) AND 
  store_id = get_user_store_id_direct(auth.uid())
);

-- Super_admin vê perfis de TODAS as lojas da organização
CREATE POLICY "Super admins can view all profiles from owned orgs"
ON public.profiles
FOR SELECT
USING (
  check_user_role_direct(auth.uid(), 'super_admin'::user_role) AND
  store_id IN (
    SELECT s.id FROM stores s
    JOIN organizations o ON o.id = s.organization_id
    WHERE o.owner_id = auth.uid()
  )
);

-- ============================================
-- PASSO 6: REVISAR stores (ISOLAMENTO DE LOJAS)
-- ============================================

DROP POLICY IF EXISTS "Admins can view their own store" ON public.stores;

-- Admin vê e gerencia APENAS a PRÓPRIA loja
CREATE POLICY "Admins can view their own store"
ON public.stores
FOR SELECT
USING (
  id = get_user_store_id_direct(auth.uid()) AND
  check_user_role_direct(auth.uid(), 'admin'::user_role)
);

-- ============================================
-- RESULTADO ESPERADO:
-- ✅ Colaboradores: APENAS checklists da sua loja
-- ✅ Admin: APENAS configurações da PRÓPRIA loja
-- ✅ Super Admin: ACESSO TOTAL a todas lojas da organização
-- ✅ Zero recursões RLS
-- ✅ Isolamento completo entre lojas
-- ============================================;

-- ==========================================
-- MIGRATION: 20251109025033_80908ec1-86bf-42ff-aeac-31c7d3676d2c.sql
-- ==========================================
-- Fix RLS policy for checklist_responses INSERT
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can insert their own responses" ON public.checklist_responses;

-- Create a simplified policy that allows users to insert their own responses
CREATE POLICY "Users can insert their own responses"
ON public.checklist_responses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- MIGRATION: 20251109025429_860c9205-b210-4dfc-ba85-b11f156d3c5d.sql
-- ==========================================
-- Fix UPDATE policy to allow upserts
DROP POLICY IF EXISTS "Users can update their own responses" ON public.checklist_responses;

CREATE POLICY "Users can update their own responses"
ON public.checklist_responses
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- MIGRATION: 20251111201327_8cdb1823-63ba-42f2-ad2c-7d3d04899732.sql
-- ==========================================
-- Drop existing policy
DROP POLICY IF EXISTS "Users can view their own responses" ON checklist_responses;

-- Create new improved policy
CREATE POLICY "Users can view their own responses" ON checklist_responses
FOR SELECT USING (
  (auth.uid() = user_id) 
  OR 
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR
  (has_role(auth.uid(), 'super_admin'::user_role) AND 
   store_id IN (
     SELECT s.id FROM stores s 
     WHERE s.organization_id = (
       SELECT st.organization_id 
       FROM profiles p 
       JOIN stores st ON st.id = p.store_id 
       WHERE p.id = auth.uid()
     )
   ))
);

-- ==========================================
-- MIGRATION: 20251209182513_8159d6be-d50a-4ddd-9efc-a85149ec50ec.sql
-- ==========================================
-- Corrigir função trigger_checklist_notification com sintaxe assíncrona do pg_net
CREATE OR REPLACE FUNCTION public.trigger_checklist_notification(turno_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  request_id bigint;
BEGIN
  -- Chamar edge function de forma assíncrona via pg_net
  -- net.http_post retorna apenas o request_id, não status/content
  SELECT net.http_post(
    url := 'https://qwetfynfpfjruswdnaps.supabase.co/functions/v1/send-checklist-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZXRmeW5mcGZqcnVzd2RuYXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjUyOTUsImV4cCI6MjA3NTAwMTI5NX0.RaE8VDPT3wGS3uPOJR5jsQqh6zS1glMwBncu2l01nB8'
    ),
    body := jsonb_build_object('turno', turno_param),
    timeout_milliseconds := 30000
  ) INTO request_id;
  
  RAISE NOTICE 'Notification request queued for turno: % (request_id: %)', turno_param, request_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger notification for turno %: % (SQLSTATE: %)', 
      turno_param, SQLERRM, SQLSTATE;
END;
$function$;

-- ==========================================
-- MIGRATION: 20251209184119_37baf36a-e90c-4cda-9942-54ec31cea19a.sql
-- ==========================================
-- 1. Atualizar função delete_user_account para limpar convite e permitir recadastro
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_store_id uuid;
  caller_store_id uuid;
  is_super_admin boolean;
  target_email text;
BEGIN
  -- Check if caller is super_admin
  SELECT has_role(auth.uid(), 'super_admin'::user_role) INTO is_super_admin;

  -- Get the store_id and email of the target user
  SELECT store_id, email INTO target_store_id, target_email
  FROM public.profiles
  WHERE id = target_user_id;

  -- Get the store_id of the caller
  SELECT store_id INTO caller_store_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- Verify caller is admin or super_admin
  IF NOT (has_role(auth.uid(), 'admin'::user_role) OR is_super_admin) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  -- Super_admin can delete users from any store in their organization
  -- Admin can only delete users from their own store
  IF NOT is_super_admin THEN
    IF target_store_id IS NULL OR caller_store_id IS NULL OR target_store_id != caller_store_id THEN
      RAISE EXCEPTION 'Você só pode excluir usuários da sua loja';
    END IF;
  END IF;

  -- Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta';
  END IF;

  -- Delete from user_roles
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- Delete from profiles
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
  
  -- Limpar convite usado para permitir recadastro com mesmo email
  DELETE FROM public.email_invites 
  WHERE email = target_email AND store_id = target_store_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário excluído com sucesso. O email pode ser recadastrado.'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$function$;

-- 2. Corrigir política RLS para super_admins verem todos os usuários da organização
DROP POLICY IF EXISTS "Super admins can view all profiles from owned orgs" ON public.profiles;

CREATE POLICY "Super admins can view all profiles from organization stores" 
ON public.profiles
FOR SELECT
USING (
  check_user_role_direct(auth.uid(), 'super_admin'::user_role)
  AND store_id IN (
    SELECT s.id 
    FROM stores s
    WHERE s.organization_id IN (
      SELECT st.organization_id 
      FROM profiles p
      JOIN stores st ON st.id = p.store_id
      WHERE p.id = auth.uid()
    )
  )
);

-- ==========================================
-- MIGRATION: 20251209184603_8188abc8-0d54-44ff-b09b-f7b0b02c2117.sql
-- ==========================================
-- 1. Corrigir políticas da tabela stores
DROP POLICY IF EXISTS "Organization owners can view all stores" ON public.stores;

CREATE POLICY "Super admins can view all organization stores" 
ON public.stores
FOR SELECT
USING (
  check_user_role_direct(auth.uid(), 'super_admin'::user_role)
  AND organization_id IN (
    SELECT st.organization_id 
    FROM profiles p
    JOIN stores st ON st.id = p.store_id
    WHERE p.id = auth.uid()
  )
);

-- 2. Corrigir políticas da tabela organizations
DROP POLICY IF EXISTS "Super_admins can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Super_admins can manage their organization" ON public.organizations;

CREATE POLICY "Super admins can view organization" 
ON public.organizations
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  AND id IN (
    SELECT st.organization_id 
    FROM profiles p
    JOIN stores st ON st.id = p.store_id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Super admins can manage organization" 
ON public.organizations
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  AND id IN (
    SELECT st.organization_id 
    FROM profiles p
    JOIN stores st ON st.id = p.store_id
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  AND id IN (
    SELECT st.organization_id 
    FROM profiles p
    JOIN stores st ON st.id = p.store_id
    WHERE p.id = auth.uid()
  )
);

-- 3. Corrigir políticas de checklist_types
DROP POLICY IF EXISTS "Users can view checklist types from owned stores" ON public.checklist_types;

CREATE POLICY "Users can view checklist types from organization stores" 
ON public.checklist_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    -- Admin: apenas sua loja
    (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
    -- Super admin: todas as lojas da organização
    OR (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      WHERE s.organization_id IN (
        SELECT st.organization_id 
        FROM profiles p
        JOIN stores st ON st.id = p.store_id
        WHERE p.id = auth.uid()
      )
    ))
    -- Usuário comum: apenas sua loja
    OR store_id = get_user_store_id(auth.uid())
  )
);

-- 4. Corrigir políticas de checklist_items
DROP POLICY IF EXISTS "Users can view checklist items from owned stores" ON public.checklist_items;

CREATE POLICY "Users can view checklist items from organization stores" 
ON public.checklist_items
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
    OR (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      WHERE s.organization_id IN (
        SELECT st.organization_id 
        FROM profiles p
        JOIN stores st ON st.id = p.store_id
        WHERE p.id = auth.uid()
      )
    ))
    OR store_id = get_user_store_id(auth.uid())
  )
);

-- ==========================================
-- MIGRATION: 20251210012559_b357ef39-ae04-408b-ac46-29b97921adfc.sql
-- ==========================================
-- 1. Criar função SECURITY DEFINER para buscar organization_id sem passar por RLS
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.organization_id 
  FROM profiles p
  JOIN stores s ON s.id = p.store_id
  WHERE p.id = _user_id
  LIMIT 1;
$$;

-- 2. Corrigir política RLS da tabela profiles
DROP POLICY IF EXISTS "Super admins can view all profiles from organization stores" ON public.profiles;

CREATE POLICY "Super admins can view all profiles from organization stores" 
ON public.profiles
FOR SELECT
USING (
  check_user_role_direct(auth.uid(), 'super_admin'::user_role)
  AND store_id IN (
    SELECT s.id FROM stores s
    WHERE s.organization_id = get_user_organization_id(auth.uid())
  )
);

-- 3. Corrigir política de stores
DROP POLICY IF EXISTS "Super admins can view all organization stores" ON public.stores;

CREATE POLICY "Super admins can view all organization stores" 
ON public.stores
FOR SELECT
USING (
  check_user_role_direct(auth.uid(), 'super_admin'::user_role)
  AND organization_id = get_user_organization_id(auth.uid())
);

-- 4. Corrigir políticas de organizations
DROP POLICY IF EXISTS "Super admins can view organization" ON public.organizations;
DROP POLICY IF EXISTS "Super admins can manage organization" ON public.organizations;

CREATE POLICY "Super admins can view organization" 
ON public.organizations
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  AND id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Super admins can manage organization" 
ON public.organizations
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  AND id = get_user_organization_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  AND id = get_user_organization_id(auth.uid())
);

-- 5. Corrigir política de checklist_types
DROP POLICY IF EXISTS "Users can view checklist types from organization stores" ON public.checklist_types;

CREATE POLICY "Users can view checklist types from organization stores" 
ON public.checklist_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
    OR (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      WHERE s.organization_id = get_user_organization_id(auth.uid())
    ))
    OR store_id = get_user_store_id(auth.uid())
  )
);

-- 6. Corrigir política de checklist_items
DROP POLICY IF EXISTS "Users can view checklist items from organization stores" ON public.checklist_items;

CREATE POLICY "Users can view checklist items from organization stores" 
ON public.checklist_items
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
    OR (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      WHERE s.organization_id = get_user_organization_id(auth.uid())
    ))
    OR store_id = get_user_store_id(auth.uid())
  )
);

-- 7. Corrigir política de checklist_responses
DROP POLICY IF EXISTS "Users can view their own responses" ON public.checklist_responses;

CREATE POLICY "Users can view their own responses" 
ON public.checklist_responses
FOR SELECT
USING (
  (auth.uid() = user_id)
  OR (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
    SELECT s.id FROM stores s
    WHERE s.organization_id = get_user_organization_id(auth.uid())
  ))
);

-- ==========================================
-- MIGRATION: 20251210014049_19bf22e1-5f99-473b-b7a2-0cfb10b4c24b.sql
-- ==========================================
-- Criar função SECURITY DEFINER para excluir loja e todos os dados relacionados
CREATE OR REPLACE FUNCTION public.delete_store_account(target_store_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_org_id uuid;
  target_org_id uuid;
  target_store_name text;
  caller_store_id uuid;
  users_deleted integer := 0;
  checklists_deleted integer := 0;
  responses_deleted integer := 0;
  user_ids uuid[];
BEGIN
  -- Verificar se é super_admin
  IF NOT has_role(auth.uid(), 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'Apenas super_admin pode excluir lojas';
  END IF;

  -- Buscar store_id do chamador
  caller_store_id := get_user_store_id(auth.uid());
  
  -- Não pode excluir a própria loja
  IF target_store_id = caller_store_id THEN
    RAISE EXCEPTION 'Você não pode excluir a loja onde está logado';
  END IF;

  -- Verificar se está na mesma organização
  caller_org_id := get_user_organization_id(auth.uid());
  
  SELECT organization_id, nome INTO target_org_id, target_store_name
  FROM stores WHERE id = target_store_id;

  IF target_org_id IS NULL OR target_org_id != caller_org_id THEN
    RAISE EXCEPTION 'Você só pode excluir lojas da sua organização';
  END IF;

  -- Contar dados para retorno
  SELECT COUNT(*) INTO users_deleted FROM profiles WHERE store_id = target_store_id;
  SELECT COUNT(*) INTO checklists_deleted FROM checklist_types WHERE store_id = target_store_id;
  SELECT COUNT(*) INTO responses_deleted FROM checklist_responses WHERE store_id = target_store_id;

  -- Coletar IDs dos usuários da loja alvo
  SELECT ARRAY_AGG(id) INTO user_ids FROM profiles WHERE store_id = target_store_id;

  -- Excluir em cascata (ordem correta para evitar FK violations)
  IF user_ids IS NOT NULL AND array_length(user_ids, 1) > 0 THEN
    DELETE FROM user_roles WHERE user_id = ANY(user_ids);
    DELETE FROM auth.users WHERE id = ANY(user_ids);
  END IF;
  
  DELETE FROM profiles WHERE store_id = target_store_id;
  DELETE FROM checklist_responses WHERE store_id = target_store_id;
  DELETE FROM checklist_items WHERE store_id = target_store_id;
  DELETE FROM checklist_types WHERE store_id = target_store_id;
  DELETE FROM checklist_items_staging WHERE store_id = target_store_id;
  DELETE FROM checklist_notifications WHERE checklist_type_id IN (
    SELECT id FROM checklist_types WHERE store_id = target_store_id
  );
  DELETE FROM email_invites WHERE store_id = target_store_id;
  DELETE FROM notifications WHERE store_id = target_store_id;
  DELETE FROM admin_settings WHERE store_id = target_store_id;
  DELETE FROM roles WHERE store_id = target_store_id;
  DELETE FROM stores WHERE id = target_store_id;

  -- Registrar no audit log (na loja do caller)
  PERFORM log_audit_event(
    p_action_type := 'delete',
    p_resource_type := 'store',
    p_resource_id := target_store_id,
    p_resource_name := target_store_name,
    p_metadata := jsonb_build_object(
      'users_deleted', users_deleted,
      'checklists_deleted', checklists_deleted,
      'responses_deleted', responses_deleted
    ),
    p_store_id := caller_store_id
  );

  RETURN json_build_object(
    'success', true,
    'message', format('Loja "%s" excluída com sucesso', target_store_name),
    'users_deleted', users_deleted,
    'checklists_deleted', checklists_deleted,
    'responses_deleted', responses_deleted
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$function$;

-- ==========================================
-- MIGRATION: 20251223195321_37551d47-0117-4a4f-a91e-06cb53fa28da.sql
-- ==========================================
-- Tabela: Padrões de Inspeção (fotos de referência + critérios por loja/item)
CREATE TABLE public.inspection_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  criteria TEXT NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  reference_photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, checklist_item_id)
);

-- Tabela: Relatórios de Inspeção
CREATE TABLE public.inspection_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  checklist_type_id UUID NOT NULL REFERENCES checklist_types(id) ON DELETE CASCADE,
  execution_date DATE NOT NULL,
  executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  executed_by_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')),
  total_approved INTEGER DEFAULT 0,
  total_rejected INTEGER DEFAULT 0,
  total_inconclusive INTEGER DEFAULT 0,
  summary TEXT,
  priority_actions JSONB DEFAULT '[]',
  whatsapp_sent_at TIMESTAMPTZ,
  whatsapp_recipients TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: Itens do Relatório de Inspeção
CREATE TABLE public.inspection_report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES inspection_reports(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('approved', 'rejected', 'inconclusive')),
  verdict_summary TEXT,
  observation TEXT,
  corrective_action TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  evidence_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar coluna whatsapp_recipients na tabela stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS whatsapp_recipients TEXT[] DEFAULT '{}';

-- Habilitar RLS em todas as novas tabelas
ALTER TABLE public.inspection_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_report_items ENABLE ROW LEVEL SECURITY;

-- RLS: inspection_standards - Apenas admin/super_admin podem gerenciar
CREATE POLICY "Admins can manage inspection standards"
ON public.inspection_standards
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR has_role(auth.uid(), 'super_admin'::user_role)
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

-- RLS: inspection_reports - Apenas admin/super_admin podem visualizar
CREATE POLICY "Admins can view inspection reports"
ON public.inspection_reports
FOR SELECT
USING (
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
    SELECT s.id FROM stores s WHERE s.organization_id = get_user_organization_id(auth.uid())
  ))
);

-- RLS: inspection_reports - Sistema pode inserir (via edge function)
CREATE POLICY "System can insert inspection reports"
ON public.inspection_reports
FOR INSERT
WITH CHECK (true);

-- RLS: inspection_reports - Admins podem atualizar (para reenvio WhatsApp)
CREATE POLICY "Admins can update inspection reports"
ON public.inspection_reports
FOR UPDATE
USING (
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

-- RLS: inspection_report_items - Apenas admin/super_admin podem visualizar
CREATE POLICY "Admins can view inspection report items"
ON public.inspection_report_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM inspection_reports ir
    WHERE ir.id = report_id
    AND (
      (has_role(auth.uid(), 'admin'::user_role) AND ir.store_id = get_user_store_id(auth.uid()))
      OR (has_role(auth.uid(), 'super_admin'::user_role) AND ir.store_id IN (
        SELECT s.id FROM stores s WHERE s.organization_id = get_user_organization_id(auth.uid())
      ))
    )
  )
);

-- RLS: inspection_report_items - Sistema pode inserir
CREATE POLICY "System can insert inspection report items"
ON public.inspection_report_items
FOR INSERT
WITH CHECK (true);

-- Criar bucket para fotos de referência
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-references', 'inspection-references', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Admins podem fazer upload de fotos de referência
CREATE POLICY "Admins can upload reference photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'inspection-references'
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role))
);

-- Storage policy: Admins podem deletar fotos de referência
CREATE POLICY "Admins can delete reference photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'inspection-references'
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role))
);

-- Storage policy: Todos podem visualizar fotos de referência (necessário para IA)
CREATE POLICY "Anyone can view reference photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'inspection-references');

-- Trigger para atualizar updated_at em inspection_standards
CREATE TRIGGER update_inspection_standards_updated_at
BEFORE UPDATE ON public.inspection_standards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- MIGRATION: 20251226130836_53acf660-6371-4be9-ad14-d679347a93e7.sql
-- ==========================================
-- Atualizar função delete_user_account para garantir remoção completa
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_store_id uuid;
  caller_store_id uuid;
  is_super_admin boolean;
  target_email text;
  target_name text;
BEGIN
  -- Check if caller is super_admin
  SELECT has_role(auth.uid(), 'super_admin'::user_role) INTO is_super_admin;

  -- Get the store_id, email and name of the target user
  SELECT store_id, email, nome INTO target_store_id, target_email, target_name
  FROM public.profiles
  WHERE id = target_user_id;

  -- Get the store_id of the caller
  SELECT store_id INTO caller_store_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- Verify caller is admin or super_admin
  IF NOT (has_role(auth.uid(), 'admin'::user_role) OR is_super_admin) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  -- Super_admin can delete users from any store in their organization
  -- Admin can only delete users from their own store
  IF NOT is_super_admin THEN
    IF target_store_id IS NULL OR caller_store_id IS NULL OR target_store_id != caller_store_id THEN
      RAISE EXCEPTION 'Você só pode excluir usuários da sua loja';
    END IF;
  END IF;

  -- Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta';
  END IF;

  -- 1. Delete from user_roles first (FK constraint)
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- 2. Delete from profiles
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- 3. CRITICAL: Delete from auth.users (this is what was potentially failing)
  DELETE FROM auth.users WHERE id = target_user_id;
  
  -- 4. Clear any related invites to allow re-registration with same email
  IF target_email IS NOT NULL THEN
    DELETE FROM public.email_invites 
    WHERE email = target_email;
  END IF;

  -- Log the deletion for audit
  PERFORM log_audit_event(
    p_action_type := 'delete',
    p_resource_type := 'user',
    p_resource_id := target_user_id,
    p_resource_name := COALESCE(target_name, target_email, 'Unknown'),
    p_metadata := jsonb_build_object(
      'deleted_email', target_email,
      'deleted_from_store', target_store_id
    ),
    p_store_id := caller_store_id
  );

  RETURN json_build_object(
    'success', true,
    'message', format('Usuário %s excluído com sucesso. O email pode ser recadastrado.', COALESCE(target_email, 'desconhecido'))
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM,
      'error_detail', SQLSTATE
    );
END;
$function$;

-- ==========================================
-- MIGRATION: 20251226153340_570128fc-5f44-4577-b397-b6e9dae9076f.sql
-- ==========================================
-- Adicionar colunas para canais de notificação na tabela admin_settings
ALTER TABLE admin_settings 
  ADD COLUMN IF NOT EXISTS notification_channel_email boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_channel_whatsapp boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_whatsapp_number text DEFAULT NULL;

-- Adicionar colunas para WhatsApp na tabela email_invites
ALTER TABLE email_invites 
  ADD COLUMN IF NOT EXISTS whatsapp_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamp with time zone DEFAULT NULL;

-- ==========================================
-- MIGRATION: 20251226184155_e8d4c0de-3b46-4200-b83f-e5ebd200e67d.sql
-- ==========================================
-- 1. Tornar email opcional na tabela email_invites
ALTER TABLE email_invites ALTER COLUMN email DROP NOT NULL;

-- 2. Adicionar campo para tipo de convite (email ou phone)
ALTER TABLE email_invites ADD COLUMN invite_type text 
  DEFAULT 'email' CHECK (invite_type IN ('email', 'phone'));

-- 3. Garantir que pelo menos um identificador existe (email ou whatsapp_number)
ALTER TABLE email_invites ADD CONSTRAINT email_or_phone_required 
  CHECK (email IS NOT NULL OR whatsapp_number IS NOT NULL);

-- 4. Tornar email opcional na tabela profiles
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

-- 5. Adicionar campo de telefone na tabela profiles
ALTER TABLE profiles ADD COLUMN phone text DEFAULT NULL;

-- 6. Garantir que pelo menos um identificador existe (email ou phone)
ALTER TABLE profiles ADD CONSTRAINT profile_email_or_phone_required 
  CHECK (email IS NOT NULL OR phone IS NOT NULL);

-- 7. Atualizar função handle_new_user para suportar cadastro via telefone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  user_role_val user_role;
  user_store_id uuid;
  invite_record RECORD;
  store_org_id uuid;
  role_uuid uuid;
BEGIN
  -- Buscar convite por email OU telefone (whatsapp_number para convites de telefone)
  SELECT * INTO invite_record
  FROM public.email_invites
  WHERE (
    (email IS NOT NULL AND email = NEW.email) OR
    (invite_type = 'phone' AND whatsapp_number IS NOT NULL AND whatsapp_number = NEW.phone)
  )
  AND used = false
  LIMIT 1;
  
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Não autorizado. Solicite um convite ao administrador.';
  END IF;
  
  user_role_val := invite_record.role;
  user_store_id := invite_record.store_id;
  
  -- Buscar o role_id baseado no nome do role
  SELECT id INTO role_uuid
  FROM public.roles
  WHERE store_id = user_store_id
  AND name = user_role_val::text
  LIMIT 1;
  
  -- Insert into profiles com email OU telefone
  INSERT INTO public.profiles (id, nome, email, phone, store_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,    -- Pode ser NULL para cadastros via telefone
    NEW.phone,    -- Pode ser NULL para cadastros via email
    user_store_id
  );
  
  -- Insert into user_roles with role_id
  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (NEW.id, user_role_val, role_uuid);
  
  -- Mark invite as used
  UPDATE public.email_invites
  SET used = true, used_at = NOW()
  WHERE id = invite_record.id;
  
  -- Se o role é 'admin', transferir ownership da organization
  IF user_role_val = 'admin' THEN
    SELECT organization_id INTO store_org_id
    FROM public.stores
    WHERE id = user_store_id;
    
    IF store_org_id IS NOT NULL THEN
      UPDATE public.organizations
      SET owner_id = NEW.id, updated_at = NOW()
      WHERE id = store_org_id AND owner_id != NEW.id;
      
      -- Passar store_id explicitamente para evitar NULL
      PERFORM log_audit_event(
        p_action_type := 'ownership_transfer',
        p_resource_type := 'organization',
        p_resource_id := store_org_id,
        p_resource_name := 'Organization Ownership',
        p_old_values := jsonb_build_object('owner_id', (
          SELECT owner_id FROM public.organizations WHERE id = store_org_id
        )),
        p_new_values := jsonb_build_object('owner_id', NEW.id),
        p_metadata := jsonb_build_object(
          'new_admin_email', COALESCE(NEW.email, NEW.phone),
          'store_id', user_store_id,
          'invite_id', invite_record.id,
          'transfer_reason', 'admin_invite_acceptance'
        ),
        p_store_id := user_store_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ==========================================
-- MIGRATION: 20251226185154_76dd72ac-4ad4-4e33-8c8d-633d89782adf.sql
-- ==========================================
-- Adicionar coluna invitee_name na tabela email_invites
ALTER TABLE public.email_invites 
ADD COLUMN invitee_name text DEFAULT NULL;

COMMENT ON COLUMN public.email_invites.invitee_name IS 'Nome do colaborador convidado';

-- ==========================================
-- MIGRATION: 20251227131728_55655d9a-3fb4-44d6-ab49-e9711921c759.sql
-- ==========================================
-- Atualizar função handle_new_user para suportar cadastro via telefone usando email virtual
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role_val user_role;
  user_store_id uuid;
  invite_record RECORD;
  store_org_id uuid;
  role_uuid uuid;
  phone_from_email text;
BEGIN
  -- Extrair telefone do email virtual (formato: 5548999999999@phone.grupobenditopb.internal)
  IF NEW.email LIKE '%@phone.grupobenditopb.internal' THEN
    phone_from_email := split_part(NEW.email, '@', 1);
  ELSE
    phone_from_email := NULL;
  END IF;

  -- Buscar convite por email OU telefone (whatsapp_number para convites de telefone)
  SELECT * INTO invite_record
  FROM public.email_invites
  WHERE (
    -- Convite de email tradicional
    (invite_type = 'email' AND email IS NOT NULL AND email = NEW.email) OR
    -- Convite de telefone - comparar whatsapp_number com telefone extraído do email virtual
    (invite_type = 'phone' AND whatsapp_number IS NOT NULL AND phone_from_email IS NOT NULL AND whatsapp_number = phone_from_email)
  )
  AND used = false
  LIMIT 1;
  
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Não autorizado. Solicite um convite ao administrador.';
  END IF;
  
  user_role_val := invite_record.role;
  user_store_id := invite_record.store_id;
  
  -- Buscar o role_id baseado no nome do role
  SELECT id INTO role_uuid
  FROM public.roles
  WHERE store_id = user_store_id
  AND name = user_role_val::text
  LIMIT 1;
  
  -- Insert into profiles
  -- Para cadastros de telefone, armazenar o telefone no campo phone
  INSERT INTO public.profiles (id, nome, email, phone, store_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', invite_record.invitee_name, ''),
    CASE 
      WHEN phone_from_email IS NOT NULL THEN NULL  -- Não salvar email virtual
      ELSE NEW.email 
    END,
    CASE 
      WHEN phone_from_email IS NOT NULL THEN phone_from_email
      ELSE NEW.phone
    END,
    user_store_id
  );
  
  -- Insert into user_roles with role_id
  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (NEW.id, user_role_val, role_uuid);
  
  -- Mark invite as used
  UPDATE public.email_invites
  SET used = true, used_at = NOW()
  WHERE id = invite_record.id;
  
  -- Se o role é 'admin', transferir ownership da organization
  IF user_role_val = 'admin' THEN
    SELECT organization_id INTO store_org_id
    FROM public.stores
    WHERE id = user_store_id;
    
    IF store_org_id IS NOT NULL THEN
      UPDATE public.organizations
      SET owner_id = NEW.id, updated_at = NOW()
      WHERE id = store_org_id AND owner_id != NEW.id;
      
      -- Passar store_id explicitamente para evitar NULL
      PERFORM log_audit_event(
        p_action_type := 'ownership_transfer',
        p_resource_type := 'organization',
        p_resource_id := store_org_id,
        p_resource_name := 'Organization Ownership',
        p_old_values := jsonb_build_object('owner_id', (
          SELECT owner_id FROM public.organizations WHERE id = store_org_id
        )),
        p_new_values := jsonb_build_object('owner_id', NEW.id),
        p_metadata := jsonb_build_object(
          'new_admin_email', COALESCE(NEW.email, phone_from_email),
          'store_id', user_store_id,
          'invite_id', invite_record.id,
          'transfer_reason', 'admin_invite_acceptance'
        ),
        p_store_id := user_store_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ==========================================
-- MIGRATION: 20251228144808_d80d8160-f27c-4f91-bd10-258aa0b129b1.sql
-- ==========================================
-- Adicionar coluna para observação do colaborador
ALTER TABLE public.inspection_report_items 
ADD COLUMN employee_observation text;

-- ==========================================
-- MIGRATION: 20251228145740_a95c8750-19b4-4875-a315-f82ab5828200.sql
-- ==========================================
-- Add enabled column to inspection_standards table
ALTER TABLE public.inspection_standards 
ADD COLUMN enabled boolean NOT NULL DEFAULT true;

-- ==========================================
-- MIGRATION: 20260121225458_b8ce5477-3a67-41cb-889d-452e864da14e.sql
-- ==========================================
-- Atualizar bucket para limitar tamanho de arquivos e tipos permitidos
UPDATE storage.buckets 
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'checklist-photos';

-- ==========================================
-- MIGRATION: 20260203153222_97a919bd-bf95-4a94-b77a-6fb0e5cd27c4.sql
-- ==========================================
-- Habilitar Realtime na tabela checklist_items para sincronização em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_items;

-- ==========================================
-- MIGRATION: 20260311150030_c096bc2c-fade-42d7-9457-bb8df11d7960.sql
-- ==========================================
ALTER TABLE public.admin_settings ADD COLUMN notification_whatsapp_numbers text[] DEFAULT '{}'::text[];

-- Migrate existing data
UPDATE public.admin_settings 
SET notification_whatsapp_numbers = ARRAY[notification_whatsapp_number]
WHERE notification_whatsapp_number IS NOT NULL AND notification_whatsapp_number != '';
