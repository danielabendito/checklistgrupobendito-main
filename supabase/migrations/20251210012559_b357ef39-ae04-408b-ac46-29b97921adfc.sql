-- 1. Criar função SECURITY DEFINER para buscar organization_id sem passar por RLS
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.organization_id 
  FROM profiles p
  JOIN stores s ON s.id = p.store_id
  WHERE p.id = _user_id
  LIMIT 1;
$$;

-- 2. Corrigir política RLS da tabela profiles
DROP POLICY IF EXISTS "Super admins can view all profiles from organization stores" ON public.profiles;

CREATE POLICY "Super admins can view all profiles from organization stores" 
ON public.profiles
FOR SELECT
USING (
  check_user_role_direct(auth.uid(), 'super_admin'::user_role)
  AND store_id IN (
    SELECT s.id FROM stores s
    WHERE s.organization_id = get_user_organization_id(auth.uid())
  )
);

-- 3. Corrigir política de stores
DROP POLICY IF EXISTS "Super admins can view all organization stores" ON public.stores;

CREATE POLICY "Super admins can view all organization stores" 
ON public.stores
FOR SELECT
USING (
  check_user_role_direct(auth.uid(), 'super_admin'::user_role)
  AND organization_id = get_user_organization_id(auth.uid())
);

-- 4. Corrigir políticas de organizations
DROP POLICY IF EXISTS "Super admins can view organization" ON public.organizations;
DROP POLICY IF EXISTS "Super admins can manage organization" ON public.organizations;

CREATE POLICY "Super admins can view organization" 
ON public.organizations
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  AND id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Super admins can manage organization" 
ON public.organizations
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  AND id = get_user_organization_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  AND id = get_user_organization_id(auth.uid())
);

-- 5. Corrigir política de checklist_types
DROP POLICY IF EXISTS "Users can view checklist types from organization stores" ON public.checklist_types;

CREATE POLICY "Users can view checklist types from organization stores" 
ON public.checklist_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
    OR (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      WHERE s.organization_id = get_user_organization_id(auth.uid())
    ))
    OR store_id = get_user_store_id(auth.uid())
  )
);

-- 6. Corrigir política de checklist_items
DROP POLICY IF EXISTS "Users can view checklist items from organization stores" ON public.checklist_items;

CREATE POLICY "Users can view checklist items from organization stores" 
ON public.checklist_items
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
    OR (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      WHERE s.organization_id = get_user_organization_id(auth.uid())
    ))
    OR store_id = get_user_store_id(auth.uid())
  )
);

-- 7. Corrigir política de checklist_responses
DROP POLICY IF EXISTS "Users can view their own responses" ON public.checklist_responses;

CREATE POLICY "Users can view their own responses" 
ON public.checklist_responses
FOR SELECT
USING (
  (auth.uid() = user_id)
  OR (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
    SELECT s.id FROM stores s
    WHERE s.organization_id = get_user_organization_id(auth.uid())
  ))
);