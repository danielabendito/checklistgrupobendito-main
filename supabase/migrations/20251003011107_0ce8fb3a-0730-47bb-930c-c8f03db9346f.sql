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