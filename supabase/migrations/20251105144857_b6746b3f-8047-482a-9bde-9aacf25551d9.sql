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