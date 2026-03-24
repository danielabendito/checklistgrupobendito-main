-- Drop existing unique constraints
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_nome_key;
ALTER TABLE public.email_invites DROP CONSTRAINT IF EXISTS email_invites_email_key;

-- Add composite unique constraints to allow duplicates across organizations
ALTER TABLE public.stores 
  ADD CONSTRAINT stores_nome_organization_key 
  UNIQUE (nome, organization_id);

ALTER TABLE public.email_invites 
  ADD CONSTRAINT email_invites_email_store_key 
  UNIQUE (email, store_id);