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

-- ==========================================
-- MIGRATION: 20251031182737_61b7b074-40d7-4e7b-985f-869a94c38c86.sql
-- ==========================================
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

-- ==========================================
-- MIGRATION: 20251031182804_9286eb3f-be13-499e-94f3-fa706e76f826.sql
-- ==========================================
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

-- ==========================================
-- MIGRATION: 20251031182902_db471da0-cf3f-45f3-a147-bdccda6ea5ba.sql
-- ==========================================
-- Atualizar função delete_user_account para incluir super_admin

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_store_id uuid;
  caller_store_id uuid;
  is_super_admin boolean;
BEGIN
  -- Check if caller is super_admin
  SELECT has_role(auth.uid(), 'super_admin'::user_role) INTO is_super_admin;

  -- Get the store_id of the target user
  SELECT store_id INTO target_store_id
  FROM public.profiles
  WHERE id = target_user_id;

  -- Get the store_id of the caller
  SELECT store_id INTO caller_store_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- Verify caller is admin or super_admin
  IF NOT (has_role(auth.uid(), 'admin'::user_role) OR is_super_admin) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  -- Super_admin can delete users from any store
  -- Admin can only delete users from their own store
  IF NOT is_super_admin THEN
    IF target_store_id IS NULL OR caller_store_id IS NULL OR target_store_id != caller_store_id THEN
      RAISE EXCEPTION 'Você só pode excluir usuários da sua loja';
    END IF;
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
$function$;

-- ==========================================
-- MIGRATION: 20251101001706_0a3f43ab-8026-4834-ac0c-9e8096f26234.sql
-- ==========================================
-- Create audit_logs table for tracking all system actions
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL, -- 'create', 'update', 'delete', 'complete', 'export'
  resource_type TEXT NOT NULL, -- 'checklist_type', 'checklist_item', 'checklist_response', 'admin_settings', 'user', 'report'
  resource_id UUID,
  resource_name TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB
);

-- Create index for better query performance
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_store_id ON public.audit_logs(store_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs(resource_type);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view audit logs from their store"
ON public.audit_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR 
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
);

CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action_type TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_resource_name TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
  v_store_id UUID;
  v_audit_id UUID;
BEGIN
  -- Get current user info
  v_user_id := auth.uid();
  
  SELECT nome, email, store_id 
  INTO v_user_name, v_user_email, v_store_id
  FROM public.profiles
  WHERE id = v_user_id;
  
  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    user_name,
    user_email,
    store_id,
    action_type,
    resource_type,
    resource_id,
    resource_name,
    old_values,
    new_values,
    metadata
  ) VALUES (
    v_user_id,
    COALESCE(v_user_name, 'Sistema'),
    COALESCE(v_user_email, 'sistema@app.com'),
    v_store_id,
    p_action_type,
    p_resource_type,
    p_resource_id,
    p_resource_name,
    p_old_values,
    p_new_values,
    p_metadata
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- ==========================================
-- MIGRATION: 20251101004159_eeea4d46-4b1c-4685-9f1d-d30568c92f14.sql
-- ==========================================
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- System can insert notifications
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to notify admins about NOK items
CREATE OR REPLACE FUNCTION public.notify_nok_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name TEXT;
  v_checklist_name TEXT;
  v_user_name TEXT;
  v_admin RECORD;
BEGIN
  -- Only notify on NOK status
  IF NEW.status != 'nok' THEN
    RETURN NEW;
  END IF;

  -- Get item and checklist names
  SELECT ci.nome INTO v_item_name
  FROM checklist_items ci
  WHERE ci.id = NEW.checklist_item_id;

  SELECT ct.nome INTO v_checklist_name
  FROM checklist_types ct
  WHERE ct.id = NEW.checklist_type_id;

  SELECT p.nome INTO v_user_name
  FROM profiles p
  WHERE p.id = NEW.user_id;

  -- Notify all admins and super_admins in the same store
  FOR v_admin IN 
    SELECT DISTINCT p.id, p.store_id
    FROM profiles p
    INNER JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.store_id = NEW.store_id
      AND ur.role IN ('admin', 'super_admin')
  LOOP
    INSERT INTO notifications (
      user_id,
      store_id,
      type,
      title,
      message,
      data
    ) VALUES (
      v_admin.id,
      NEW.store_id,
      'nok_item',
      'Item NOK Identificado',
      v_user_name || ' marcou "' || v_item_name || '" como NOK no checklist "' || v_checklist_name || '"',
      jsonb_build_object(
        'checklist_type_id', NEW.checklist_type_id,
        'checklist_item_id', NEW.checklist_item_id,
        'response_id', NEW.id,
        'user_name', v_user_name
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger on checklist_responses
DROP TRIGGER IF EXISTS trigger_notify_nok_item ON public.checklist_responses;
CREATE TRIGGER trigger_notify_nok_item
  AFTER INSERT OR UPDATE OF status
  ON public.checklist_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_nok_item();

-- ==========================================
-- MIGRATION: 20251101005121_43c82313-a812-40fe-80b5-db1de2f15f6c.sql
-- ==========================================
-- Add unique constraint to prevent duplicate admin_settings per store
ALTER TABLE public.admin_settings 
DROP CONSTRAINT IF EXISTS admin_settings_store_id_unique;

ALTER TABLE public.admin_settings
ADD CONSTRAINT admin_settings_store_id_unique UNIQUE (store_id);

-- ==========================================
-- MIGRATION: 20251101180248_d938c07b-cd6e-4847-8504-403e9779ff6a.sql
-- ==========================================
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view own profile, admins can view all profiles" ON public.profiles;

-- Create simplified policy for users to view their own profile (no role check needed)
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create separate policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- ==========================================
-- MIGRATION: 20251101180906_d7d93b5c-e11d-4e16-a9a7-ce4df0b4cdc4.sql
-- ==========================================
-- Remover todas as políticas SELECT antigas da tabela profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles " ON public.profiles;

-- Criar UMA ÚNICA política SELECT unificada
CREATE POLICY "Allow profile access"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Usuários podem ver seu próprio perfil (sem verificação de role para evitar recursão)
  auth.uid() = id
  OR
  -- OU admins/super_admins podem ver todos os perfis
  has_role(auth.uid(), 'super_admin'::user_role)
  OR
  has_role(auth.uid(), 'admin'::user_role)
);

-- ==========================================
-- MIGRATION: 20251101181954_ce4780a4-645a-496d-ae91-32b020e6c531.sql
-- ==========================================
-- Manter bucket privado e criar RLS policies para acesso restrito a admins
-- O bucket já existe como privado, vamos apenas garantir que está privado
UPDATE storage.buckets 
SET public = false 
WHERE id = 'checklist-photos';

-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "Usuários podem fazer upload de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem visualizar suas fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem atualizar suas fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar suas fotos" ON storage.objects;

-- Policy para SELECT - apenas admin e super_admin
CREATE POLICY "Admins e super_admins podem visualizar fotos de checklist"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'checklist-photos' 
  AND (
    has_role(auth.uid(), 'admin'::user_role) 
    OR has_role(auth.uid(), 'super_admin'::user_role)
  )
);

-- Policy para INSERT - usuários autenticados podem fazer upload
CREATE POLICY "Usuários autenticados podem fazer upload de fotos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'checklist-photos' 
  AND auth.uid() IS NOT NULL
);

-- Policy para DELETE - apenas admin, super_admin ou dono
CREATE POLICY "Admins e donos podem deletar fotos de checklist"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'checklist-photos' 
  AND (
    auth.uid() = owner 
    OR has_role(auth.uid(), 'admin'::user_role)
    OR has_role(auth.uid(), 'super_admin'::user_role)
  )
);

-- ==========================================
-- MIGRATION: 20251101215518_76608584-ed84-44d8-abbf-18c1df6f3b7f.sql
-- ==========================================
-- FASE 1: Corrigir Foreign Key para preservar checklists
-- Remover constraint CASCADE atual
ALTER TABLE public.checklist_responses 
DROP CONSTRAINT IF EXISTS checklist_responses_user_id_fkey;

-- Tornar user_id nullable
ALTER TABLE public.checklist_responses 
ALTER COLUMN user_id DROP NOT NULL;

-- Adicionar nova constraint com SET NULL
ALTER TABLE public.checklist_responses 
ADD CONSTRAINT checklist_responses_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;

-- Adicionar comentário de documentação
COMMENT ON COLUMN public.checklist_responses.user_id IS 
'ID do usuário que preencheu o checklist. Pode ser NULL se o usuário foi excluído, preservando o histórico.';

-- FASE 2: Adicionar campos de auditoria
-- Adicionar colunas para preservar informações do usuário
ALTER TABLE public.checklist_responses 
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Preencher registros existentes com dados dos usuários atuais
UPDATE public.checklist_responses cr
SET 
  user_name = p.nome,
  user_email = p.email
FROM public.profiles p
WHERE cr.user_id = p.id
  AND cr.user_name IS NULL;

-- FASE 3: Criar trigger para preencher automaticamente
CREATE OR REPLACE FUNCTION public.set_response_user_info()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT nome, email 
    INTO NEW.user_name, NEW.user_email
    FROM public.profiles
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Criar trigger para BEFORE INSERT
DROP TRIGGER IF EXISTS before_insert_response_user_info ON public.checklist_responses;
CREATE TRIGGER before_insert_response_user_info
BEFORE INSERT ON public.checklist_responses
FOR EACH ROW
EXECUTE FUNCTION public.set_response_user_info();

-- ==========================================
-- MIGRATION: 20251102031717_6bc899d6-3f8e-45ae-a7f3-6ddece607323.sql
-- ==========================================
-- Corrigir políticas RLS da tabela checklist_responses

-- FASE 1: Corrigir política de INSERT
DROP POLICY IF EXISTS "Users can insert their own responses" ON public.checklist_responses;

CREATE POLICY "Users can insert their own responses"
ON public.checklist_responses
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    user_id IS NULL  -- Permite NULL durante inserção (trigger preencherá)
    OR auth.uid() = user_id  -- Ou se já estiver preenchido, deve ser o próprio usuário
  )
);

-- FASE 2: Corrigir política de UPDATE
DROP POLICY IF EXISTS "Users can update their own responses" ON public.checklist_responses;

CREATE POLICY "Users can update their own responses"
ON public.checklist_responses
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id  -- Usuário só pode editar suas próprias respostas
  AND data = CURRENT_DATE  -- Apenas respostas do dia atual
)
WITH CHECK (
  auth.uid() = user_id  -- Garantir que user_id não seja alterado para outro usuário
  AND data = CURRENT_DATE
);

-- ==========================================
-- MIGRATION: 20251102223815_eccdcbc9-6848-4683-b65b-48212be22637.sql
-- ==========================================
-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Admins and users can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;

-- Política para SELECT (visualizar/baixar fotos)
CREATE POLICY "Admins and users can view photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'checklist-photos' 
  AND (
    -- Usuário pode ver suas próprias fotos
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Admins podem ver todas as fotos
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  )
);

-- Política para INSERT (upload de fotos)
CREATE POLICY "Users can upload their own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'checklist-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para DELETE (remover fotos)
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'checklist-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ==========================================
-- MIGRATION: 20251103020149_d8ec3cdf-57d8-41b0-b5ed-c55023fbd06f.sql
-- ==========================================
-- Adicionar coluna para marcar observação como obrigatória
ALTER TABLE checklist_items 
ADD COLUMN observacao_obrigatoria boolean NOT NULL DEFAULT false;

-- ==========================================
-- MIGRATION: 20251104192807_cc4b6693-034d-4cb8-8e42-86df05828698.sql
-- ==========================================
-- 1. Criar tabela de organizações
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id UUID NOT NULL,
  UNIQUE(owner_id)
);

-- 2. Habilitar RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS para organizations
CREATE POLICY "Super_admins can view their organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid() 
  AND has_role(auth.uid(), 'super_admin'::user_role)
);

CREATE POLICY "Super_admins can manage their organization"
ON public.organizations
FOR ALL
TO authenticated
USING (
  owner_id = auth.uid() 
  AND has_role(auth.uid(), 'super_admin'::user_role)
)
WITH CHECK (
  owner_id = auth.uid() 
  AND has_role(auth.uid(), 'super_admin'::user_role)
);

-- 4. Adicionar coluna organization_id à tabela stores
ALTER TABLE public.stores 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 5. Criar organização para a usuária atual (Bendito Boteco & Z Smash)
INSERT INTO public.organizations (nome, owner_id)
VALUES ('Bendito Boteco & Z Smash', 'e7c9e1e0-8835-4b1e-b6f4-55fa1af5e495');

-- 6. Vincular as 3 lojas existentes à organização criada
UPDATE public.stores
SET organization_id = (
  SELECT id FROM public.organizations 
  WHERE owner_id = 'e7c9e1e0-8835-4b1e-b6f4-55fa1af5e495' 
  LIMIT 1
)
WHERE id IN (
  'd2118d7f-a6d2-4cea-a077-3d93a0cb5663', -- Bendito Boteco - Pedra Branca
  'ee15ca04-eb0b-4d53-96b4-b45b7e1c42f9', -- Bendito Boteco - Mercadoteca
  '9cc8182f-5502-4416-a701-05665a56088f'  -- Z Smash Burger
);

-- 7. Atualizar RLS de checklist_responses para respeitar organizações
DROP POLICY IF EXISTS "Users can view responses from their store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Admins can view all responses" ON public.checklist_responses;

CREATE POLICY "Users can view responses based on organization"
ON public.checklist_responses
FOR SELECT
TO authenticated
USING (
  -- Usuário vê suas próprias respostas
  auth.uid() = user_id
  OR
  -- Admin vê respostas da própria loja
  (
    has_role(auth.uid(), 'admin'::user_role) 
    AND store_id = get_user_store_id(auth.uid())
  )
  OR
  -- Super_admin vê respostas de TODAS as lojas da sua organização
  (
    has_role(auth.uid(), 'super_admin'::user_role)
    AND store_id IN (
      SELECT s.id 
      FROM public.stores s
      INNER JOIN public.organizations o ON o.id = s.organization_id
      WHERE o.owner_id = auth.uid()
    )
  )
);

-- 8. Atualizar RLS de stores para incluir organization_id
DROP POLICY IF EXISTS "Users can view stores" ON public.stores;

CREATE POLICY "Users can view stores based on access"
ON public.stores
FOR SELECT
TO authenticated
USING (
  -- Super_admin vê lojas da própria organização
  (
    has_role(auth.uid(), 'super_admin'::user_role)
    AND organization_id IN (
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
  )
  OR
  -- Usuários comuns veem apenas sua loja
  (id = get_user_store_id(auth.uid()))
);

-- 9. Atualizar função de clonagem para suportar organizações
CREATE OR REPLACE FUNCTION public.clone_checklists_to_store(
  source_store_id UUID,
  target_store_id UUID,
  create_new_organization BOOLEAN DEFAULT FALSE,
  new_org_name TEXT DEFAULT NULL,
  new_org_owner_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  checklist_type RECORD;
  new_checklist_id UUID;
  items_copied INTEGER := 0;
  types_copied INTEGER := 0;
  new_organization_id UUID;
  caller_org_id UUID;
  row_count_temp INTEGER;
BEGIN
  -- 1. Verificar se usuário é super_admin
  IF NOT has_role(auth.uid(), 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'Apenas super_admins podem clonar checklists';
  END IF;

  -- 2. Obter organization_id da loja origem
  SELECT organization_id INTO caller_org_id
  FROM public.stores
  WHERE id = source_store_id;

  -- 3. Verificar se loja origem pertence à organização do caller
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = caller_org_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Você só pode clonar checklists das suas próprias lojas';
  END IF;

  -- 4. Se criar nova organização
  IF create_new_organization THEN
    IF new_org_name IS NULL OR new_org_owner_id IS NULL THEN
      RAISE EXCEPTION 'Nome e owner_id são obrigatórios para nova organização';
    END IF;

    -- Criar nova organização
    INSERT INTO public.organizations (nome, owner_id)
    VALUES (new_org_name, new_org_owner_id)
    RETURNING id INTO new_organization_id;

    -- Vincular loja destino à nova organização
    UPDATE public.stores
    SET organization_id = new_organization_id
    WHERE id = target_store_id;
  ELSE
    -- Vincular loja destino à organização do caller
    UPDATE public.stores
    SET organization_id = caller_org_id
    WHERE id = target_store_id;
  END IF;

  -- 5. Clonar checklists
  FOR checklist_type IN 
    SELECT * FROM public.checklist_types 
    WHERE store_id = source_store_id
    ORDER BY created_at
  LOOP
    INSERT INTO public.checklist_types (nome, area, turno, allowed_roles, store_id)
    VALUES (
      checklist_type.nome,
      checklist_type.area,
      checklist_type.turno,
      checklist_type.allowed_roles,
      target_store_id
    )
    RETURNING id INTO new_checklist_id;
    
    types_copied := types_copied + 1;

    INSERT INTO public.checklist_items (
      checklist_type_id,
      nome,
      ordem,
      requer_observacao,
      observacao_obrigatoria,
      requer_foto,
      store_id
    )
    SELECT
      new_checklist_id,
      nome,
      ordem,
      requer_observacao,
      observacao_obrigatoria,
      requer_foto,
      target_store_id
    FROM public.checklist_items
    WHERE checklist_type_id = checklist_type.id
    ORDER BY ordem;
    
    GET DIAGNOSTICS row_count_temp = ROW_COUNT;
    items_copied := items_copied + row_count_temp;
  END LOOP;

  -- 6. Registrar auditoria
  PERFORM log_audit_event(
    p_action_type := 'clone',
    p_resource_type := 'checklists',
    p_resource_id := target_store_id,
    p_resource_name := 'Checklist Templates',
    p_metadata := jsonb_build_object(
      'source_store_id', source_store_id,
      'target_store_id', target_store_id,
      'types_copied', types_copied,
      'items_copied', items_copied,
      'new_organization', create_new_organization,
      'new_org_name', new_org_name
    )
  );

  RETURN json_build_object(
    'success', true,
    'types_copied', types_copied,
    'items_copied', items_copied,
    'message', format('Clonados %s checklists com %s itens', types_copied, items_copied)
  );
END;
$$;

-- 10. Adicionar trigger para updated_at em organizations
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- MIGRATION: 20251104194822_6490647c-ff4c-4235-9f57-48c2522de7db.sql
-- ==========================================
-- Add sent_at column to email_invites table for tracking email delivery
ALTER TABLE public.email_invites
ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE;

-- ==========================================
-- MIGRATION: 20251105135048_07ad37a8-f529-48db-9815-b20eb54600b0.sql
-- ==========================================
-- Drop existing unique constraints
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_nome_key;
ALTER TABLE public.email_invites DROP CONSTRAINT IF EXISTS email_invites_email_key;

-- Add composite unique constraints to allow duplicates across organizations
ALTER TABLE public.stores 
  ADD CONSTRAINT stores_nome_organization_key 
  UNIQUE (nome, organization_id);

ALTER TABLE public.email_invites 
  ADD CONSTRAINT email_invites_email_store_key 
  UNIQUE (email, store_id);

-- ==========================================
-- MIGRATION: 20251105144857_b6746b3f-8047-482a-9bde-9aacf25551d9.sql
-- ==========================================
-- 1. Criar tabela de roles
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_name text NOT NULL,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, name)
);

-- 2. Habilitar RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS
CREATE POLICY "Users can view roles from their store"
  ON public.roles FOR SELECT
  TO authenticated
  USING (
    store_id = get_user_store_id(auth.uid()) OR
    has_role(auth.uid(), 'super_admin'::user_role)
  );

CREATE POLICY "Admins can manage roles"
  ON public.roles FOR ALL
  TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid())) OR
    has_role(auth.uid(), 'super_admin'::user_role)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid())) OR
    has_role(auth.uid(), 'super_admin'::user_role)
  );

-- 4. Popular com roles padrão para cada loja existente
INSERT INTO public.roles (store_id, name, display_name, is_system)
SELECT 
  s.id as store_id,
  role_data.name,
  role_data.display_name,
  true as is_system
FROM stores s
CROSS JOIN (
  VALUES 
    ('garcom', 'Garçom'),
    ('garconete', 'Garçonete'),
    ('atendente', 'Atendente'),
    ('lider', 'Líder'),
    ('cozinheiro', 'Cozinheiro'),
    ('cozinheiro_lider', 'Cozinheiro Líder'),
    ('auxiliar_cozinha', 'Auxiliar de Cozinha'),
    ('barman', 'Barman'),
    ('lider_bar', 'Líder de Bar'),
    ('admin', 'Admin'),
    ('super_admin', 'Super Admin')
) AS role_data(name, display_name)
ON CONFLICT (store_id, name) DO NOTHING;

-- 5. Adicionar coluna role_id em user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE;

-- 6. Migrar dados existentes de user_roles
UPDATE public.user_roles ur
SET role_id = r.id
FROM public.roles r
JOIN public.profiles p ON p.store_id = r.store_id
WHERE ur.user_id = p.id
  AND r.name = ur.role::text
  AND ur.role_id IS NULL;

-- 7. Adicionar coluna allowed_role_ids em checklist_types
ALTER TABLE public.checklist_types ADD COLUMN IF NOT EXISTS allowed_role_ids uuid[];

-- 8. Migrar allowed_roles para allowed_role_ids
UPDATE public.checklist_types ct
SET allowed_role_ids = (
  SELECT array_agg(DISTINCT r.id)
  FROM unnest(ct.allowed_roles) AS role_name
  JOIN public.roles r ON r.name = role_name::text AND r.store_id = ct.store_id
)
WHERE ct.allowed_role_ids IS NULL;

-- 9. Criar função para criar roles padrão em novas lojas
CREATE OR REPLACE FUNCTION public.create_default_roles_for_store()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.roles (store_id, name, display_name, is_system)
  VALUES 
    (NEW.id, 'garcom', 'Garçom', true),
    (NEW.id, 'garconete', 'Garçonete', true),
    (NEW.id, 'atendente', 'Atendente', true),
    (NEW.id, 'lider', 'Líder', true),
    (NEW.id, 'cozinheiro', 'Cozinheiro', true),
    (NEW.id, 'cozinheiro_lider', 'Cozinheiro Líder', true),
    (NEW.id, 'auxiliar_cozinha', 'Auxiliar de Cozinha', true),
    (NEW.id, 'barman', 'Barman', true),
    (NEW.id, 'lider_bar', 'Líder de Bar', true),
    (NEW.id, 'admin', 'Admin', true),
    (NEW.id, 'super_admin', 'Super Admin', true)
  ON CONFLICT (store_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 10. Criar trigger para novas lojas
DROP TRIGGER IF EXISTS on_store_created_roles ON public.stores;
CREATE TRIGGER on_store_created_roles
  AFTER INSERT ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_roles_for_store();

-- 11. Criar função auxiliar para obter role_id por nome
CREATE OR REPLACE FUNCTION public.get_role_id_by_name(_store_id uuid, _role_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.roles 
  WHERE store_id = _store_id AND name = _role_name
  LIMIT 1;
$$;

-- 12. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_roles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_roles_timestamp ON public.roles;
CREATE TRIGGER update_roles_timestamp
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_roles_updated_at();

-- ==========================================
-- MIGRATION: 20251105222041_44919dff-810f-4fb4-9786-455754d2e65f.sql
-- ==========================================
-- Create staging table for checklist items import
CREATE TABLE IF NOT EXISTS public.checklist_items_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  imported_by UUID NOT NULL REFERENCES public.profiles(id),
  nome TEXT NOT NULL,
  checklist_nome TEXT NOT NULL,
  checklist_type_id UUID REFERENCES public.checklist_types(id),
  ordem INTEGER,
  requer_observacao BOOLEAN DEFAULT false,
  observacao_obrigatoria BOOLEAN DEFAULT false,
  requer_foto BOOLEAN DEFAULT false,
  import_batch_id UUID NOT NULL,
  validation_status TEXT DEFAULT 'pending',
  validation_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staging_batch ON public.checklist_items_staging(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_staging_store ON public.checklist_items_staging(store_id);
CREATE INDEX IF NOT EXISTS idx_staging_checklist ON public.checklist_items_staging(checklist_type_id);

-- Enable RLS
ALTER TABLE public.checklist_items_staging ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage staging items"
ON public.checklist_items_staging
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

-- Create function to validate and import items from staging
CREATE OR REPLACE FUNCTION public.import_items_from_staging(p_batch_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id UUID;
  v_items_imported INTEGER := 0;
  v_checklist_stats JSONB := '[]'::jsonb;
  staging_item RECORD;
  v_max_order INTEGER;
BEGIN
  -- Get store_id from batch
  SELECT store_id INTO v_store_id
  FROM checklist_items_staging
  WHERE import_batch_id = p_batch_id
  LIMIT 1;

  -- Verify user has permission
  IF NOT (
    has_role(auth.uid(), 'super_admin'::user_role) OR
    (has_role(auth.uid(), 'admin'::user_role) AND v_store_id = get_user_store_id(auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão para importar itens';
  END IF;

  -- Process each staging item
  FOR staging_item IN 
    SELECT * FROM checklist_items_staging 
    WHERE import_batch_id = p_batch_id 
    AND validation_status = 'valid'
    ORDER BY checklist_type_id, ordem NULLS LAST
  LOOP
    -- Calculate order if not provided
    IF staging_item.ordem IS NULL THEN
      SELECT COALESCE(MAX(ordem), 0) INTO v_max_order
      FROM checklist_items
      WHERE checklist_type_id = staging_item.checklist_type_id;
      
      staging_item.ordem := v_max_order + 10;
    END IF;

    -- Insert item
    INSERT INTO checklist_items (
      checklist_type_id,
      nome,
      ordem,
      requer_observacao,
      observacao_obrigatoria,
      requer_foto,
      store_id
    ) VALUES (
      staging_item.checklist_type_id,
      staging_item.nome,
      staging_item.ordem,
      staging_item.requer_observacao,
      staging_item.observacao_obrigatoria,
      staging_item.requer_foto,
      staging_item.store_id
    );

    v_items_imported := v_items_imported + 1;
  END LOOP;

  -- Build stats
  SELECT jsonb_agg(
    jsonb_build_object(
      'checklist_id', ct.id,
      'checklist_nome', ct.nome,
      'items_added', COUNT(*)
    )
  ) INTO v_checklist_stats
  FROM checklist_items_staging s
  JOIN checklist_types ct ON ct.id = s.checklist_type_id
  WHERE s.import_batch_id = p_batch_id
  GROUP BY ct.id, ct.nome;

  -- Delete staging items
  DELETE FROM checklist_items_staging WHERE import_batch_id = p_batch_id;

  -- Log audit
  PERFORM log_audit_event(
    p_action_type := 'import',
    p_resource_type := 'checklist_items',
    p_resource_id := v_store_id,
    p_resource_name := 'Checklist Items Import',
    p_metadata := jsonb_build_object(
      'batch_id', p_batch_id,
      'items_imported', v_items_imported,
      'checklists_affected', v_checklist_stats
    )
  );

  RETURN json_build_object(
    'success', true,
    'items_imported', v_items_imported,
    'checklists_affected', v_checklist_stats
  );
END;
$$;

-- ==========================================
-- MIGRATION: 20251107003032_6b27f698-e477-4948-adc8-15360234b1e5.sql
-- ==========================================
-- ETAPA 1.1: Melhorias na tabela email_invites
-- Adicionar colunas para controle de reenvios e validade
ALTER TABLE email_invites 
ADD COLUMN IF NOT EXISTS resend_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days');

-- Criar índice para performance em consultas de convites expirados
CREATE INDEX IF NOT EXISTS idx_email_invites_expires_at ON email_invites(expires_at) WHERE used = false;

-- ETAPA 1.2: Melhorias na tabela stores
-- Adicionar colunas para informações completas do estabelecimento
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS endereco TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS email_contato TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Adicionar constraint de status separadamente
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'stores_status_check' 
    AND conrelid = 'stores'::regclass
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT stores_status_check CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;

-- Criar índice para filtros por status
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);

-- Criar trigger para atualizar updated_at automaticamente (drop primeiro se existir)
DROP TRIGGER IF EXISTS set_stores_updated_at ON stores;
CREATE TRIGGER set_stores_updated_at 
BEFORE UPDATE ON stores
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- MIGRATION: 20251107010643_225ae2d3-1bea-4cec-817b-9be033d43cf3.sql
-- ==========================================
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

-- ==========================================
-- MIGRATION: 20251107013243_89e3587a-6a64-406b-8a34-cb3ad588b48a.sql
-- ==========================================
-- Modify clone_checklists_to_store to allow super_admins to clone without organization validation
CREATE OR REPLACE FUNCTION public.clone_checklists_to_store(
  source_store_id uuid, 
  target_store_id uuid, 
  create_new_organization boolean DEFAULT false, 
  new_org_name text DEFAULT NULL::text, 
  new_org_owner_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  checklist_type RECORD;
  new_checklist_id UUID;
  items_copied INTEGER := 0;
  types_copied INTEGER := 0;
  new_organization_id UUID;
  caller_org_id UUID;
  row_count_temp INTEGER;
  is_super_admin BOOLEAN;
BEGIN
  -- 1. Verificar se usuário é super_admin
  SELECT has_role(auth.uid(), 'super_admin'::user_role) INTO is_super_admin;
  
  IF NOT is_super_admin AND NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem clonar checklists';
  END IF;

  -- 2. Obter organization_id da loja origem (pode ser NULL)
  SELECT organization_id INTO caller_org_id
  FROM public.stores
  WHERE id = source_store_id;

  -- 3. Validação de organização APENAS para admins regulares (não super_admins)
  IF NOT is_super_admin THEN
    -- Admins regulares precisam ter organização válida
    IF caller_org_id IS NULL THEN
      RAISE EXCEPTION 'A loja de origem precisa ter uma organização vinculada';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = caller_org_id AND owner_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Você só pode clonar checklists das suas próprias lojas';
    END IF;
  END IF;

  -- 4. Se criar nova organização
  IF create_new_organization THEN
    IF new_org_name IS NULL OR new_org_owner_id IS NULL THEN
      RAISE EXCEPTION 'Nome e owner_id são obrigatórios para nova organização';
    END IF;

    -- Criar nova organização
    INSERT INTO public.organizations (nome, owner_id)
    VALUES (new_org_name, new_org_owner_id)
    RETURNING id INTO new_organization_id;

    -- Vincular loja destino à nova organização
    UPDATE public.stores
    SET organization_id = new_organization_id
    WHERE id = target_store_id;
  ELSE
    -- Vincular loja destino à organização do caller (se existir)
    IF caller_org_id IS NOT NULL THEN
      UPDATE public.stores
      SET organization_id = caller_org_id
      WHERE id = target_store_id;
    END IF;
  END IF;

  -- 5. Clonar checklists
  FOR checklist_type IN 
    SELECT * FROM public.checklist_types 
    WHERE store_id = source_store_id
    ORDER BY created_at
  LOOP
    INSERT INTO public.checklist_types (nome, area, turno, allowed_roles, store_id)
    VALUES (
      checklist_type.nome,
      checklist_type.area,
      checklist_type.turno,
      checklist_type.allowed_roles,
      target_store_id
    )
    RETURNING id INTO new_checklist_id;
    
    types_copied := types_copied + 1;

    INSERT INTO public.checklist_items (
      checklist_type_id,
      nome,
      ordem,
      requer_observacao,
      observacao_obrigatoria,
      requer_foto,
      store_id
    )
    SELECT
      new_checklist_id,
      nome,
      ordem,
      requer_observacao,
      observacao_obrigatoria,
      requer_foto,
      target_store_id
    FROM public.checklist_items
    WHERE checklist_type_id = checklist_type.id
    ORDER BY ordem;
    
    GET DIAGNOSTICS row_count_temp = ROW_COUNT;
    items_copied := items_copied + row_count_temp;
  END LOOP;

  -- 6. Registrar auditoria
  PERFORM log_audit_event(
    p_action_type := 'clone',
    p_resource_type := 'checklists',
    p_resource_id := target_store_id,
    p_resource_name := 'Checklist Templates',
    p_metadata := jsonb_build_object(
      'source_store_id', source_store_id,
      'target_store_id', target_store_id,
      'types_copied', types_copied,
      'items_copied', items_copied,
      'new_organization', create_new_organization,
      'new_org_name', new_org_name
    )
  );

  RETURN json_build_object(
    'success', true,
    'types_copied', types_copied,
    'items_copied', items_copied,
    'message', format('Clonados %s checklists com %s itens', types_copied, items_copied)
  );
END;
$function$;

-- ==========================================
-- MIGRATION: 20251107015420_8b33b8ba-4526-4a5c-9214-8781ea494aeb.sql
-- ==========================================
-- Migração automática: Corrigir lojas órfãs sem organization_id
-- Associar lojas órfãs à organização do super_admin atual

DO $$
DECLARE
  orphan_store RECORD;
  super_admin_org_id uuid;
  current_super_admin_id uuid;
BEGIN
  -- Obter o ID do super_admin atual
  SELECT ur.user_id INTO current_super_admin_id
  FROM user_roles ur
  WHERE ur.role = 'super_admin'
  LIMIT 1;
  
  IF current_super_admin_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum super_admin encontrado no sistema';
  END IF;
  
  -- Obter a organização do super_admin
  SELECT id INTO super_admin_org_id
  FROM organizations
  WHERE owner_id = current_super_admin_id
  LIMIT 1;
  
  IF super_admin_org_id IS NULL THEN
    RAISE EXCEPTION 'Super_admin não possui organização';
  END IF;
  
  RAISE NOTICE 'Usando organização % do super_admin %', super_admin_org_id, current_super_admin_id;
  
  -- Atualizar todas as lojas órfãs para usar a organização do super_admin
  UPDATE stores 
  SET organization_id = super_admin_org_id
  WHERE organization_id IS NULL;
  
  RAISE NOTICE 'Migração de lojas órfãs concluída com sucesso!';
END $$;

-- ==========================================
-- MIGRATION: 20251107021855_898649d3-c6ec-44b3-8e1e-501835433ffe.sql
-- ==========================================
-- Modificar função handle_new_user para transferir ownership automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role_val user_role;
  user_store_id uuid;
  invite_record RECORD;
  store_org_id uuid;
BEGIN
  -- Check if email is invited
  SELECT * INTO invite_record
  FROM public.email_invites
  WHERE email = NEW.email AND used = false
  LIMIT 1;
  
  -- If no invite found, reject the signup
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Email não autorizado. Solicite um convite ao administrador.';
  END IF;
  
  -- Get role and store from invite
  user_role_val := invite_record.role;
  user_store_id := invite_record.store_id;
  
  -- Insert into profiles WITHOUT role (SECURITY FIX)
  INSERT INTO public.profiles (id, nome, email, store_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    user_store_id
  );
  
  -- Insert into user_roles (role stored ONLY here)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_val);
  
  -- Mark invite as used
  UPDATE public.email_invites
  SET used = true, used_at = NOW()
  WHERE id = invite_record.id;
  
  -- Se o role é 'admin', transferir ownership da organization
  IF user_role_val = 'admin' THEN
    -- Buscar organization_id da loja
    SELECT organization_id INTO store_org_id
    FROM public.stores
    WHERE id = user_store_id;
    
    -- Se a loja tem uma organization, transferir ownership
    IF store_org_id IS NOT NULL THEN
      UPDATE public.organizations