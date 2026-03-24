-- Allow public read access to valid email invites during signup validation
CREATE POLICY "Allow public read for valid invites during signup"
ON public.email_invites FOR SELECT
USING (
  used = false 
  AND expires_at > now()
);