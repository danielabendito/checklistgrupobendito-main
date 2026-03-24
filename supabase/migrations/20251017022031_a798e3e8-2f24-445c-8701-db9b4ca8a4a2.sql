-- Adicionar coluna para registrar horário de conclusão do checklist
ALTER TABLE public.checklist_responses
ADD COLUMN completed_at timestamp with time zone;

-- Atualizar registros existentes para usar created_at como completed_at
UPDATE public.checklist_responses
SET completed_at = created_at
WHERE completed_at IS NULL;