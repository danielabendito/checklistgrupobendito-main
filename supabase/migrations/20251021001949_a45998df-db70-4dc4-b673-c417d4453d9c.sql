
-- Criar os cron jobs diretamente
SELECT cron.schedule(
  'checklist-notification-manha',
  '19 11 * * *',
  $$SELECT public.trigger_checklist_notification('manha')$$
);

SELECT cron.schedule(
  'checklist-notification-tarde',
  '5 18 * * *',
  $$SELECT public.trigger_checklist_notification('tarde')$$
);

SELECT cron.schedule(
  'checklist-notification-noite',
  '59 23 * * *',
  $$SELECT public.trigger_checklist_notification('noite')$$
);
