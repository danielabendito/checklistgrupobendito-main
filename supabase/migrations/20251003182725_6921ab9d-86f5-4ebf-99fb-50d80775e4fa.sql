-- Fix profiles table: Consolidate SELECT policies into one explicit policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile, admins can view all" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = id) OR has_role(auth.uid(), 'admin'::user_role)
);

-- Fix email_invites table: Add explicit SELECT policy
CREATE POLICY "Only admins can view email invites" 
ON public.email_invites 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role));

-- Fix admin_settings table: Add explicit SELECT policy
CREATE POLICY "Only admins can view admin settings" 
ON public.admin_settings 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role));