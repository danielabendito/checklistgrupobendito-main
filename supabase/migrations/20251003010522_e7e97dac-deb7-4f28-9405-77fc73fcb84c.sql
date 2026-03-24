-- First, let's check current state and update accordingly
DO $$ 
BEGIN
  -- Update shift_type enum
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_type') THEN
    ALTER TYPE shift_type RENAME TO shift_type_old;
  END IF;
END $$;

CREATE TYPE shift_type AS ENUM ('manha', 'tarde', 'noite');

-- Update admin_settings columns
ALTER TABLE public.admin_settings 
  DROP COLUMN IF EXISTS notification_time_abertura,
  DROP COLUMN IF EXISTS notification_time_fechamento;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_settings' 
                 AND column_name = 'notification_time_manha') THEN
    ALTER TABLE public.admin_settings ADD COLUMN notification_time_manha time NOT NULL DEFAULT '09:00:00';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_settings' 
                 AND column_name = 'notification_time_tarde') THEN
    ALTER TABLE public.admin_settings ADD COLUMN notification_time_tarde time NOT NULL DEFAULT '14:00:00';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_settings' 
                 AND column_name = 'notification_time_noite') THEN
    ALTER TABLE public.admin_settings ADD COLUMN notification_time_noite time NOT NULL DEFAULT '22:00:00';
  END IF;
END $$;

-- Update checklist_notifications turno column
ALTER TABLE public.checklist_notifications 
  ALTER COLUMN turno TYPE shift_type USING 
    CASE 
      WHEN turno::text = 'abertura' THEN 'manha'::shift_type
      WHEN turno::text = 'fechamento' THEN 'noite'::shift_type
      WHEN turno::text = 'manha' THEN 'manha'::shift_type
      WHEN turno::text = 'tarde' THEN 'tarde'::shift_type
      WHEN turno::text = 'noite' THEN 'noite'::shift_type
      ELSE 'tarde'::shift_type
    END;

-- Update checklist_types turno column
ALTER TABLE public.checklist_types
  ALTER COLUMN turno TYPE shift_type USING
    CASE
      WHEN turno::text = 'abertura' THEN 'manha'::shift_type
      WHEN turno::text = 'fechamento' THEN 'noite'::shift_type
      WHEN turno::text = 'manha' THEN 'manha'::shift_type
      WHEN turno::text = 'tarde' THEN 'tarde'::shift_type
      WHEN turno::text = 'noite' THEN 'noite'::shift_type
      ELSE 'tarde'::shift_type
    END;

-- Drop old enum if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_type_old') THEN
    DROP TYPE shift_type_old;
  END IF;
END $$;