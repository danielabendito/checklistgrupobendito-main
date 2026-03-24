-- Habilitar Realtime na tabela checklist_items para sincronização em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_items;