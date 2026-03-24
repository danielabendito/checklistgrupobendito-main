-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create cron job for morning notifications (09:00 daily)
SELECT cron.schedule(
  'send-checklist-notifications-manha',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://qwetfynfpfjruswdnaps.supabase.co/functions/v1/send-checklist-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZXRmeW5mcGZqcnVzd2RuYXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjUyOTUsImV4cCI6MjA3NTAwMTI5NX0.RaE8VDPT3wGS3uPOJR5jsQqh6zS1glMwBncu2l01nB8"}'::jsonb,
      body := '{"turno": "manha"}'::jsonb
    ) as request_id;
  $$
);

-- Create cron job for afternoon notifications (14:00 daily)
SELECT cron.schedule(
  'send-checklist-notifications-tarde',
  '0 14 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://qwetfynfpfjruswdnaps.supabase.co/functions/v1/send-checklist-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZXRmeW5mcGZqcnVzd2RuYXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjUyOTUsImV4cCI6MjA3NTAwMTI5NX0.RaE8VDPT3wGS3uPOJR5jsQqh6zS1glMwBncu2l01nB8"}'::jsonb,
      body := '{"turno": "tarde"}'::jsonb
    ) as request_id;
  $$
);

-- Create cron job for night notifications (22:00 daily)
SELECT cron.schedule(
  'send-checklist-notifications-noite',
  '0 22 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://qwetfynfpfjruswdnaps.supabase.co/functions/v1/send-checklist-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZXRmeW5mcGZqcnVzd2RuYXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjUyOTUsImV4cCI6MjA3NTAwMTI5NX0.RaE8VDPT3wGS3uPOJR5jsQqh6zS1glMwBncu2l01nB8"}'::jsonb,
      body := '{"turno": "noite"}'::jsonb
    ) as request_id;
  $$
);