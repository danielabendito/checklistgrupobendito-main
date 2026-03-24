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