
-- Recriar a função com permissões corretas
CREATE OR REPLACE FUNCTION public.update_notification_cron_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $function$
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

  RAISE NOTICE 'Cron schedules - Manhã: %, Tarde: %, Noite: %', manha_cron, tarde_cron, noite_cron;

  -- Unschedule existing jobs if they exist
  BEGIN
    PERFORM cron.unschedule('checklist-notification-manha');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No existing manha job to unschedule';
  END;
  
  BEGIN
    PERFORM cron.unschedule('checklist-notification-tarde');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No existing tarde job to unschedule';
  END;
  
  BEGIN
    PERFORM cron.unschedule('checklist-notification-noite');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No existing noite job to unschedule';
  END;

  -- Schedule new jobs
  PERFORM cron.schedule(
    'checklist-notification-manha',
    manha_cron,
    'SELECT public.trigger_checklist_notification(''manha'')'
  );
  RAISE NOTICE 'Scheduled manha job';

  PERFORM cron.schedule(
    'checklist-notification-tarde',
    tarde_cron,
    'SELECT public.trigger_checklist_notification(''tarde'')'
  );
  RAISE NOTICE 'Scheduled tarde job';

  PERFORM cron.schedule(
    'checklist-notification-noite',
    noite_cron,
    'SELECT public.trigger_checklist_notification(''noite'')'
  );
  RAISE NOTICE 'Scheduled noite job';

  RAISE NOTICE 'All cron jobs updated successfully';
END;
$function$;

-- Executar a função novamente
SELECT public.update_notification_cron_jobs();
