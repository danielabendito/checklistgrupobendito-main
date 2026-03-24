-- Drop existing table to recreate with new structure
DROP TABLE IF EXISTS public.admin_settings CASCADE;

-- Create improved admin_settings table
CREATE TABLE public.admin_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_email text NOT NULL,
  notification_time_abertura time NOT NULL DEFAULT '09:00:00',
  notification_time_fechamento time NOT NULL DEFAULT '18:00:00',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create table to map checklists to notification schedules
CREATE TABLE public.checklist_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_type_id uuid NOT NULL REFERENCES public.checklist_types(id) ON DELETE CASCADE,
  turno shift_type NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(checklist_type_id, turno)
);

-- Enable RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for admin_settings
CREATE POLICY "Admins can manage settings"
ON public.admin_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Policies for checklist_notifications
CREATE POLICY "Admins can manage checklist notifications"
ON public.checklist_notifications
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Everyone can view checklist notifications"
ON public.checklist_notifications
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_admin_settings_updated_at
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();