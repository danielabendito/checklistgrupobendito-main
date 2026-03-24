-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- System can insert notifications
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to notify admins about NOK items
CREATE OR REPLACE FUNCTION public.notify_nok_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name TEXT;
  v_checklist_name TEXT;
  v_user_name TEXT;
  v_admin RECORD;
BEGIN
  -- Only notify on NOK status
  IF NEW.status != 'nok' THEN
    RETURN NEW;
  END IF;

  -- Get item and checklist names
  SELECT ci.nome INTO v_item_name
  FROM checklist_items ci
  WHERE ci.id = NEW.checklist_item_id;

  SELECT ct.nome INTO v_checklist_name
  FROM checklist_types ct
  WHERE ct.id = NEW.checklist_type_id;

  SELECT p.nome INTO v_user_name
  FROM profiles p
  WHERE p.id = NEW.user_id;

  -- Notify all admins and super_admins in the same store
  FOR v_admin IN 
    SELECT DISTINCT p.id, p.store_id
    FROM profiles p
    INNER JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.store_id = NEW.store_id
      AND ur.role IN ('admin', 'super_admin')
  LOOP
    INSERT INTO notifications (
      user_id,
      store_id,
      type,
      title,
      message,
      data
    ) VALUES (
      v_admin.id,
      NEW.store_id,
      'nok_item',
      'Item NOK Identificado',
      v_user_name || ' marcou "' || v_item_name || '" como NOK no checklist "' || v_checklist_name || '"',
      jsonb_build_object(
        'checklist_type_id', NEW.checklist_type_id,
        'checklist_item_id', NEW.checklist_item_id,
        'response_id', NEW.id,
        'user_name', v_user_name
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger on checklist_responses
DROP TRIGGER IF EXISTS trigger_notify_nok_item ON public.checklist_responses;
CREATE TRIGGER trigger_notify_nok_item
  AFTER INSERT OR UPDATE OF status
  ON public.checklist_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_nok_item();