-- Etapa 1: Adicionar super_admin ao enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';