-- Update shift_type enum to include new values
ALTER TYPE shift_type RENAME TO shift_type_old;

CREATE TYPE shift_type AS ENUM ('manha', 'tarde', 'noite');

-- Update admin_settings table
ALTER TABLE public.admin_settings 
  DROP COLUMN IF EXISTS notification_time_abertura,
  DROP COLUMN IF EXISTS notification_time_fechamento,
  ADD COLUMN notification_time_manha time NOT NULL DEFAULT '09:00:00',
  ADD COLUMN notification_time_tarde time NOT NULL DEFAULT '14:00:00',
  ADD COLUMN notification_time_noite time NOT NULL DEFAULT '22:00:00';

-- Update checklist_notifications table
ALTER TABLE public.checklist_notifications 
  ALTER COLUMN turno TYPE shift_type USING 
    CASE 
      WHEN turno::text = 'abertura' THEN 'manha'::shift_type
      WHEN turno::text = 'fechamento' THEN 'noite'::shift_type
      ELSE 'tarde'::shift_type
    END;

-- Update checklist_types table
ALTER TABLE public.checklist_types
  ALTER COLUMN turno TYPE shift_type USING
    CASE
      WHEN turno::text = 'abertura' THEN 'manha'::shift_type
      WHEN turno::text = 'fechamento' THEN 'noite'::shift_type
      ELSE 'tarde'::shift_type
    END;

-- Drop old enum
DROP TYPE shift_type_old;