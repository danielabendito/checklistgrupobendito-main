-- Fix UPDATE policy to allow upserts
DROP POLICY IF EXISTS "Users can update their own responses" ON public.checklist_responses;

CREATE POLICY "Users can update their own responses"
ON public.checklist_responses
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
