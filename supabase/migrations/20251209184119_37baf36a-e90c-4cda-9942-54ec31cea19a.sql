-- 1. Atualizar função delete_user_account para limpar convite e permitir recadastro
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
BEGIN
  -- Check if caller is super_admin
  SELECT has_role(auth.uid(), 'super_admin'::user_role) INTO is_super_admin;

  -- Get the store_id and email of the target user
  SELECT store_id, email INTO target_store_id, target_email
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

  -- Delete from user_roles
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- Delete from profiles
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
  
  -- Limpar convite usado para permitir recadastro com mesmo email
  DELETE FROM public.email_invites 
  WHERE email = target_email AND store_id = target_store_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário excluído com sucesso. O email pode ser recadastrado.'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$function$;

-- 2. Corrigir política RLS para super_admins verem todos os usuários da organização
DROP POLICY IF EXISTS "Super admins can view all profiles from owned orgs" ON public.profiles;

CREATE POLICY "Super admins can view all profiles from organization stores" 
ON public.profiles
FOR SELECT
USING (
  check_user_role_direct(auth.uid(), 'super_admin'::user_role)
  AND store_id IN (
    SELECT s.id 
    FROM stores s
    WHERE s.organization_id IN (
      SELECT st.organization_id 
      FROM profiles p
      JOIN stores st ON st.id = p.store_id
      WHERE p.id = auth.uid()
    )
  )
);