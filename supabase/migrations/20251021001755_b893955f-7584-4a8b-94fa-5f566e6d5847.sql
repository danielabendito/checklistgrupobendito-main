
-- Verificar e habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Executar a função para criar os cron jobs com os horários atuais
SELECT public.update_notification_cron_jobs();
