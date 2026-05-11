-- Fix Security Definer View issue by using SECURITY INVOKER instead
-- This ensures the view uses the permissions of the querying user

-- Drop the existing view
DROP VIEW IF EXISTS public.public_profiles;

-- Recreate with SECURITY INVOKER (which is the default, but being explicit)
CREATE VIEW public.public_profiles 
WITH (security_invoker = on)
AS
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