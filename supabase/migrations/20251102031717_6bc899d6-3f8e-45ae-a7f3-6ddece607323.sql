-- Corrigir políticas RLS da tabela checklist_responses

-- FASE 1: Corrigir política de INSERT
DROP POLICY IF EXISTS "Users can insert their own responses" ON public.checklist_responses;

CREATE POLICY "Users can insert their own responses"
ON public.checklist_responses
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    user_id IS NULL  -- Permite NULL durante inserção (trigger preencherá)
    OR auth.uid() = user_id  -- Ou se já estiver preenchido, deve ser o próprio usuário
  )
);

-- FASE 2: Corrigir política de UPDATE
DROP POLICY IF EXISTS "Users can update their own responses" ON public.checklist_responses;

CREATE POLICY "Users can update their own responses"
ON public.checklist_responses
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id  -- Usuário só pode editar suas próprias respostas
  AND data = CURRENT_DATE  -- Apenas respostas do dia atual
)
WITH CHECK (
  auth.uid() = user_id  -- Garantir que user_id não seja alterado para outro usuário
  AND data = CURRENT_DATE
);