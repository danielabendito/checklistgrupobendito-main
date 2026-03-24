-- Reset observation and photo fields for all existing checklist items
UPDATE public.checklist_items
SET requer_observacao = false, requer_foto = false;