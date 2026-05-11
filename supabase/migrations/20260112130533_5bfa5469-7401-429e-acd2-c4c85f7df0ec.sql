-- =====================================================
-- SECURITY FIX: Profiles Table & ID Verifications
-- =====================================================

-- 1. Drop existing permissive policies on profiles that might allow leaks
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles with full data" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 2. Create clean, restrictive policies for profiles
-- Users can only see their own complete profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users can insert their own profile (for new user creation)
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Admins can view all profiles (for moderation)
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_admin());

-- Admins can update profiles (for banning, strikes, etc.)
CREATE POLICY "Admins can update profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin());

-- 3. Recreate the public_profiles view to only expose safe fields
-- This view is for displaying host/guest info in bookings, messages, etc.
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  avatar_url,
  is_host,
  verification_status,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- Note: The view inherits RLS from the underlying table when accessed,
-- but since we want limited public data, we use SECURITY DEFINER
-- Actually, for a public view that shows limited data, we need a function approach

-- 4. Create a function to safely get public profile data
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  is_host boolean,
  verification_status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.avatar_url,
    p.is_host,
    p.verification_status,
    p.created_at
  FROM profiles p
  WHERE p.id = profile_id;
$$;

-- 5. Ensure id_verifications has proper restrictive policies
-- First drop existing policies
DROP POLICY IF EXISTS "Admins can view all verifications" ON public.id_verifications;
DROP POLICY IF EXISTS "Users can insert their own verification" ON public.id_verifications;
DROP POLICY IF EXISTS "Users can view their own verification" ON public.id_verifications;

-- Create clean policies
CREATE POLICY "Users can view own verification"
ON public.id_verifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verification"
ON public.id_verifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can view all verifications (for review)
CREATE POLICY "Admins can view all verifications"
ON public.id_verifications FOR SELECT
TO authenticated
USING (public.is_admin());

-- Admins can update verifications (approve/reject)
CREATE POLICY "Admins can update verifications"
ON public.id_verifications FOR UPDATE
TO authenticated
USING (public.is_admin());

-- 6. Add comment documenting security approach
COMMENT ON TABLE public.profiles IS 'User profiles with sensitive data. Only accessible to own user or admins. Use public_profiles view or get_public_profile() for safe public data.';
COMMENT ON TABLE public.id_verifications IS 'ID verification documents. URLs are stored as paths, not direct URLs. Always use signed URLs via get-signed-url edge function.';
COMMENT ON VIEW public.public_profiles IS 'Safe public view of profiles - only exposes non-sensitive fields (username, avatar, verification status).';