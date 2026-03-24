-- Make checklist-photos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'checklist-photos';

-- Add RLS policies for storage.objects
CREATE POLICY "Users can upload their own photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'checklist-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'checklist-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'checklist-photos' AND
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'checklist-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);