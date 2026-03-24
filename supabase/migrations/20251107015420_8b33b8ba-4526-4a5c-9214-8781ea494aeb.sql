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