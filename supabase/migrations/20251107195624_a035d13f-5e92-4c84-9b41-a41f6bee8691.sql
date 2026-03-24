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