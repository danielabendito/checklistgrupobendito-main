-- Adicionar coluna para marcar observação como obrigatória
ALTER TABLE checklist_items 
ADD COLUMN observacao_obrigatoria boolean NOT NULL DEFAULT false;