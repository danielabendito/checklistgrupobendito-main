-- Adicionar colunas para canais de notificação na tabela admin_settings
ALTER TABLE admin_settings 
  ADD COLUMN IF NOT EXISTS notification_channel_email boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_channel_whatsapp boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_whatsapp_number text DEFAULT NULL;

-- Adicionar colunas para WhatsApp na tabela email_invites
ALTER TABLE email_invites 
  ADD COLUMN IF NOT EXISTS whatsapp_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamp with time zone DEFAULT NULL;