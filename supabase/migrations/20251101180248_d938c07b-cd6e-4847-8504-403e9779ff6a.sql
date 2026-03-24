-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view own profile, admins can view all profiles" ON public.profiles;

-- Create simplified policy for users to view their own profile (no role check needed)
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create separate policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);