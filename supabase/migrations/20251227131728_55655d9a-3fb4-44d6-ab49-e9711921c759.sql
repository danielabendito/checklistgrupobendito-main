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