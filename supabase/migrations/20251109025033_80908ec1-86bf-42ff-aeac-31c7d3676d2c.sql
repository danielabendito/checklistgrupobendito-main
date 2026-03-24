-- Fix RLS policy for checklist_responses INSERT
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can insert their own responses" ON public.checklist_responses;

-- Create a simplified policy that allows users to insert their own responses
CREATE POLICY "Users can insert their own responses"
ON public.checklist_responses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
