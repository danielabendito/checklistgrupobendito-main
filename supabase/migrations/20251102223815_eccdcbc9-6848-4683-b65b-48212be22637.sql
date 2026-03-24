-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Admins and users can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;

-- Política para SELECT (visualizar/baixar fotos)
CREATE POLICY "Admins and users can view photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'checklist-photos' 
  AND (
    -- Usuário pode ver suas próprias fotos
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Admins podem ver todas as fotos
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  )
);

-- Política para INSERT (upload de fotos)
CREATE POLICY "Users can upload their own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'checklist-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para DELETE (remover fotos)
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'checklist-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);