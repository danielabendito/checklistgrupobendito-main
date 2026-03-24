-- 1. Corrigir políticas da tabela stores
DROP POLICY IF EXISTS "Organization owners can view all stores" ON public.stores;

CREATE POLICY "Super admins can view all organization stores" 
ON public.stores
FOR SELECT
USING (
  check_user_role_direct(auth.uid(), 'super_admin'::user_role)
  AND organization_id IN (
    SELECT st.organization_id 
    FROM profiles p
    JOIN stores st ON st.id = p.store_id
    WHERE p.id = auth.uid()
  )
);

-- 2. Corrigir políticas da tabela organizations
DROP POLICY IF EXISTS "Super_admins can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Super_admins can manage their organization" ON public.organizations;

CREATE POLICY "Super admins can view organization" 
ON public.organizations
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  AND id IN (
    SELECT st.organization_id 
    FROM profiles p
    JOIN stores st ON st.id = p.store_id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Super admins can manage organization" 
ON public.organizations
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  AND id IN (
    SELECT st.organization_id 
    FROM profiles p
    JOIN stores st ON st.id = p.store_id
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  AND id IN (
    SELECT st.organization_id 
    FROM profiles p
    JOIN stores st ON st.id = p.store_id
    WHERE p.id = auth.uid()
  )
);

-- 3. Corrigir políticas de checklist_types
DROP POLICY IF EXISTS "Users can view checklist types from owned stores" ON public.checklist_types;

CREATE POLICY "Users can view checklist types from organization stores" 
ON public.checklist_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    -- Admin: apenas sua loja
    (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
    -- Super admin: todas as lojas da organização
    OR (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      WHERE s.organization_id IN (
        SELECT st.organization_id 
        FROM profiles p
        JOIN stores st ON st.id = p.store_id
        WHERE p.id = auth.uid()
      )
    ))
    -- Usuário comum: apenas sua loja
    OR store_id = get_user_store_id(auth.uid())
  )
);

-- 4. Corrigir políticas de checklist_items
DROP POLICY IF EXISTS "Users can view checklist items from owned stores" ON public.checklist_items;

CREATE POLICY "Users can view checklist items from organization stores" 
ON public.checklist_items
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
    OR (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      WHERE s.organization_id IN (
        SELECT st.organization_id 
        FROM profiles p
        JOIN stores st ON st.id = p.store_id
        WHERE p.id = auth.uid()
      )
    ))
    OR store_id = get_user_store_id(auth.uid())
  )
);