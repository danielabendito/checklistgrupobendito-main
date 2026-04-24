      SET owner_id = NEW.id, updated_at = NOW()
      WHERE id = store_org_id AND owner_id != NEW.id;
      
      -- Registrar auditoria da transferência
      PERFORM log_audit_event(
        p_action_type := 'ownership_transfer',
        p_resource_type := 'organization',
        p_resource_id := store_org_id,
        p_resource_name := 'Organization Ownership',
        p_old_values := jsonb_build_object('owner_id', (
          SELECT owner_id FROM public.organizations WHERE id = store_org_id
        )),
        p_new_values := jsonb_build_object('owner_id', NEW.id),
        p_metadata := jsonb_build_object(
          'new_admin_email', NEW.email,
          'store_id', user_store_id,
          'invite_id', invite_record.id,
          'transfer_reason', 'admin_invite_acceptance'
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ==========================================
-- MIGRATION: 20251107195624_a035d13f-5e92-4c84-9b41-a41f6bee8691.sql
-- ==========================================
-- ETAPA 3: Adicionar Foreign Key e NOT NULL em role_id

-- Adicionar foreign key (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_role_id_fkey'
  ) THEN
    ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey
    FOREIGN KEY (role_id)
    REFERENCES public.roles(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Tornar role_id obrigatório
ALTER TABLE public.user_roles
ALTER COLUMN role_id SET NOT NULL;

-- ETAPA 4: Corrigir a função handle_new_user() para preencher role_id automaticamente

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_role_val user_role;
  user_store_id uuid;
  invite_record RECORD;
  store_org_id uuid;
  role_uuid uuid;
BEGIN
  -- Check if email is invited
  SELECT * INTO invite_record
  FROM public.email_invites
  WHERE email = NEW.email AND used = false
  LIMIT 1;
  
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Email não autorizado. Solicite um convite ao administrador.';
  END IF;
  
  user_role_val := invite_record.role;
  user_store_id := invite_record.store_id;
  
  -- Buscar o role_id baseado no nome do role
  SELECT id INTO role_uuid
  FROM public.roles
  WHERE store_id = user_store_id
  AND name = user_role_val::text
  LIMIT 1;
  
  -- Insert into profiles WITHOUT role (SECURITY FIX)
  INSERT INTO public.profiles (id, nome, email, store_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    user_store_id
  );
  
  -- Insert into user_roles with role_id
  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (NEW.id, user_role_val, role_uuid);
  
  -- Mark invite as used
  UPDATE public.email_invites
  SET used = true, used_at = NOW()
  WHERE id = invite_record.id;
  
  -- Se o role é 'admin', transferir ownership da organization
  IF user_role_val = 'admin' THEN
    SELECT organization_id INTO store_org_id
    FROM public.stores
    WHERE id = user_store_id;
    
    IF store_org_id IS NOT NULL THEN
      UPDATE public.organizations
      SET owner_id = NEW.id, updated_at = NOW()
      WHERE id = store_org_id AND owner_id != NEW.id;
      
      PERFORM log_audit_event(
        p_action_type := 'ownership_transfer',
        p_resource_type := 'organization',
        p_resource_id := store_org_id,
        p_resource_name := 'Organization Ownership',
        p_old_values := jsonb_build_object('owner_id', (
          SELECT owner_id FROM public.organizations WHERE id = store_org_id
        )),
        p_new_values := jsonb_build_object('owner_id', NEW.id),
        p_metadata := jsonb_build_object(
          'new_admin_email', NEW.email,
          'store_id', user_store_id,
          'invite_id', invite_record.id,
          'transfer_reason', 'admin_invite_acceptance'
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ==========================================
-- MIGRATION: 20251107222823_333a7bc1-c3c6-48a2-b6ac-3701beecb000.sql
-- ==========================================
-- Remove UNIQUE constraint on organizations.owner_id to allow super_admins to manage multiple client organizations
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_owner_id_key;

-- Create index for performance on owner_id lookups
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);

-- Update RLS policy to allow super_admins to view all organizations they own (not just one)
DROP POLICY IF EXISTS "Super_admins can view their organization" ON public.organizations;

CREATE POLICY "Super_admins can view their organizations"
ON public.organizations FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  AND owner_id = auth.uid()
);

-- ==========================================
-- MIGRATION: 20251107223852_a56fb2ec-5a70-4c1c-b258-68800931045d.sql
-- ==========================================
-- Allow public read access to valid email invites during signup validation
CREATE POLICY "Allow public read for valid invites during signup"
ON public.email_invites FOR SELECT
USING (
  used = false 
  AND expires_at > now()
);

-- ==========================================
-- MIGRATION: 20251107224400_44b37a69-c5a7-4818-9861-2635498ddd6f.sql
-- ==========================================
-- Update log_audit_event to accept optional store_id parameter
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action_type text, 
  p_resource_type text, 
  p_resource_id uuid DEFAULT NULL::uuid, 
  p_resource_name text DEFAULT NULL::text, 
  p_old_values jsonb DEFAULT NULL::jsonb, 
  p_new_values jsonb DEFAULT NULL::jsonb, 
  p_metadata jsonb DEFAULT NULL::jsonb,
  p_store_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
  v_store_id UUID;
  v_audit_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Se store_id foi fornecido explicitamente, usa ele
  IF p_store_id IS NOT NULL THEN
    v_store_id := p_store_id;
    
    -- Buscar apenas nome e email
    SELECT nome, email 
    INTO v_user_name, v_user_email
    FROM public.profiles
    WHERE id = v_user_id;
  ELSE
    -- Comportamento antigo: buscar tudo do perfil
    SELECT nome, email, store_id 
    INTO v_user_name, v_user_email, v_store_id
    FROM public.profiles
    WHERE id = v_user_id;
  END IF;
  
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
$function$;

-- Update handle_new_user to pass store_id explicitly
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
  role_uuid uuid;
BEGIN
  -- Check if email is invited
  SELECT * INTO invite_record
  FROM public.email_invites
  WHERE email = NEW.email AND used = false
  LIMIT 1;
  
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Email não autorizado. Solicite um convite ao administrador.';
  END IF;
  
  user_role_val := invite_record.role;
  user_store_id := invite_record.store_id;
  
  -- Buscar o role_id baseado no nome do role
  SELECT id INTO role_uuid
  FROM public.roles
  WHERE store_id = user_store_id
  AND name = user_role_val::text
  LIMIT 1;
  
  -- Insert into profiles WITHOUT role (SECURITY FIX)
  INSERT INTO public.profiles (id, nome, email, store_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    user_store_id
  );
  
  -- Insert into user_roles with role_id
  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (NEW.id, user_role_val, role_uuid);
  
  -- Mark invite as used
  UPDATE public.email_invites
  SET used = true, used_at = NOW()
  WHERE id = invite_record.id;
  
  -- Se o role é 'admin', transferir ownership da organization
  IF user_role_val = 'admin' THEN
    SELECT organization_id INTO store_org_id
    FROM public.stores
    WHERE id = user_store_id;
    
    IF store_org_id IS NOT NULL THEN
      UPDATE public.organizations
      SET owner_id = NEW.id, updated_at = NOW()
      WHERE id = store_org_id AND owner_id != NEW.id;
      
      -- Passar store_id explicitamente para evitar NULL
      PERFORM log_audit_event(
        p_action_type := 'ownership_transfer',
        p_resource_type := 'organization',
        p_resource_id := store_org_id,
        p_resource_name := 'Organization Ownership',
        p_old_values := jsonb_build_object('owner_id', (
          SELECT owner_id FROM public.organizations WHERE id = store_org_id
        )),
        p_new_values := jsonb_build_object('owner_id', NEW.id),
        p_metadata := jsonb_build_object(
          'new_admin_email', NEW.email,
          'store_id', user_store_id,
          'invite_id', invite_record.id,
          'transfer_reason', 'admin_invite_acceptance'
        ),
        p_store_id := user_store_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ==========================================
-- MIGRATION: 20251108015831_052fbde3-014e-444d-bde8-52085187f573.sql
-- ==========================================
-- Fix RLS policy for stores table to ensure all users can see their own store
-- Drop existing policy
DROP POLICY IF EXISTS "Users can view stores based on access" ON public.stores;

-- Create improved policy that prioritizes user's own store access
CREATE POLICY "Users can view stores based on access"
ON public.stores
FOR SELECT
TO authenticated
USING (
  -- Super admins can see stores from organizations they own
  (
    has_role(auth.uid(), 'super_admin'::user_role) 
    AND organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  )
  -- OR any authenticated user can see their own store (prioritized check)
  OR (
    id IN (
      SELECT store_id FROM profiles WHERE id = auth.uid()
    )
  )
);

-- ==========================================
-- MIGRATION: 20251108020149_26057245-686b-4440-92ac-4b3648a8dd71.sql
-- ==========================================
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

-- ==========================================
-- MIGRATION: 20251108020621_ec07989a-901c-46a1-918d-33b86c3669cc.sql
-- ==========================================
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

-- ==========================================
-- MIGRATION: 20251108020958_46de4be3-96b7-4937-8dea-4f1277f3b890.sql
-- ==========================================
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

-- ==========================================
-- MIGRATION: 20251108151759_93cc0b9a-215b-4631-a8ad-941f8d41c193.sql
-- ==========================================
-- Recriar função can_view_store com SECURITY INVOKER para manter contexto de autenticação
CREATE OR REPLACE FUNCTION public.can_view_store(store_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER  -- MUDANÇA CRÍTICA: usar INVOKER ao invés de DEFINER
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

-- ==========================================
-- MIGRATION: 20251108153155_27e1e672-6c19-47b6-b486-aeb91fca55a2.sql
-- ==========================================
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

-- ==========================================
-- MIGRATION: 20251108154937_94d5c92c-e259-4c71-90a2-3753dbf0ae6d.sql
-- ==========================================
-- PASSO 1: Criar funções SECURITY DEFINER para quebrar loops de recursão

-- Função para obter store_id do usuário SEM acionar RLS
CREATE OR REPLACE FUNCTION public.get_user_store_id_direct(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Função para verificar role SEM recursão
CREATE OR REPLACE FUNCTION public.check_user_role_direct(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- PASSO 2: Recriar políticas de user_roles (SEM usar has_role)

-- Remover políticas antigas que causam recursão
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Admins podem ver todos os roles (SEM usar has_role para evitar recursão)
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- Admins podem gerenciar roles (SEM usar has_role)
CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- PASSO 3: Recriar políticas de profiles (SEM recursão)

-- Remover política que causa recursão com stores
DROP POLICY IF EXISTS "Allow profile access from owned stores" ON public.profiles;

-- Política 1: Usuário vê seu próprio perfil
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Política 2: Admin vê perfis da sua loja (usando função SECURITY DEFINER)
CREATE POLICY "Admins can view profiles from their store"
ON public.profiles
FOR SELECT
USING (
  public.check_user_role_direct(auth.uid(), 'admin'::user_role)
  AND store_id = public.get_user_store_id_direct(auth.uid())
);

-- Política 3: Super admin vê TODOS os perfis de lojas da sua organização
CREATE POLICY "Super admins can view all profiles from owned orgs"
ON public.profiles
FOR SELECT
USING (
  public.check_user_role_direct(auth.uid(), 'super_admin'::user_role)
  AND store_id IN (
    SELECT s.id 
    FROM public.stores s
    JOIN public.organizations o ON o.id = s.organization_id
    WHERE o.owner_id = auth.uid()
  )
);

-- PASSO 4: Adicionar política para admins verem sua própria loja

CREATE POLICY "Admins can view their own store"
ON public.stores
FOR SELECT
USING (
  id = public.get_user_store_id_direct(auth.uid())
  AND public.check_user_role_direct(auth.uid(), 'admin'::user_role)
);

-- ==========================================
-- MIGRATION: 20251108155305_fc0d68dd-5935-4f1f-9e5b-434efe28d417.sql
-- ==========================================
-- CORREÇÃO DEFINITIVA: Eliminar TODAS as recursões RLS

-- PASSO 1: Remover políticas problemáticas de profiles
DROP POLICY IF EXISTS "Admins can insert all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- PASSO 2: Recriar políticas de profiles SEM recursão

-- INSERT: Usar check_user_role_direct (SECURITY DEFINER)
CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (
  public.check_user_role_direct(auth.uid(), 'admin'::user_role) OR
  public.check_user_role_direct(auth.uid(), 'super_admin'::user_role)
);

-- UPDATE: Admins podem atualizar (usando SECURITY DEFINER)
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
USING (
  public.check_user_role_direct(auth.uid(), 'admin'::user_role) OR
  public.check_user_role_direct(auth.uid(), 'super_admin'::user_role)
);

-- UPDATE: Usuários podem atualizar apenas seu próprio nome (SEM subqueries!)
CREATE POLICY "Users can update own name"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
);

-- PASSO 3: Remover políticas problemáticas de stores
DROP POLICY IF EXISTS "Admins and super_admins can manage stores" ON public.stores;
DROP POLICY IF EXISTS "Users can view their own store" ON public.stores;

-- PASSO 4: Recriar políticas de stores SEM recursão

-- Admins podem gerenciar (usando check_user_role_direct)
CREATE POLICY "Admins can manage stores"
ON public.stores
FOR ALL
USING (
  public.check_user_role_direct(auth.uid(), 'admin'::user_role) OR
  public.check_user_role_direct(auth.uid(), 'super_admin'::user_role)
)
WITH CHECK (
  public.check_user_role_direct(auth.uid(), 'admin'::user_role) OR
  public.check_user_role_direct(auth.uid(), 'super_admin'::user_role)
);

-- Usuários veem sua loja (usando get_user_store_id_direct)
CREATE POLICY "Users can view own store"
ON public.stores
FOR SELECT
USING (
  id = public.get_user_store_id_direct(auth.uid())
);

-- ==========================================
-- MIGRATION: 20251108160040_8052232d-a960-47e5-83b2-d396718d0d34.sql
-- ==========================================
-- PLANO COMPLETO DE CORREÇÃO RLS
-- Objetivo: Colaboradores → apenas checklists | Admins → apenas própria loja | Super_admins → todas lojas da organização

-- ============================================
-- PASSO 1: CORRIGIR user_roles (URGENTE)
-- ============================================

-- Remover políticas recursivas
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Criar políticas SIMPLES sem recursão
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Permitir SELECT para funções SECURITY DEFINER funcionarem
CREATE POLICY "Enable read access for authenticated users"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Função SECURITY DEFINER para gerenciar roles (evita recursão)
CREATE OR REPLACE FUNCTION public.manage_user_role(
  p_user_id UUID,
  p_role user_role,
  p_role_id UUID,
  p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = ANY(ARRAY['admin'::user_role, 'super_admin'::user_role])
  ) INTO caller_is_admin;
  
  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem gerenciar roles';
  END IF;
  
  IF p_action = 'insert' THEN
    INSERT INTO public.user_roles (user_id, role, role_id)
    VALUES (p_user_id, p_role, p_role_id);
  ELSIF p_action = 'update' THEN
    UPDATE public.user_roles
    SET role = p_role, role_id = p_role_id
    WHERE user_id = p_user_id;
  ELSIF p_action = 'delete' THEN
    DELETE FROM public.user_roles WHERE user_id = p_user_id;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- ============================================
-- PASSO 2: CORRIGIR checklist_responses (SEGURANÇA - ISOLAMENTO DE LOJAS)
-- ============================================

-- Remover política insegura que permite admin ver TODAS as lojas
DROP POLICY IF EXISTS "Users can view their own responses" ON public.checklist_responses;
DROP POLICY IF EXISTS "Super_admins can view responses from owned stores" ON public.checklist_responses;

-- Recriar com isolamento correto por loja
CREATE POLICY "Users can view their own responses"
ON public.checklist_responses
FOR SELECT
USING (
  auth.uid() = user_id OR
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid())) OR
  (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
    SELECT s.id FROM stores s
    JOIN organizations o ON o.id = s.organization_id
    WHERE o.owner_id = auth.uid()
  ))
);

-- ============================================
-- PASSO 3: REVISAR checklist_items (ISOLAMENTO DE LOJAS)
-- ============================================

DROP POLICY IF EXISTS "Users can view checklist items from owned stores" ON public.checklist_items;

CREATE POLICY "Users can view checklist items from owned stores"
ON public.checklist_items
FOR SELECT
USING (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid())
    OR
    (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      JOIN organizations o ON o.id = s.organization_id
      WHERE o.owner_id = auth.uid()
    ))
    OR
    store_id = get_user_store_id(auth.uid())
  )
);

-- ============================================
-- PASSO 4: REVISAR checklist_types (ISOLAMENTO DE LOJAS)
-- ============================================

DROP POLICY IF EXISTS "Users can view checklist types from owned stores" ON public.checklist_types;

CREATE POLICY "Users can view checklist types from owned stores"
ON public.checklist_types
FOR SELECT
USING (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid())
    OR
    (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
      SELECT s.id FROM stores s
      JOIN organizations o ON o.id = s.organization_id
      WHERE o.owner_id = auth.uid()
    ))
    OR
    store_id = get_user_store_id(auth.uid())
  )
);

-- ============================================
-- PASSO 5: REVISAR profiles (ISOLAMENTO DE LOJAS)
-- ============================================

DROP POLICY IF EXISTS "Admins can view profiles from their store" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles from owned orgs" ON public.profiles;

-- Admin vê APENAS perfis da PRÓPRIA loja
CREATE POLICY "Admins can view profiles from their store"
ON public.profiles
FOR SELECT
USING (
  check_user_role_direct(auth.uid(), 'admin'::user_role) AND 
  store_id = get_user_store_id_direct(auth.uid())
);

-- Super_admin vê perfis de TODAS as lojas da organização
CREATE POLICY "Super admins can view all profiles from owned orgs"
ON public.profiles
FOR SELECT
USING (
  check_user_role_direct(auth.uid(), 'super_admin'::user_role) AND
  store_id IN (
    SELECT s.id FROM stores s
    JOIN organizations o ON o.id = s.organization_id
    WHERE o.owner_id = auth.uid()
  )
);

-- ============================================
-- PASSO 6: REVISAR stores (ISOLAMENTO DE LOJAS)
-- ============================================

DROP POLICY IF EXISTS "Admins can view their own store" ON public.stores;

-- Admin vê e gerencia APENAS a PRÓPRIA loja
CREATE POLICY "Admins can view their own store"
ON public.stores
FOR SELECT
USING (
  id = get_user_store_id_direct(auth.uid()) AND
  check_user_role_direct(auth.uid(), 'admin'::user_role)
);

-- ============================================
-- RESULTADO ESPERADO:
-- ✅ Colaboradores: APENAS checklists da sua loja
-- ✅ Admin: APENAS configurações da PRÓPRIA loja
-- ✅ Super Admin: ACESSO TOTAL a todas lojas da organização
-- ✅ Zero recursões RLS
-- ✅ Isolamento completo entre lojas
-- ============================================;

-- ==========================================
-- MIGRATION: 20251109025033_80908ec1-86bf-42ff-aeac-31c7d3676d2c.sql
-- ==========================================
-- Fix RLS policy for checklist_responses INSERT
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can insert their own responses" ON public.checklist_responses;

-- Create a simplified policy that allows users to insert their own responses
CREATE POLICY "Users can insert their own responses"
ON public.checklist_responses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- MIGRATION: 20251109025429_860c9205-b210-4dfc-ba85-b11f156d3c5d.sql
-- ==========================================
-- Fix UPDATE policy to allow upserts
DROP POLICY IF EXISTS "Users can update their own responses" ON public.checklist_responses;

CREATE POLICY "Users can update their own responses"
ON public.checklist_responses
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- MIGRATION: 20251111201327_8cdb1823-63ba-42f2-ad2c-7d3d04899732.sql
-- ==========================================
-- Drop existing policy
DROP POLICY IF EXISTS "Users can view their own responses" ON checklist_responses;

-- Create new improved policy
CREATE POLICY "Users can view their own responses" ON checklist_responses
FOR SELECT USING (
  (auth.uid() = user_id) 
  OR 
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR
  (has_role(auth.uid(), 'super_admin'::user_role) AND 
   store_id IN (
     SELECT s.id FROM stores s 
     WHERE s.organization_id = (
       SELECT st.organization_id 
       FROM profiles p 
       JOIN stores st ON st.id = p.store_id 
       WHERE p.id = auth.uid()
     )
   ))
);

-- ==========================================
-- MIGRATION: 20251209182513_8159d6be-d50a-4ddd-9efc-a85149ec50ec.sql
-- ==========================================
-- Corrigir função trigger_checklist_notification com sintaxe assíncrona do pg_net
CREATE OR REPLACE FUNCTION public.trigger_checklist_notification(turno_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  request_id bigint;
BEGIN
  -- Chamar edge function de forma assíncrona via pg_net
  -- net.http_post retorna apenas o request_id, não status/content
  SELECT net.http_post(
    url := 'https://qwetfynfpfjruswdnaps.supabase.co/functions/v1/send-checklist-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZXRmeW5mcGZqcnVzd2RuYXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjUyOTUsImV4cCI6MjA3NTAwMTI5NX0.RaE8VDPT3wGS3uPOJR5jsQqh6zS1glMwBncu2l01nB8'
    ),
    body := jsonb_build_object('turno', turno_param),
    timeout_milliseconds := 30000
  ) INTO request_id;
  
  RAISE NOTICE 'Notification request queued for turno: % (request_id: %)', turno_param, request_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger notification for turno %: % (SQLSTATE: %)', 
      turno_param, SQLERRM, SQLSTATE;
END;
$function$;

-- ==========================================
-- MIGRATION: 20251209184119_37baf36a-e90c-4cda-9942-54ec31cea19a.sql
-- ==========================================
-- 1. Atualizar função delete_user_account para limpar convite e permitir recadastro
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
  target_email text;
BEGIN
  -- Check if caller is super_admin
  SELECT has_role(auth.uid(), 'super_admin'::user_role) INTO is_super_admin;

  -- Get the store_id and email of the target user
  SELECT store_id, email INTO target_store_id, target_email
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

  -- Super_admin can delete users from any store in their organization
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

  -- Delete from user_roles
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- Delete from profiles
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
  
  -- Limpar convite usado para permitir recadastro com mesmo email
  DELETE FROM public.email_invites 
  WHERE email = target_email AND store_id = target_store_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário excluído com sucesso. O email pode ser recadastrado.'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$function$;

-- 2. Corrigir política RLS para super_admins verem todos os usuários da organização
DROP POLICY IF EXISTS "Super admins can view all profiles from owned orgs" ON public.profiles;

CREATE POLICY "Super admins can view all profiles from organization stores" 
ON public.profiles
FOR SELECT
USING (
  check_user_role_direct(auth.uid(), 'super_admin'::user_role)
  AND store_id IN (
    SELECT s.id 
    FROM stores s
    WHERE s.organization_id IN (
      SELECT st.organization_id 
      FROM profiles p
      JOIN stores st ON st.id = p.store_id
      WHERE p.id = auth.uid()
    )
  )
);

-- ==========================================
-- MIGRATION: 20251209184603_8188abc8-0d54-44ff-b09b-f7b0b02c2117.sql
-- ==========================================
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

-- ==========================================
-- MIGRATION: 20251210012559_b357ef39-ae04-408b-ac46-29b97921adfc.sql
-- ==========================================
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

-- ==========================================
-- MIGRATION: 20251210014049_19bf22e1-5f99-473b-b7a2-0cfb10b4c24b.sql
-- ==========================================
-- Criar função SECURITY DEFINER para excluir loja e todos os dados relacionados
CREATE OR REPLACE FUNCTION public.delete_store_account(target_store_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_org_id uuid;
  target_org_id uuid;
  target_store_name text;
  caller_store_id uuid;
  users_deleted integer := 0;
  checklists_deleted integer := 0;
  responses_deleted integer := 0;
  user_ids uuid[];
BEGIN
  -- Verificar se é super_admin
  IF NOT has_role(auth.uid(), 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'Apenas super_admin pode excluir lojas';
  END IF;

  -- Buscar store_id do chamador
  caller_store_id := get_user_store_id(auth.uid());
  
  -- Não pode excluir a própria loja
  IF target_store_id = caller_store_id THEN
    RAISE EXCEPTION 'Você não pode excluir a loja onde está logado';
  END IF;

  -- Verificar se está na mesma organização
  caller_org_id := get_user_organization_id(auth.uid());
  
  SELECT organization_id, nome INTO target_org_id, target_store_name
  FROM stores WHERE id = target_store_id;

  IF target_org_id IS NULL OR target_org_id != caller_org_id THEN
    RAISE EXCEPTION 'Você só pode excluir lojas da sua organização';
  END IF;

  -- Contar dados para retorno
  SELECT COUNT(*) INTO users_deleted FROM profiles WHERE store_id = target_store_id;
  SELECT COUNT(*) INTO checklists_deleted FROM checklist_types WHERE store_id = target_store_id;
  SELECT COUNT(*) INTO responses_deleted FROM checklist_responses WHERE store_id = target_store_id;

  -- Coletar IDs dos usuários da loja alvo
  SELECT ARRAY_AGG(id) INTO user_ids FROM profiles WHERE store_id = target_store_id;

  -- Excluir em cascata (ordem correta para evitar FK violations)
  IF user_ids IS NOT NULL AND array_length(user_ids, 1) > 0 THEN
    DELETE FROM user_roles WHERE user_id = ANY(user_ids);
    DELETE FROM auth.users WHERE id = ANY(user_ids);
  END IF;
  
  DELETE FROM profiles WHERE store_id = target_store_id;
  DELETE FROM checklist_responses WHERE store_id = target_store_id;
  DELETE FROM checklist_items WHERE store_id = target_store_id;
  DELETE FROM checklist_types WHERE store_id = target_store_id;
  DELETE FROM checklist_items_staging WHERE store_id = target_store_id;
  DELETE FROM checklist_notifications WHERE checklist_type_id IN (
    SELECT id FROM checklist_types WHERE store_id = target_store_id
  );
  DELETE FROM email_invites WHERE store_id = target_store_id;
  DELETE FROM notifications WHERE store_id = target_store_id;
  DELETE FROM admin_settings WHERE store_id = target_store_id;
  DELETE FROM roles WHERE store_id = target_store_id;
  DELETE FROM stores WHERE id = target_store_id;

  -- Registrar no audit log (na loja do caller)
  PERFORM log_audit_event(
    p_action_type := 'delete',
    p_resource_type := 'store',
    p_resource_id := target_store_id,
    p_resource_name := target_store_name,
    p_metadata := jsonb_build_object(
      'users_deleted', users_deleted,
      'checklists_deleted', checklists_deleted,
      'responses_deleted', responses_deleted
    ),
    p_store_id := caller_store_id
  );

  RETURN json_build_object(
    'success', true,
    'message', format('Loja "%s" excluída com sucesso', target_store_name),
    'users_deleted', users_deleted,
    'checklists_deleted', checklists_deleted,
    'responses_deleted', responses_deleted
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$function$;

-- ==========================================
-- MIGRATION: 20251223195321_37551d47-0117-4a4f-a91e-06cb53fa28da.sql
-- ==========================================
-- Tabela: Padrões de Inspeção (fotos de referência + critérios por loja/item)
CREATE TABLE public.inspection_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  criteria TEXT NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  reference_photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, checklist_item_id)
);

-- Tabela: Relatórios de Inspeção
CREATE TABLE public.inspection_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  checklist_type_id UUID NOT NULL REFERENCES checklist_types(id) ON DELETE CASCADE,
  execution_date DATE NOT NULL,
  executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  executed_by_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')),
  total_approved INTEGER DEFAULT 0,
  total_rejected INTEGER DEFAULT 0,
  total_inconclusive INTEGER DEFAULT 0,
  summary TEXT,
  priority_actions JSONB DEFAULT '[]',
  whatsapp_sent_at TIMESTAMPTZ,
  whatsapp_recipients TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: Itens do Relatório de Inspeção
CREATE TABLE public.inspection_report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES inspection_reports(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('approved', 'rejected', 'inconclusive')),
  verdict_summary TEXT,
  observation TEXT,
  corrective_action TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  evidence_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar coluna whatsapp_recipients na tabela stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS whatsapp_recipients TEXT[] DEFAULT '{}';

-- Habilitar RLS em todas as novas tabelas
ALTER TABLE public.inspection_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_report_items ENABLE ROW LEVEL SECURITY;

-- RLS: inspection_standards - Apenas admin/super_admin podem gerenciar
CREATE POLICY "Admins can manage inspection standards"
ON public.inspection_standards
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR has_role(auth.uid(), 'super_admin'::user_role)
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

-- RLS: inspection_reports - Apenas admin/super_admin podem visualizar
CREATE POLICY "Admins can view inspection reports"
ON public.inspection_reports
FOR SELECT
USING (
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR (has_role(auth.uid(), 'super_admin'::user_role) AND store_id IN (
    SELECT s.id FROM stores s WHERE s.organization_id = get_user_organization_id(auth.uid())
  ))
);

-- RLS: inspection_reports - Sistema pode inserir (via edge function)
CREATE POLICY "System can insert inspection reports"
ON public.inspection_reports
FOR INSERT
WITH CHECK (true);

-- RLS: inspection_reports - Admins podem atualizar (para reenvio WhatsApp)
CREATE POLICY "Admins can update inspection reports"
ON public.inspection_reports
FOR UPDATE
USING (
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

-- RLS: inspection_report_items - Apenas admin/super_admin podem visualizar
CREATE POLICY "Admins can view inspection report items"
ON public.inspection_report_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM inspection_reports ir
    WHERE ir.id = report_id
    AND (
      (has_role(auth.uid(), 'admin'::user_role) AND ir.store_id = get_user_store_id(auth.uid()))
      OR (has_role(auth.uid(), 'super_admin'::user_role) AND ir.store_id IN (
        SELECT s.id FROM stores s WHERE s.organization_id = get_user_organization_id(auth.uid())
      ))
    )
  )
);

-- RLS: inspection_report_items - Sistema pode inserir
CREATE POLICY "System can insert inspection report items"
ON public.inspection_report_items
FOR INSERT
WITH CHECK (true);

-- Criar bucket para fotos de referência
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-references', 'inspection-references', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Admins podem fazer upload de fotos de referência
CREATE POLICY "Admins can upload reference photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'inspection-references'
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role))
);

-- Storage policy: Admins podem deletar fotos de referência
CREATE POLICY "Admins can delete reference photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'inspection-references'
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role))
);

-- Storage policy: Todos podem visualizar fotos de referência (necessário para IA)
CREATE POLICY "Anyone can view reference photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'inspection-references');

-- Trigger para atualizar updated_at em inspection_standards
CREATE TRIGGER update_inspection_standards_updated_at
BEFORE UPDATE ON public.inspection_standards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- MIGRATION: 20251226130836_53acf660-6371-4be9-ad14-d679347a93e7.sql
-- ==========================================
-- Atualizar função delete_user_account para garantir remoção completa
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
  target_email text;
  target_name text;
BEGIN
  -- Check if caller is super_admin
  SELECT has_role(auth.uid(), 'super_admin'::user_role) INTO is_super_admin;

  -- Get the store_id, email and name of the target user
  SELECT store_id, email, nome INTO target_store_id, target_email, target_name
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

  -- Super_admin can delete users from any store in their organization
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

  -- 1. Delete from user_roles first (FK constraint)
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- 2. Delete from profiles
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- 3. CRITICAL: Delete from auth.users (this is what was potentially failing)
  DELETE FROM auth.users WHERE id = target_user_id;
  
  -- 4. Clear any related invites to allow re-registration with same email
  IF target_email IS NOT NULL THEN
    DELETE FROM public.email_invites 
    WHERE email = target_email;
  END IF;

  -- Log the deletion for audit
  PERFORM log_audit_event(
    p_action_type := 'delete',
    p_resource_type := 'user',
    p_resource_id := target_user_id,
    p_resource_name := COALESCE(target_name, target_email, 'Unknown'),
    p_metadata := jsonb_build_object(
      'deleted_email', target_email,
      'deleted_from_store', target_store_id
    ),
    p_store_id := caller_store_id
  );

  RETURN json_build_object(
    'success', true,
    'message', format('Usuário %s excluído com sucesso. O email pode ser recadastrado.', COALESCE(target_email, 'desconhecido'))
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM,
      'error_detail', SQLSTATE
    );
END;
$function$;

-- ==========================================
-- MIGRATION: 20251226153340_570128fc-5f44-4577-b397-b6e9dae9076f.sql
-- ==========================================
-- Adicionar colunas para canais de notificação na tabela admin_settings
ALTER TABLE admin_settings 
  ADD COLUMN IF NOT EXISTS notification_channel_email boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_channel_whatsapp boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_whatsapp_number text DEFAULT NULL;

-- Adicionar colunas para WhatsApp na tabela email_invites
ALTER TABLE email_invites 
  ADD COLUMN IF NOT EXISTS whatsapp_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamp with time zone DEFAULT NULL;

-- ==========================================
-- MIGRATION: 20251226184155_e8d4c0de-3b46-4200-b83f-e5ebd200e67d.sql
-- ==========================================
-- 1. Tornar email opcional na tabela email_invites
ALTER TABLE email_invites ALTER COLUMN email DROP NOT NULL;

-- 2. Adicionar campo para tipo de convite (email ou phone)
ALTER TABLE email_invites ADD COLUMN invite_type text 
  DEFAULT 'email' CHECK (invite_type IN ('email', 'phone'));

-- 3. Garantir que pelo menos um identificador existe (email ou whatsapp_number)
ALTER TABLE email_invites ADD CONSTRAINT email_or_phone_required 
  CHECK (email IS NOT NULL OR whatsapp_number IS NOT NULL);

-- 4. Tornar email opcional na tabela profiles
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

-- 5. Adicionar campo de telefone na tabela profiles
ALTER TABLE profiles ADD COLUMN phone text DEFAULT NULL;

-- 6. Garantir que pelo menos um identificador existe (email ou phone)
ALTER TABLE profiles ADD CONSTRAINT profile_email_or_phone_required 
  CHECK (email IS NOT NULL OR phone IS NOT NULL);

-- 7. Atualizar função handle_new_user para suportar cadastro via telefone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  user_role_val user_role;
  user_store_id uuid;
  invite_record RECORD;
  store_org_id uuid;
  role_uuid uuid;
BEGIN
  -- Buscar convite por email OU telefone (whatsapp_number para convites de telefone)
  SELECT * INTO invite_record
  FROM public.email_invites
  WHERE (
    (email IS NOT NULL AND email = NEW.email) OR
    (invite_type = 'phone' AND whatsapp_number IS NOT NULL AND whatsapp_number = NEW.phone)
  )
  AND used = false
  LIMIT 1;
  
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Não autorizado. Solicite um convite ao administrador.';
  END IF;
  
  user_role_val := invite_record.role;
  user_store_id := invite_record.store_id;
  
  -- Buscar o role_id baseado no nome do role
  SELECT id INTO role_uuid
  FROM public.roles
  WHERE store_id = user_store_id
  AND name = user_role_val::text
  LIMIT 1;
  
  -- Insert into profiles com email OU telefone
  INSERT INTO public.profiles (id, nome, email, phone, store_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,    -- Pode ser NULL para cadastros via telefone
    NEW.phone,    -- Pode ser NULL para cadastros via email
    user_store_id
  );
  
  -- Insert into user_roles with role_id
  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (NEW.id, user_role_val, role_uuid);
  
  -- Mark invite as used
  UPDATE public.email_invites
  SET used = true, used_at = NOW()
  WHERE id = invite_record.id;
  
  -- Se o role é 'admin', transferir ownership da organization
  IF user_role_val = 'admin' THEN
    SELECT organization_id INTO store_org_id
    FROM public.stores
    WHERE id = user_store_id;
    
    IF store_org_id IS NOT NULL THEN
      UPDATE public.organizations
      SET owner_id = NEW.id, updated_at = NOW()
      WHERE id = store_org_id AND owner_id != NEW.id;
      
      -- Passar store_id explicitamente para evitar NULL
      PERFORM log_audit_event(
        p_action_type := 'ownership_transfer',
        p_resource_type := 'organization',
        p_resource_id := store_org_id,
        p_resource_name := 'Organization Ownership',
        p_old_values := jsonb_build_object('owner_id', (
          SELECT owner_id FROM public.organizations WHERE id = store_org_id
        )),
        p_new_values := jsonb_build_object('owner_id', NEW.id),
        p_metadata := jsonb_build_object(
          'new_admin_email', COALESCE(NEW.email, NEW.phone),
          'store_id', user_store_id,
          'invite_id', invite_record.id,
          'transfer_reason', 'admin_invite_acceptance'
        ),
        p_store_id := user_store_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ==========================================
-- MIGRATION: 20251226185154_76dd72ac-4ad4-4e33-8c8d-633d89782adf.sql
-- ==========================================
-- Adicionar coluna invitee_name na tabela email_invites
ALTER TABLE public.email_invites 
ADD COLUMN invitee_name text DEFAULT NULL;

COMMENT ON COLUMN public.email_invites.invitee_name IS 'Nome do colaborador convidado';

-- ==========================================
-- MIGRATION: 20251227131728_55655d9a-3fb4-44d6-ab49-e9711921c759.sql
-- ==========================================
-- Atualizar função handle_new_user para suportar cadastro via telefone usando email virtual
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
  role_uuid uuid;
  phone_from_email text;
BEGIN
  -- Extrair telefone do email virtual (formato: 5548999999999@phone.grupobenditopb.internal)
  IF NEW.email LIKE '%@phone.grupobenditopb.internal' THEN
    phone_from_email := split_part(NEW.email, '@', 1);
  ELSE
    phone_from_email := NULL;
  END IF;

  -- Buscar convite por email OU telefone (whatsapp_number para convites de telefone)
  SELECT * INTO invite_record
  FROM public.email_invites
  WHERE (
    -- Convite de email tradicional
    (invite_type = 'email' AND email IS NOT NULL AND email = NEW.email) OR
    -- Convite de telefone - comparar whatsapp_number com telefone extraído do email virtual
    (invite_type = 'phone' AND whatsapp_number IS NOT NULL AND phone_from_email IS NOT NULL AND whatsapp_number = phone_from_email)
  )
  AND used = false
  LIMIT 1;
  
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Não autorizado. Solicite um convite ao administrador.';
  END IF;
  
  user_role_val := invite_record.role;
  user_store_id := invite_record.store_id;
  
  -- Buscar o role_id baseado no nome do role
  SELECT id INTO role_uuid
  FROM public.roles
  WHERE store_id = user_store_id
  AND name = user_role_val::text
  LIMIT 1;
  
  -- Insert into profiles
  -- Para cadastros de telefone, armazenar o telefone no campo phone
  INSERT INTO public.profiles (id, nome, email, phone, store_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', invite_record.invitee_name, ''),
    CASE 
      WHEN phone_from_email IS NOT NULL THEN NULL  -- Não salvar email virtual
      ELSE NEW.email 
    END,
    CASE 
      WHEN phone_from_email IS NOT NULL THEN phone_from_email
      ELSE NEW.phone
    END,
    user_store_id
  );
  
  -- Insert into user_roles with role_id
  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (NEW.id, user_role_val, role_uuid);
  
  -- Mark invite as used
  UPDATE public.email_invites
  SET used = true, used_at = NOW()
  WHERE id = invite_record.id;
  
  -- Se o role é 'admin', transferir ownership da organization
  IF user_role_val = 'admin' THEN
    SELECT organization_id INTO store_org_id
    FROM public.stores
    WHERE id = user_store_id;
    
    IF store_org_id IS NOT NULL THEN
      UPDATE public.organizations
      SET owner_id = NEW.id, updated_at = NOW()
      WHERE id = store_org_id AND owner_id != NEW.id;
      
      -- Passar store_id explicitamente para evitar NULL
      PERFORM log_audit_event(
        p_action_type := 'ownership_transfer',
        p_resource_type := 'organization',
        p_resource_id := store_org_id,
        p_resource_name := 'Organization Ownership',
        p_old_values := jsonb_build_object('owner_id', (
          SELECT owner_id FROM public.organizations WHERE id = store_org_id
        )),
        p_new_values := jsonb_build_object('owner_id', NEW.id),
        p_metadata := jsonb_build_object(
          'new_admin_email', COALESCE(NEW.email, phone_from_email),
          'store_id', user_store_id,
          'invite_id', invite_record.id,
          'transfer_reason', 'admin_invite_acceptance'
        ),
        p_store_id := user_store_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ==========================================
-- MIGRATION: 20251228144808_d80d8160-f27c-4f91-bd10-258aa0b129b1.sql
-- ==========================================
-- Adicionar coluna para observação do colaborador
ALTER TABLE public.inspection_report_items 
ADD COLUMN employee_observation text;

-- ==========================================
-- MIGRATION: 20251228145740_a95c8750-19b4-4875-a315-f82ab5828200.sql
-- ==========================================
-- Add enabled column to inspection_standards table
ALTER TABLE public.inspection_standards 
ADD COLUMN enabled boolean NOT NULL DEFAULT true;

-- ==========================================
-- MIGRATION: 20260121225458_b8ce5477-3a67-41cb-889d-452e864da14e.sql
-- ==========================================
-- Atualizar bucket para limitar tamanho de arquivos e tipos permitidos
UPDATE storage.buckets 
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'checklist-photos';

-- ==========================================
-- MIGRATION: 20260203153222_97a919bd-bf95-4a94-b77a-6fb0e5cd27c4.sql
-- ==========================================
-- Habilitar Realtime na tabela checklist_items para sincronização em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_items;

-- ==========================================
-- MIGRATION: 20260311150030_c096bc2c-fade-42d7-9457-bb8df11d7960.sql
-- ==========================================
ALTER TABLE public.admin_settings ADD COLUMN notification_whatsapp_numbers text[] DEFAULT '{}'::text[];

-- Migrate existing data
UPDATE public.admin_settings 
SET notification_whatsapp_numbers = ARRAY[notification_whatsapp_number]
WHERE notification_whatsapp_number IS NOT NULL AND notification_whatsapp_number != '';
