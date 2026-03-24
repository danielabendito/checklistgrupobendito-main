
-- Remover todos os cron jobs antigos de notificação de checklist
SELECT cron.unschedule(jobid::bigint) 
FROM cron.job 
WHERE command LIKE '%send-checklist-notifications%' OR command LIKE '%trigger_checklist_notification%';

-- Recriar os cron jobs com os horários atuais da configuração
DO $$
DECLARE
  settings_row RECORD;
  manha_time time;
  tarde_time time;
  noite_time time;
  manha_cron text;
  tarde_cron text;
  noite_cron text;
BEGIN
  -- Buscar horários configurados
  SELECT 
    notification_time_manha,
    notification_time_tarde,
    notification_time_noite
  INTO settings_row
  FROM admin_settings
  LIMIT 1;

  manha_time := settings_row.notification_time_manha::time;
  tarde_time := settings_row.notification_time_tarde::time;
  noite_time := settings_row.notification_time_noite::time;

  -- Converter para formato cron (minuto hora * * *)
  manha_cron := EXTRACT(MINUTE FROM manha_time)::text || ' ' || EXTRACT(HOUR FROM manha_time)::text || ' * * *';
  tarde_cron := EXTRACT(MINUTE FROM tarde_time)::text || ' ' || EXTRACT(HOUR FROM tarde_time)::text || ' * * *';
  noite_cron := EXTRACT(MINUTE FROM noite_time)::text || ' ' || EXTRACT(HOUR FROM noite_time)::text || ' * * *';

  -- Agendar novos jobs
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
END $$;
