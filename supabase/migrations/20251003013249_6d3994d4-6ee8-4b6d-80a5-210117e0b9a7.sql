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