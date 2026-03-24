-- ETAPA 4: Atualizar RLS Policies para garantir privacidade entre organizações

-- 1. Atualizar policy de checklist_responses para super_admins
DROP POLICY IF EXISTS "Users can view responses based on organization" ON checklist_responses;

CREATE POLICY "Super_admins can view responses from owned stores"
ON checklist_responses FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid())) OR
  (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
    SELECT s.id FROM stores s
    JOIN organizations o ON o.id = s.organization_id
    WHERE o.owner_id = auth.uid()
  ))
);

-- 2. Atualizar policy de checklist_items para super_admins
DROP POLICY IF EXISTS "Users can view checklist items in same store" ON checklist_items;

CREATE POLICY "Users can view checklist items from owned stores"
ON checklist_items FOR SELECT
TO authenticated
USING (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      JOIN organizations o ON o.id = s.organization_id
      WHERE o.owner_id = auth.uid()
    ) OR
    store_id = get_user_store_id(auth.uid())
  )
);

-- 3. Atualizar policy de checklist_types para super_admins
DROP POLICY IF EXISTS "Users can view checklist types in same store" ON checklist_types;

CREATE POLICY "Users can view checklist types from owned stores"
ON checklist_types FOR SELECT
TO authenticated
USING (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      JOIN organizations o ON o.id = s.organization_id
      WHERE o.owner_id = auth.uid()
    ) OR
    store_id = get_user_store_id(auth.uid())
  )
);

-- 4. Atualizar policy de audit_logs para super_admins
DROP POLICY IF EXISTS "Admins can view audit logs from their store" ON audit_logs;

CREATE POLICY "Admins can view audit logs from owned stores"
ON audit_logs FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()) OR
  has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
    SELECT s.id FROM stores s
    JOIN organizations o ON o.id = s.organization_id
    WHERE o.owner_id = auth.uid()
  )
);

-- 5. Atualizar policy de profiles para super_admins
DROP POLICY IF EXISTS "Allow profile access" ON profiles;

CREATE POLICY "Allow profile access from owned stores"
ON profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR
  has_role(auth.uid(), 'admin'::user_role) OR
  has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
    SELECT s.id FROM stores s
    JOIN organizations o ON o.id = s.organization_id
    WHERE o.owner_id = auth.uid()
  )
);