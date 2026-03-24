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