-- Atualizar bucket para limitar tamanho de arquivos e tipos permitidos
UPDATE storage.buckets 
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'checklist-photos';