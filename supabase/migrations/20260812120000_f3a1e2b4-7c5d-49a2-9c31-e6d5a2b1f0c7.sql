-- Allow admins to pause/reactivate a checklist type without deleting it
-- (e.g. a section of the restaurant closed for renovation).
ALTER TABLE public.checklist_types
ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.checklist_types.ativo IS
  'Quando false, o checklist fica pausado: nao aparece para os colaboradores preencherem, mas o historico de respostas ja registradas continua visivel nos relatorios.';
