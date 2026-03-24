ALTER TABLE public.admin_settings ADD COLUMN notification_whatsapp_numbers text[] DEFAULT '{}'::text[];

-- Migrate existing data
UPDATE public.admin_settings 
SET notification_whatsapp_numbers = ARRAY[notification_whatsapp_number]
WHERE notification_whatsapp_number IS NOT NULL AND notification_whatsapp_number != '';