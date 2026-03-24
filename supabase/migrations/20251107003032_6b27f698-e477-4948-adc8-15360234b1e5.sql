-- ETAPA 1.1: Melhorias na tabela email_invites
-- Adicionar colunas para controle de reenvios e validade
ALTER TABLE email_invites 
ADD COLUMN IF NOT EXISTS resend_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days');

-- Criar índice para performance em consultas de convites expirados
CREATE INDEX IF NOT EXISTS idx_email_invites_expires_at ON email_invites(expires_at) WHERE used = false;

-- ETAPA 1.2: Melhorias na tabela stores
-- Adicionar colunas para informações completas do estabelecimento
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS endereco TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS email_contato TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Adicionar constraint de status separadamente
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'stores_status_check' 
    AND conrelid = 'stores'::regclass
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT stores_status_check CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;

-- Criar índice para filtros por status
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);

-- Criar trigger para atualizar updated_at automaticamente (drop primeiro se existir)
DROP TRIGGER IF EXISTS set_stores_updated_at ON stores;
CREATE TRIGGER set_stores_updated_at 
BEFORE UPDATE ON stores
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();