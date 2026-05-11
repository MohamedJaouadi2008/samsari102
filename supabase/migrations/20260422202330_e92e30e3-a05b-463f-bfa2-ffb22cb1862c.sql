-- 1. Restrict promo_codes SELECT to authenticated users only.
-- Active promo code metadata (discount values, min booking amounts) should not be enumerable anonymously.
DROP POLICY IF EXISTS "Anyone can view active promo codes" ON public.promo_codes;

CREATE POLICY "Authenticated users can view active promo codes"
ON public.promo_codes
FOR SELECT
TO authenticated
USING (active = true);

-- 2. Add admin DELETE policy on the id-verification storage bucket so cleanup workflows
-- (e.g. after images_cleaned_at is set) can actually remove the documents.
CREATE POLICY "Admins can delete id-verification objects"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'id-verification'
  AND public.is_admin()
);

-- 3. Allow users to replace (UPDATE) their own pending verification documents in storage.
-- Admins can also update for moderation/cleanup purposes.
CREATE POLICY "Users can update their own id-verification objects"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'id-verification'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'id-verification'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can update id-verification objects"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'id-verification' AND public.is_admin())
WITH CHECK (bucket_id = 'id-verification' AND public.is_admin());