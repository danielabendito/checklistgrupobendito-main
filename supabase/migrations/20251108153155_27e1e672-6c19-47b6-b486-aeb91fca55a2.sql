-- 1. Remover a política RLS existente que usa can_view_store
DROP POLICY IF EXISTS "Users can view stores based on access" ON public.stores;

-- 2. Remover a função can_view_store (causa recursão)
DROP FUNCTION IF EXISTS public.can_view_store(uuid);

-- 3. Criar políticas RLS diretas (SEM RECURSÃO)
CREATE POLICY "Users can view their own store"
ON public.stores
FOR SELECT
USING (
  id IN (
    SELECT store_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Organization owners can view all stores"
ON public.stores
FOR SELECT
USING (
  organization_id IN (
    SELECT id 
    FROM public.organizations 
    WHERE owner_id = auth.uid()
  )
);