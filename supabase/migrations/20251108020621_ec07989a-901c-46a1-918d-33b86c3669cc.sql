-- Criar função SECURITY DEFINER para verificar acesso a stores
CREATE OR REPLACE FUNCTION public.can_view_store(store_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_store_id uuid;
  store_org_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Buscar store_id do profile do usuário
  SELECT store_id INTO user_store_id
  FROM profiles
  WHERE id = current_user_id;
  
  -- Buscar organization_id da store
  SELECT organization_id INTO store_org_id
  FROM stores
  WHERE id = store_id_param;
  
  -- Verificar se usuário pode ver a loja
  RETURN (
    -- Usuário pode ver sua própria loja
    store_id_param = user_store_id
    OR
    -- Ou se a loja pertence a uma organization que o usuário possui
    EXISTS (
      SELECT 1 FROM organizations
      WHERE id = store_org_id
      AND owner_id = current_user_id
    )
  );
END;
$$;

-- Recriar política RLS usando a função
DROP POLICY IF EXISTS "Users can view stores based on access" ON public.stores;

CREATE POLICY "Users can view stores based on access"
ON public.stores
FOR SELECT
TO authenticated
USING (public.can_view_store(id));