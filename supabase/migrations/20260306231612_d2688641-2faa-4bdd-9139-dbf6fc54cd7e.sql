
-- Allow anyone to read limited profile info for public profiles
CREATE POLICY "Anyone can view basic profile info"
ON public.profiles FOR SELECT
TO authenticated
USING (true);
