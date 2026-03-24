-- Add sent_at column to email_invites table for tracking email delivery
ALTER TABLE public.email_invites
ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE;