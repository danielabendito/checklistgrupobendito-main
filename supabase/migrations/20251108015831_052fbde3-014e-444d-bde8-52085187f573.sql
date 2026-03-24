-- Fix RLS policy for stores table to ensure all users can see their own store
-- Drop existing policy
DROP POLICY IF EXISTS "Users can view stores based on access" ON public.stores;

-- Create improved policy that prioritizes user's own store access
CREATE POLICY "Users can view stores based on access"
ON public.stores
FOR SELECT
TO authenticated
USING (
  -- Super admins can see stores from organizations they own
  (
    has_role(auth.uid(), 'super_admin'::user_role) 
    AND organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  )
  -- OR any authenticated user can see their own store (prioritized check)
  OR (
    id IN (
      SELECT store_id FROM profiles WHERE id = auth.uid()
    )
  )
);