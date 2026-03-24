-- Adicionar coluna para observação do colaborador
ALTER TABLE public.inspection_report_items 
ADD COLUMN employee_observation text;