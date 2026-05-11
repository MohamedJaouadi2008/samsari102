-- Fix: SECURITY DEFINER view issue
-- Drop the view and recreate it without SECURITY DEFINER
-- The public_profiles view should use SECURITY INVOKER (default) and rely on the function for safe access

-- The view was created without SECURITY DEFINER, but let's ensure it's properly configured
-- We'll recreate it explicitly with SECURITY INVOKER

DROP VIEW IF EXISTS public.public_profiles;

-- Create view with explicit SECURITY INVOKER (the default, but being explicit is good)
CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
AS
SELECT 
  id,
  username,
  avatar_url,
  is_host,
  verification_status,
  created_at
FROM public.profiles;

-- Grant read access
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

COMMENT ON VIEW public.public_profiles IS 'Safe public view of profiles. Uses security_invoker=true so RLS is applied. Only exposes non-sensitive fields.';