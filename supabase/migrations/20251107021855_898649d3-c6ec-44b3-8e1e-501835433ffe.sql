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