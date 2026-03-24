-- Remove UNIQUE constraint on organizations.owner_id to allow super_admins to manage multiple client organizations
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_owner_id_key;

-- Create index for performance on owner_id lookups
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);

-- Update RLS policy to allow super_admins to view all organizations they own (not just one)
DROP POLICY IF EXISTS "Super_admins can view their organization" ON public.organizations;

CREATE POLICY "Super_admins can view their organizations"
ON public.organizations FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  AND owner_id = auth.uid()
);