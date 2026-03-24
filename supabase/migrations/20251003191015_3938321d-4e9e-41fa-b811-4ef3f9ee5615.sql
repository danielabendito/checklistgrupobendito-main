-- Add columns to checklist_items to configure if observation and photo are required
ALTER TABLE public.checklist_items
ADD COLUMN requer_observacao boolean NOT NULL DEFAULT false,
ADD COLUMN requer_foto boolean NOT NULL DEFAULT false;