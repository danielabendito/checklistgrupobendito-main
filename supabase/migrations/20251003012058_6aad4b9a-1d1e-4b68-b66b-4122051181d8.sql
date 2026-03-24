-- The issue is conceptual: we need to allow admins to manage ALL stores
-- Not just their own store. Let's fix the policies for admins.

-- Update policies to allow admins to see and manage ALL stores
DROP POLICY IF EXISTS "Admins can view all profiles in same store" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in same store" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles in same store" ON public.profiles;

-- Admins can view profiles from any store
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- Admins can update profiles from any store
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::user_role));

-- Admins can insert profiles for any store
CREATE POLICY "Admins can insert all profiles"
ON public.profiles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Update checklist_types policies for admins
DROP POLICY IF EXISTS "Users can view checklist types in same store" ON public.checklist_types;
DROP POLICY IF EXISTS "Admins can manage checklist types in same store" ON public.checklist_types;

-- Regular users see only their store's checklists
CREATE POLICY "Users can view checklist types in same store"
ON public.checklist_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  (
    has_role(auth.uid(), 'admin'::user_role) OR
    store_id = get_user_store_id(auth.uid())
  )
);

-- Admins can manage all stores' checklists
CREATE POLICY "Admins can manage all checklist types"
ON public.checklist_types
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Update checklist_items policies
DROP POLICY IF EXISTS "Users can view checklist items in same store" ON public.checklist_items;
DROP POLICY IF EXISTS "Admins can manage checklist items in same store" ON public.checklist_items;

CREATE POLICY "Users can view checklist items in same store"
ON public.checklist_items
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  (
    has_role(auth.uid(), 'admin'::user_role) OR
    store_id = get_user_store_id(auth.uid())
  )
);

CREATE POLICY "Admins can manage all checklist items"
ON public.checklist_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Update checklist_responses policies
DROP POLICY IF EXISTS "Users can view their own responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Admins can view all responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can insert responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can update their own responses in same store" ON public.checklist_responses;

CREATE POLICY "Users can view their own responses"
ON public.checklist_responses
FOR SELECT
USING (
  auth.uid() = user_id OR
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Admins can view all responses"
ON public.checklist_responses
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can insert their own responses"
ON public.checklist_responses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses"
ON public.checklist_responses
FOR UPDATE
USING (
  auth.uid() = user_id AND
  data = CURRENT_DATE
);