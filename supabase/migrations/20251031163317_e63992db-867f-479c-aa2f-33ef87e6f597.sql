-- Fix hardcoded credentials in trigger_checklist_notification function
-- Use Supabase vault to securely store and retrieve credentials

-- Recreate the function to use vault for credentials
CREATE OR REPLACE FUNCTION public.trigger_checklist_notification(turno_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  anon_key text;
BEGIN
  -- Retrieve credentials from vault or use current project environment
  -- Since this is calling an internal edge function, we use the project's own credentials
  SELECT decrypted_secret INTO anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  
  -- Fallback to environment-based retrieval if vault is empty
  -- This uses pg_net's ability to access Supabase project context
  IF supabase_url IS NULL THEN
    supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;
  
  IF anon_key IS NULL THEN
    anon_key := current_setting('app.settings.supabase_anon_key', true);
  END IF;

  -- Call the edge function with proper authentication
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-checklist-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object('turno', turno_param)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger notification: %', SQLERRM;
END;
$$;