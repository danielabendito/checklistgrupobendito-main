-- Manter bucket privado e criar RLS policies para acesso restrito a admins
-- O bucket já existe como privado, vamos apenas garantir que está privado
UPDATE storage.buckets 
SET public = false 
WHERE id = 'checklist-photos';

-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "Usuários podem fazer upload de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem visualizar suas fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem atualizar suas fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar suas fotos" ON storage.objects;

-- Policy para SELECT - apenas admin e super_admin
CREATE POLICY "Admins e super_admins podem visualizar fotos de checklist"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'checklist-photos' 
  AND (
    has_role(auth.uid(), 'admin'::user_role) 
    OR has_role(auth.uid(), 'super_admin'::user_role)
  )
);

-- Policy para INSERT - usuários autenticados podem fazer upload
CREATE POLICY "Usuários autenticados podem fazer upload de fotos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'checklist-photos' 
  AND auth.uid() IS NOT NULL
);

-- Policy para DELETE - apenas admin, super_admin ou dono
CREATE POLICY "Admins e donos podem deletar fotos de checklist"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'checklist-photos' 
  AND (
    auth.uid() = owner 
    OR has_role(auth.uid(), 'admin'::user_role)
    OR has_role(auth.uid(), 'super_admin'::user_role)
  )
);