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