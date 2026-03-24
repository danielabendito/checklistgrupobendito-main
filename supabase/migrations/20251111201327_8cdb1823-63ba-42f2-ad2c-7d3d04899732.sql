-- Drop existing policy
DROP POLICY IF EXISTS "Users can view their own responses" ON checklist_responses;

-- Create new improved policy
CREATE POLICY "Users can view their own responses" ON checklist_responses
FOR SELECT USING (
  (auth.uid() = user_id) 
  OR 
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
  OR
  (has_role(auth.uid(), 'super_admin'::user_role) AND 
   store_id IN (
     SELECT s.id FROM stores s 
     WHERE s.organization_id = (
       SELECT st.organization_id 
       FROM profiles p 
       JOIN stores st ON st.id = p.store_id 
       WHERE p.id = auth.uid()
     )
   ))
);