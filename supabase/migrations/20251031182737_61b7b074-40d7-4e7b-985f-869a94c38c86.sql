-- Atualizar políticas RLS para incluir super_admin em todas as verificações

-- 1. CHECKLIST_RESPONSES - Admins podem ver todas as respostas
DROP POLICY IF EXISTS "Admins can view all responses" ON public.checklist_responses;
CREATE POLICY "Admins can view all responses" 
ON public.checklist_responses 
FOR SELECT 
USING (
  (auth.uid() = user_id) 
  OR has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 2. CHECKLIST_TYPES - Admins podem gerenciar todos os tipos
DROP POLICY IF EXISTS "Admins can manage all checklist types" ON public.checklist_types;
CREATE POLICY "Admins can manage all checklist types" 
ON public.checklist_types 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 3. CHECKLIST_TYPES - Usuários podem ver tipos da mesma loja
DROP POLICY IF EXISTS "Users can view checklist types in same store" ON public.checklist_types;
CREATE POLICY "Users can view checklist types in same store" 
ON public.checklist_types 
FOR SELECT 
USING (
  (auth.uid() IS NOT NULL) 
  AND (
    has_role(auth.uid(), 'super_admin'::user_role)
    OR has_role(auth.uid(), 'admin'::user_role) 
    OR (store_id = get_user_store_id(auth.uid()))
  )
);

-- 4. CHECKLIST_ITEMS - Admins podem gerenciar todos os itens
DROP POLICY IF EXISTS "Admins can manage all checklist items" ON public.checklist_items;
CREATE POLICY "Admins can manage all checklist items" 
ON public.checklist_items 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 5. CHECKLIST_ITEMS - Usuários podem ver itens da mesma loja
DROP POLICY IF EXISTS "Users can view checklist items in same store" ON public.checklist_items;
CREATE POLICY "Users can view checklist items in same store" 
ON public.checklist_items 
FOR SELECT 
USING (
  (auth.uid() IS NOT NULL) 
  AND (
    has_role(auth.uid(), 'super_admin'::user_role)
    OR has_role(auth.uid(), 'admin'::user_role) 
    OR (store_id = get_user_store_id(auth.uid()))
  )
);

-- 6. EMAIL_INVITES - Admins podem gerenciar convites
DROP POLICY IF EXISTS "Admins can manage email invites" ON public.email_invites;
CREATE POLICY "Admins can manage email invites" 
ON public.email_invites 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 7. EMAIL_INVITES - Ver convites
DROP POLICY IF EXISTS "Only admins can view email invites" ON public.email_invites;
CREATE POLICY "Only admins can view email invites" 
ON public.email_invites 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 8. USER_ROLES - Admins podem gerenciar roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" 
ON public.user_roles 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 9. USER_ROLES - Ver todas as roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 10. PROFILES - Admins podem atualizar todos os perfis
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 11. PROFILES - Ver perfis
DROP POLICY IF EXISTS "Users can view own profile, admins can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile, admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = id) 
  OR has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 12. PROFILES - Admins podem inserir perfis
DROP POLICY IF EXISTS "Admins can insert all profiles" ON public.profiles;
CREATE POLICY "Admins can insert all profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 13. ADMIN_SETTINGS - Admins podem gerenciar configurações
DROP POLICY IF EXISTS "Admins can manage settings" ON public.admin_settings;
CREATE POLICY "Admins can manage settings" 
ON public.admin_settings 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR (
    has_role(auth.uid(), 'admin'::user_role) 
    AND ((store_id IS NULL) OR (store_id = get_user_store_id(auth.uid())))
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR (
    has_role(auth.uid(), 'admin'::user_role) 
    AND ((store_id IS NULL) OR (store_id = get_user_store_id(auth.uid())))
  )
);

-- 14. ADMIN_SETTINGS - Ver configurações
DROP POLICY IF EXISTS "Only admins can view admin settings" ON public.admin_settings;
CREATE POLICY "Only admins can view admin settings" 
ON public.admin_settings 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 15. STORES - Admins e super_admins podem gerenciar lojas
DROP POLICY IF EXISTS "Admins and super_admins can manage stores" ON public.stores;
CREATE POLICY "Admins and super_admins can manage stores" 
ON public.stores 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- 16. STORES - Usuários podem ver lojas
DROP POLICY IF EXISTS "Users can view stores" ON public.stores;
CREATE POLICY "Users can view stores" 
ON public.stores 
FOR SELECT 
USING (
  (auth.uid() IS NOT NULL) 
  AND (
    has_role(auth.uid(), 'super_admin'::user_role) 
    OR (id = get_user_store_id(auth.uid()))
  )
);

-- 17. CHECKLIST_NOTIFICATIONS - Admins podem gerenciar notificações
DROP POLICY IF EXISTS "Admins can manage checklist notifications" ON public.checklist_notifications;
CREATE POLICY "Admins can manage checklist notifications" 
ON public.checklist_notifications 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);