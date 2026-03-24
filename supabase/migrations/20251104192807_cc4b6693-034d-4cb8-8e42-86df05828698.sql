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