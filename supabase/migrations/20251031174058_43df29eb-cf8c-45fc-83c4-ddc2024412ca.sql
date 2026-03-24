-- Etapa 3: Atualizar Políticas RLS para suportar super_admin

-- 3.1 Admin Settings
DROP POLICY IF EXISTS "Admins can manage settings" ON admin_settings;
CREATE POLICY "Admins can manage settings" ON admin_settings
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  (has_role(auth.uid(), 'admin'::user_role) AND (store_id IS NULL OR store_id = get_user_store_id(auth.uid())))
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  (has_role(auth.uid(), 'admin'::user_role) AND (store_id IS NULL OR store_id = get_user_store_id(auth.uid())))
);

-- 3.2 Checklist Types
DROP POLICY IF EXISTS "Admins can manage all checklist types" ON checklist_types;
CREATE POLICY "Admins can manage all checklist types" ON checklist_types
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

-- 3.3 Checklist Items
DROP POLICY IF EXISTS "Admins can manage all checklist items" ON checklist_items;
CREATE POLICY "Admins can manage all checklist items" ON checklist_items
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

-- 3.4 Stores
DROP POLICY IF EXISTS "Admins can manage stores" ON stores;
DROP POLICY IF EXISTS "Users can view their own store" ON stores;

CREATE POLICY "Admins and super_admins can manage stores" ON stores
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Users can view stores" ON stores
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin'::user_role) OR
    id = get_user_store_id(auth.uid())
  )
);

-- 3.5 Profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles" ON profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

-- 3.6 Checklist Responses
DROP POLICY IF EXISTS "Admins can view all responses across all stores" ON checklist_responses;
CREATE POLICY "Admins can view all responses" ON checklist_responses
FOR SELECT
USING (
  auth.uid() = user_id OR
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);