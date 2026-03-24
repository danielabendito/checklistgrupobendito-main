-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to invoke the edge function with proper authentication
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
  -- Use hardcoded values for now
  supabase_url := 'https://qwetfynfpfjruswdnaps.supabase.co';
  anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZXRmeW5mcGZqcnVzd2RuYXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjUyOTUsImV4cCI6MjA3NTAwMTI5NX0.RaE8VDPT3wGS3uPOJR5jsQqh6zS1glMwBncu2l01nB8';

  -- Call the edge function
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-checklist-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object('turno', turno_param)
  );
END;
$$;

-- Create dynamic cron jobs based on admin_settings
CREATE OR REPLACE FUNCTION public.update_notification_cron_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_row RECORD;
  manha_time time;
  tarde_time time;
  noite_time time;
  manha_cron text;
  tarde_cron text;
  noite_cron text;
BEGIN
  -- Get notification times from admin_settings
  SELECT 
    notification_time_manha,
    notification_time_tarde,
    notification_time_noite
  INTO settings_row
  FROM admin_settings
  LIMIT 1;

  IF settings_row IS NULL THEN
    RAISE NOTICE 'No admin settings found, using default times';
    manha_time := '09:00:00'::time;
    tarde_time := '14:00:00'::time;
    noite_time := '22:00:00'::time;
  ELSE
    manha_time := settings_row.notification_time_manha::time;
    tarde_time := settings_row.notification_time_tarde::time;
    noite_time := settings_row.notification_time_noite::time;
  END IF;

  -- Convert times to cron format (minute hour * * *)
  manha_cron := EXTRACT(MINUTE FROM manha_time)::text || ' ' || EXTRACT(HOUR FROM manha_time)::text || ' * * *';
  tarde_cron := EXTRACT(MINUTE FROM tarde_time)::text || ' ' || EXTRACT(HOUR FROM tarde_time)::text || ' * * *';
  noite_cron := EXTRACT(MINUTE FROM noite_time)::text || ' ' || EXTRACT(HOUR FROM noite_time)::text || ' * * *';

  -- Unschedule existing jobs if they exist
  BEGIN
    PERFORM cron.unschedule('checklist-notification-manha');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    PERFORM cron.unschedule('checklist-notification-tarde');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    PERFORM cron.unschedule('checklist-notification-noite');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Schedule new jobs
  PERFORM cron.schedule(
    'checklist-notification-manha',
    manha_cron,
    'SELECT public.trigger_checklist_notification(''manha'')'
  );

  PERFORM cron.schedule(
    'checklist-notification-tarde',
    tarde_cron,
    'SELECT public.trigger_checklist_notification(''tarde'')'
  );

  PERFORM cron.schedule(
    'checklist-notification-noite',
    noite_cron,
    'SELECT public.trigger_checklist_notification(''noite'')'
  );

  RAISE NOTICE 'Cron jobs updated successfully';
END;
$$;

-- Trigger to update cron jobs when admin_settings changes
CREATE OR REPLACE FUNCTION public.trigger_update_cron_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.update_notification_cron_jobs();
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_cron_on_settings_change ON admin_settings;

-- Create trigger on admin_settings
CREATE TRIGGER update_cron_on_settings_change
AFTER INSERT OR UPDATE OF notification_time_manha, notification_time_tarde, notification_time_noite
ON admin_settings
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_cron_jobs();

-- Initialize cron jobs with current settings
SELECT public.update_notification_cron_jobs();