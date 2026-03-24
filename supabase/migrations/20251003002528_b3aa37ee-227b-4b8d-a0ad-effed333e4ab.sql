-- Create storage bucket for checklist photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist-photos', 'checklist-photos', true);

-- Create RLS policies for the bucket
CREATE POLICY "Users can upload their own checklist photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'checklist-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own checklist photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'checklist-photos' AND
  (
    auth.uid()::text = (storage.foldername(name))[1] OR
    has_role(auth.uid(), 'admin'::user_role)
  )
);

CREATE POLICY "Users can update their own checklist photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'checklist-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own checklist photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'checklist-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add photo_url column to checklist_responses
ALTER TABLE public.checklist_responses
ADD COLUMN photo_url TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN public.checklist_responses.photo_url IS 'URL of the photo evidence uploaded by the user';