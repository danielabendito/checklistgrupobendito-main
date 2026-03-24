-- FASE 1: Corrigir Foreign Key para preservar checklists
-- Remover constraint CASCADE atual
ALTER TABLE public.checklist_responses 
DROP CONSTRAINT IF EXISTS checklist_responses_user_id_fkey;

-- Tornar user_id nullable
ALTER TABLE public.checklist_responses 
ALTER COLUMN user_id DROP NOT NULL;

-- Adicionar nova constraint com SET NULL
ALTER TABLE public.checklist_responses 
ADD CONSTRAINT checklist_responses_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;

-- Adicionar comentário de documentação
COMMENT ON COLUMN public.checklist_responses.user_id IS 
'ID do usuário que preencheu o checklist. Pode ser NULL se o usuário foi excluído, preservando o histórico.';

-- FASE 2: Adicionar campos de auditoria
-- Adicionar colunas para preservar informações do usuário
ALTER TABLE public.checklist_responses 
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Preencher registros existentes com dados dos usuários atuais
UPDATE public.checklist_responses cr
SET 
  user_name = p.nome,
  user_email = p.email
FROM public.profiles p
WHERE cr.user_id = p.id
  AND cr.user_name IS NULL;

-- FASE 3: Criar trigger para preencher automaticamente
CREATE OR REPLACE FUNCTION public.set_response_user_info()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT nome, email 
    INTO NEW.user_name, NEW.user_email
    FROM public.profiles
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Criar trigger para BEFORE INSERT
DROP TRIGGER IF EXISTS before_insert_response_user_info ON public.checklist_responses;
CREATE TRIGGER before_insert_response_user_info
BEFORE INSERT ON public.checklist_responses
FOR EACH ROW
EXECUTE FUNCTION public.set_response_user_info();