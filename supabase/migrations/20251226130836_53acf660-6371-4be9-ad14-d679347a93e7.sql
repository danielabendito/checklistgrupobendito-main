-- Atualizar função delete_user_account para garantir remoção completa
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_store_id uuid;
  caller_store_id uuid;
  is_super_admin boolean;
  target_email text;
  target_name text;
BEGIN
  -- Check if caller is super_admin
  SELECT has_role(auth.uid(), 'super_admin'::user_role) INTO is_super_admin;

  -- Get the store_id, email and name of the target user
  SELECT store_id, email, nome INTO target_store_id, target_email, target_name
  FROM public.profiles
  WHERE id = target_user_id;

  -- Get the store_id of the caller
  SELECT store_id INTO caller_store_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- Verify caller is admin or super_admin
  IF NOT (has_role(auth.uid(), 'admin'::user_role) OR is_super_admin) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  -- Super_admin can delete users from any store in their organization
  -- Admin can only delete users from their own store
  IF NOT is_super_admin THEN
    IF target_store_id IS NULL OR caller_store_id IS NULL OR target_store_id != caller_store_id THEN
      RAISE EXCEPTION 'Você só pode excluir usuários da sua loja';
    END IF;
  END IF;

  -- Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta';
  END IF;

  -- 1. Delete from user_roles first (FK constraint)
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- 2. Delete from profiles
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- 3. CRITICAL: Delete from auth.users (this is what was potentially failing)
  DELETE FROM auth.users WHERE id = target_user_id;
  
  -- 4. Clear any related invites to allow re-registration with same email
  IF target_email IS NOT NULL THEN
    DELETE FROM public.email_invites 
    WHERE email = target_email;
  END IF;

  -- Log the deletion for audit
  PERFORM log_audit_event(
    p_action_type := 'delete',
    p_resource_type := 'user',
    p_resource_id := target_user_id,
    p_resource_name := COALESCE(target_name, target_email, 'Unknown'),
    p_metadata := jsonb_build_object(
      'deleted_email', target_email,
      'deleted_from_store', target_store_id
    ),
    p_store_id := caller_store_id
  );

  RETURN json_build_object(
    'success', true,
    'message', format('Usuário %s excluído com sucesso. O email pode ser recadastrado.', COALESCE(target_email, 'desconhecido'))
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM,
      'error_detail', SQLSTATE
    );
END;
$function$;