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