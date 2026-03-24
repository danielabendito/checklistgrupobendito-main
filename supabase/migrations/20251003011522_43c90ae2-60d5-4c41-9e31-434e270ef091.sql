-- Create security definer function to get user's store_id
CREATE OR REPLACE FUNCTION public.get_user_store_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Drop and recreate policies for profiles without recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in same store" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in same store" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles in same store" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles in same store"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins can update profiles in same store"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Admins can insert profiles in same store"
ON public.profiles
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

-- Update policies for checklist_types
DROP POLICY IF EXISTS "Users can view checklist types in same store" ON public.checklist_types;
DROP POLICY IF EXISTS "Admins can manage checklist types in same store" ON public.checklist_types;

CREATE POLICY "Users can view checklist types in same store"
ON public.checklist_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Admins can manage checklist types in same store"
ON public.checklist_types
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

-- Update policies for checklist_items
DROP POLICY IF EXISTS "Users can view checklist items in same store" ON public.checklist_items;
DROP POLICY IF EXISTS "Admins can manage checklist items in same store" ON public.checklist_items;

CREATE POLICY "Users can view checklist items in same store"
ON public.checklist_items
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Admins can manage checklist items in same store"
ON public.checklist_items
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

-- Update policies for checklist_responses
DROP POLICY IF EXISTS "Users can view their own responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Admins can view all responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can insert responses in same store" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can update their own responses in same store" ON public.checklist_responses;

CREATE POLICY "Users can view their own responses in same store"
ON public.checklist_responses
FOR SELECT
USING (
  auth.uid() = user_id AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Admins can view all responses in same store"
ON public.checklist_responses
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Users can insert responses in same store"
ON public.checklist_responses
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Users can update their own responses in same store"
ON public.checklist_responses
FOR UPDATE
USING (
  auth.uid() = user_id AND
  data = CURRENT_DATE AND
  store_id = get_user_store_id(auth.uid())
);