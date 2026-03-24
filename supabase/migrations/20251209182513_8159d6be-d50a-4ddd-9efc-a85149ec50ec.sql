-- Corrigir função trigger_checklist_notification com sintaxe assíncrona do pg_net
CREATE OR REPLACE FUNCTION public.trigger_checklist_notification(turno_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  request_id bigint;
BEGIN
  -- Chamar edge function de forma assíncrona via pg_net
  -- net.http_post retorna apenas o request_id, não status/content
  SELECT net.http_post(
    url := 'https://qwetfynfpfjruswdnaps.supabase.co/functions/v1/send-checklist-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZXRmeW5mcGZqcnVzd2RuYXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjUyOTUsImV4cCI6MjA3NTAwMTI5NX0.RaE8VDPT3wGS3uPOJR5jsQqh6zS1glMwBncu2l01nB8'
    ),
    body := jsonb_build_object('turno', turno_param),
    timeout_milliseconds := 30000
  ) INTO request_id;
  
  RAISE NOTICE 'Notification request queued for turno: % (request_id: %)', turno_param, request_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger notification for turno %: % (SQLSTATE: %)', 
      turno_param, SQLERRM, SQLSTATE;
END;
$function$;