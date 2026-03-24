-- Add unique constraint to prevent duplicate admin_settings per store
ALTER TABLE public.admin_settings 
DROP CONSTRAINT IF EXISTS admin_settings_store_id_unique;

ALTER TABLE public.admin_settings
ADD CONSTRAINT admin_settings_store_id_unique UNIQUE (store_id);