-- Recriar função can_view_store com lógica corrigida
CREATE OR REPLACE FUNCTION public.can_view_store(store_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Obter o user_id atual
  current_user_id := auth.uid();
  
  -- Se não há usuário autenticado, retornar false
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar acesso de duas formas:
  -- 1. Usuário pode ver sua própria loja (store_id do profile)
  -- 2. Usuário é owner da organization que contém a store
  RETURN (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = current_user_id
      AND store_id = store_id_param
    )
    OR
    EXISTS (
      SELECT 1 
      FROM stores s
      JOIN organizations o ON o.id = s.organization_id
      WHERE s.id = store_id_param
      AND o.owner_id = current_user_id
    )
  );
END;
$$;