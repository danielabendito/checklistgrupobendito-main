-- Criar função SECURITY DEFINER para excluir loja e todos os dados relacionados
CREATE OR REPLACE FUNCTION public.delete_store_account(target_store_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_org_id uuid;
  target_org_id uuid;
  target_store_name text;
  caller_store_id uuid;
  users_deleted integer := 0;
  checklists_deleted integer := 0;
  responses_deleted integer := 0;
  user_ids uuid[];
BEGIN
  -- Verificar se é super_admin
  IF NOT has_role(auth.uid(), 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'Apenas super_admin pode excluir lojas';
  END IF;

  -- Buscar store_id do chamador
  caller_store_id := get_user_store_id(auth.uid());
  
  -- Não pode excluir a própria loja
  IF target_store_id = caller_store_id THEN
    RAISE EXCEPTION 'Você não pode excluir a loja onde está logado';
  END IF;

  -- Verificar se está na mesma organização
  caller_org_id := get_user_organization_id(auth.uid());
  
  SELECT organization_id, nome INTO target_org_id, target_store_name
  FROM stores WHERE id = target_store_id;

  IF target_org_id IS NULL OR target_org_id != caller_org_id THEN
    RAISE EXCEPTION 'Você só pode excluir lojas da sua organização';
  END IF;

  -- Contar dados para retorno
  SELECT COUNT(*) INTO users_deleted FROM profiles WHERE store_id = target_store_id;
  SELECT COUNT(*) INTO checklists_deleted FROM checklist_types WHERE store_id = target_store_id;
  SELECT COUNT(*) INTO responses_deleted FROM checklist_responses WHERE store_id = target_store_id;

  -- Coletar IDs dos usuários da loja alvo
  SELECT ARRAY_AGG(id) INTO user_ids FROM profiles WHERE store_id = target_store_id;

  -- Excluir em cascata (ordem correta para evitar FK violations)
  IF user_ids IS NOT NULL AND array_length(user_ids, 1) > 0 THEN
    DELETE FROM user_roles WHERE user_id = ANY(user_ids);
    DELETE FROM auth.users WHERE id = ANY(user_ids);
  END IF;
  
  DELETE FROM profiles WHERE store_id = target_store_id;
  DELETE FROM checklist_responses WHERE store_id = target_store_id;
  DELETE FROM checklist_items WHERE store_id = target_store_id;
  DELETE FROM checklist_types WHERE store_id = target_store_id;
  DELETE FROM checklist_items_staging WHERE store_id = target_store_id;
  DELETE FROM checklist_notifications WHERE checklist_type_id IN (
    SELECT id FROM checklist_types WHERE store_id = target_store_id
  );
  DELETE FROM email_invites WHERE store_id = target_store_id;
  DELETE FROM notifications WHERE store_id = target_store_id;
  DELETE FROM admin_settings WHERE store_id = target_store_id;
  DELETE FROM roles WHERE store_id = target_store_id;
  DELETE FROM stores WHERE id = target_store_id;

  -- Registrar no audit log (na loja do caller)
  PERFORM log_audit_event(
    p_action_type := 'delete',
    p_resource_type := 'store',
    p_resource_id := target_store_id,
    p_resource_name := target_store_name,
    p_metadata := jsonb_build_object(
      'users_deleted', users_deleted,
      'checklists_deleted', checklists_deleted,
      'responses_deleted', responses_deleted
    ),
    p_store_id := caller_store_id
  );

  RETURN json_build_object(
    'success', true,
    'message', format('Loja "%s" excluída com sucesso', target_store_name),
    'users_deleted', users_deleted,
    'checklists_deleted', checklists_deleted,
    'responses_deleted', responses_deleted
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$function$;