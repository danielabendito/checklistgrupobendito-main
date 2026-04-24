
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