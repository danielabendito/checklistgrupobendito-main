-- Create audit_logs table for tracking all system actions
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL, -- 'create', 'update', 'delete', 'complete', 'export'
  resource_type TEXT NOT NULL, -- 'checklist_type', 'checklist_item', 'checklist_response', 'admin_settings', 'user', 'report'
  resource_id UUID,
  resource_name TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB
);

-- Create index for better query performance
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_store_id ON public.audit_logs(store_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs(resource_type);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view audit logs from their store"
ON public.audit_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR 
  (has_role(auth.uid(), 'admin'::user_role) AND store_id = get_user_store_id(auth.uid()))
);

CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action_type TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_resource_name TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
  v_store_id UUID;
  v_audit_id UUID;
BEGIN
  -- Get current user info
  v_user_id := auth.uid();
  
  SELECT nome, email, store_id 
  INTO v_user_name, v_user_email, v_store_id
  FROM public.profiles
  WHERE id = v_user_id;
  
  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    user_name,
    user_email,
    store_id,
    action_type,
    resource_type,
    resource_id,
    resource_name,
    old_values,
    new_values,
    metadata
  ) VALUES (
    v_user_id,
    COALESCE(v_user_name, 'Sistema'),
    COALESCE(v_user_email, 'sistema@app.com'),
    v_store_id,
    p_action_type,
    p_resource_type,
    p_resource_id,
    p_resource_name,
    p_old_values,
    p_new_values,
    p_metadata
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;