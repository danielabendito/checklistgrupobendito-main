-- Create edge function to delete users (requires service role)
-- This will be called from the frontend and will delete the user from auth.users
-- as well as cascade delete from profiles and user_roles

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_store_id uuid;
  caller_store_id uuid;
BEGIN
  -- Get the store_id of the target user
  SELECT store_id INTO target_store_id
  FROM public.profiles
  WHERE id = target_user_id;

  -- Get the store_id of the caller
  SELECT store_id INTO caller_store_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- Verify caller is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  -- Verify both users are in the same store
  IF target_store_id IS NULL OR caller_store_id IS NULL OR target_store_id != caller_store_id THEN
    RAISE EXCEPTION 'Você só pode excluir usuários da sua loja';
  END IF;

  -- Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta';
  END IF;

  -- Delete from user_roles (will cascade from profiles due to FK)
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- Delete from profiles (this will NOT cascade to auth.users)
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Delete from auth.users using admin API
  -- Note: This requires the auth.users table modification or using service role via RPC
  -- For now we'll use a workaround by calling auth admin delete
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário excluído com sucesso'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$;