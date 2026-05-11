-- Fix 1: Create a public profiles view that hides sensitive data
-- and update RLS policies to protect phone numbers

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view basic profile info" ON profiles;

-- Create a secure view for public profile access (hides phone and sensitive data)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  avatar_url,
  is_host,
  verification_status,
  created_at
FROM profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Create policy for authenticated users to see their own full profile
CREATE POLICY "Users can view their own full profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles with full data"
ON profiles FOR SELECT
TO authenticated
USING (is_admin());

-- Fix 2: host_bookings_view already uses security_invoker which inherits 
-- RLS from the underlying bookings table. The bookings table already has:
-- "Users can view their own bookings" policy with USING ((auth.uid() = guest_id) OR (auth.uid() = host_id))
-- This is secure because security_invoker=on means queries run with caller's permissions