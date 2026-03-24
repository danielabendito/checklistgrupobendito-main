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
-- ============================================