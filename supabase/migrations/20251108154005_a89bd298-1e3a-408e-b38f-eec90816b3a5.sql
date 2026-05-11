-- Add storage policy for admins to view ID verification documents
CREATE POLICY "Admins can view verification documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'id-verification' 
  AND EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE users.id = auth.uid() 
    AND is_admin(users.email::text)
  )
);