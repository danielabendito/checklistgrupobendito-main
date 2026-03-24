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