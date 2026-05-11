-- Allow users to view basic profile information of other users
-- This is necessary for messaging, where users need to see names of people they're chatting with
CREATE POLICY "Anyone can view basic profile info"
ON public.profiles
FOR SELECT
USING (true);

-- Drop the old restrictive policy that only allowed users to see their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;