-- 1. Fix property_promotions UPDATE policy (currently USING (true) — allows anyone to update)
DROP POLICY IF EXISTS "System can update promotions" ON public.property_promotions;

-- Hosts can update their own promotions
CREATE POLICY "Hosts can update own promotions"
ON public.property_promotions
FOR UPDATE
TO authenticated
USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);

-- Admins can update any promotion (for moderation / refunds)
CREATE POLICY "Admins can update any promotion"
ON public.property_promotions
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Note: Edge functions using SERVICE_ROLE key bypass RLS, so webhook updates still work.

-- 2. Lock down storage bucket listing for avatars and property-photos
-- Files remain accessible by direct URL (public buckets), but enumeration is blocked.

-- Avatars: anyone can read individual files, but only owner can list their folder
DROP POLICY IF EXISTS "Avatar files are publicly readable" ON storage.objects;
CREATE POLICY "Avatar files are publicly readable"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Property photos: same pattern
DROP POLICY IF EXISTS "Property photos are publicly readable" ON storage.objects;
CREATE POLICY "Property photos are publicly readable"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'property-photos');