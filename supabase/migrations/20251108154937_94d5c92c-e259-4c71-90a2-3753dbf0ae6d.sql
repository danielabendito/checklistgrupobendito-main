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