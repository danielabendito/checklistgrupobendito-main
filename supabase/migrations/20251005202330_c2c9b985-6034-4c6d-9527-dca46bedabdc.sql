-- Remove existing cron jobs
SELECT cron.unschedule('send-checklist-notifications-manha');
SELECT cron.unschedule('send-checklist-notifications-tarde');
SELECT cron.unschedule('send-checklist-notifications-noite');

-- Create cron job for morning notifications (11:20 daily)
SELECT cron.schedule(
  'send-checklist-notifications-manha',
  '20 11 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://qwetfynfpfjruswdnaps.supabase.co/functions/v1/send-checklist-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZXRmeW5mcGZqcnVzd2RuYXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjUyOTUsImV4cCI6MjA3NTAwMTI5NX0.RaE8VDPT3wGS3uPOJR5jsQqh6zS1glMwBncu2l01nB8"}'::jsonb,
      body := '{"turno": "manha"}'::jsonb
    ) as request_id;
  $$
);

-- Create cron job for afternoon notifications (17:30 daily)
SELECT cron.schedule(
  'send-checklist-notifications-tarde',
  '30 17 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://qwetfynfpfjruswdnaps.supabase.co/functions/v1/send-checklist-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZXRmeW5mcGZqcnVzd2RuYXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjUyOTUsImV4cCI6MjA3NTAwMTI5NX0.RaE8VDPT3wGS3uPOJR5jsQqh6zS1glMwBncu2l01nB8"}'::jsonb,
      body := '{"turno": "tarde"}'::jsonb
    ) as request_id;
  $$
);

-- Create cron job for night notifications (23:59 daily)
SELECT cron.schedule(
  'send-checklist-notifications-noite',
  '59 23 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://qwetfynfpfjruswdnaps.supabase.co/functions/v1/send-checklist-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZXRmeW5mcGZqcnVzd2RuYXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjUyOTUsImV4cCI6MjA3NTAwMTI5NX0.RaE8VDPT3wGS3uPOJR5jsQqh6zS1glMwBncu2l01nB8"}'::jsonb,
      body := '{"turno": "noite"}'::jsonb
    ) as request_id;
  $$
);