-- First, let's check what data we have
-- The issue is that RLS policies are allowing users to see data from all stores

-- Let's recreate the policies to be more restrictive
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view checklist types in same store" ON public.checklist_types;
DROP POLICY IF EXISTS "Admins can manage checklist types in same store" ON public.checklist_types;

-- Recreate with proper filtering - users can ONLY see their own store
CREATE POLICY "Users can view checklist types in same store"
ON public.checklist_types
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  store_id = get_user_store_id(auth.uid())
);

-- Admins can manage ONLY in their own store
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

-- Same for checklist_items
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

-- Check current data distribution
DO $$
DECLARE
  store_count INTEGER;
  pb_store_id UUID;
  mc_store_id UUID;
  zs_store_id UUID;
BEGIN
  -- Get store IDs
  SELECT id INTO pb_store_id FROM public.stores WHERE nome = 'Bendito Boteco - Pedra Branca';
  SELECT id INTO mc_store_id FROM public.stores WHERE nome = 'Bendito Boteco - Mercadoteca';
  SELECT id INTO zs_store_id FROM public.stores WHERE nome = 'Z Smash Burger';
  
  -- Log current distribution
  RAISE NOTICE 'Bendito Boteco - Pedra Branca ID: %', pb_store_id;
  RAISE NOTICE 'Bendito Boteco - Mercadoteca ID: %', mc_store_id;
  RAISE NOTICE 'Z Smash Burger ID: %', zs_store_id;
  
  SELECT COUNT(*) INTO store_count FROM public.checklist_types WHERE store_id = pb_store_id;
  RAISE NOTICE 'Bendito Boteco - Pedra Branca has % checklists', store_count;
  
  SELECT COUNT(*) INTO store_count FROM public.checklist_types WHERE store_id = mc_store_id;
  RAISE NOTICE 'Bendito Boteco - Mercadoteca has % checklists', store_count;
  
  SELECT COUNT(*) INTO store_count FROM public.checklist_types WHERE store_id = zs_store_id;
  RAISE NOTICE 'Z Smash Burger has % checklists', store_count;
END $$;