-- Allow anonymous users to view basic profile info via public_profiles view
CREATE POLICY "Anonymous can view basic profile info"
ON profiles FOR SELECT
TO anon
USING (true);