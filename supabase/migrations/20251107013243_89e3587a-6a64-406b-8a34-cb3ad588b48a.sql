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