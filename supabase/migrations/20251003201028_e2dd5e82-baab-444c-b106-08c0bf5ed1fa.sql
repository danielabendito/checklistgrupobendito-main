-- Fix email exposure in profiles table
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view own profile, admins can view all" ON public.profiles;

-- Create a new policy that only allows users to see their own email
-- and admins to see emails only for users in their own store
CREATE POLICY "Users can view own profile, admins can view store profiles"
ON public.profiles
FOR SELECT
USING (
  (auth.uid() = id) 
  OR 
  (
    has_role(auth.uid(), 'admin'::user_role) 
    AND store_id = get_user_store_id(auth.uid())
  )
);

-- Also restrict the stores table so users can only see their own store
DROP POLICY IF EXISTS "Everyone can view stores" ON public.stores;

CREATE POLICY "Users can view their own store"
ON public.stores
FOR SELECT
USING (
  (auth.uid() IS NOT NULL) 
  AND 
  (
    id = get_user_store_id(auth.uid())
    OR has_role(auth.uid(), 'admin'::user_role)
  )
);