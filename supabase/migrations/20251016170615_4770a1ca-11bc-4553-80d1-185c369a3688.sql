
-- Update RLS policy for checklist_responses to allow admins to view ALL responses across all stores
DROP POLICY IF EXISTS "Admins can view all responses" ON checklist_responses;

CREATE POLICY "Admins can view all responses across all stores" 
ON checklist_responses 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::user_role)
);

-- Also update the policy for viewing profiles across stores
DROP POLICY IF EXISTS "Users can view own profile, admins can view store profiles" ON profiles;

CREATE POLICY "Users can view own profile, admins can view all profiles" 
ON profiles 
FOR SELECT 
USING (
  (auth.uid() = id) OR has_role(auth.uid(), 'admin'::user_role)
);
