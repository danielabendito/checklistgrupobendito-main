-- Adicionar coluna invitee_name na tabela email_invites
ALTER TABLE public.email_invites 
ADD COLUMN invitee_name text DEFAULT NULL;

COMMENT ON COLUMN public.email_invites.invitee_name IS 'Nome do colaborador convidado';