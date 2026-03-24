-- Simplify RLS policy for stores table - remove has_role dependency
DROP POLICY IF EXISTS "Users can view stores based on access" ON public.stores;

CREATE POLICY "Users can view stores based on access"
ON public.stores
FOR SELECT
TO authenticated
USING (
  -- Super admins podem ver stores de organizations que possuem
  organization_id IN (
    SELECT id FROM organizations WHERE owner_id = auth.uid()
  )
  -- OU usuário pode ver sua própria store (via profile)
  OR id IN (
    SELECT store_id FROM profiles WHERE id = auth.uid()
  )
);