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