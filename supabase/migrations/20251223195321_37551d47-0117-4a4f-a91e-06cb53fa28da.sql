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