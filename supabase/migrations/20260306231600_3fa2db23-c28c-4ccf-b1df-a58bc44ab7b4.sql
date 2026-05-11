
-- Fix the security definer view by making it an INVOKER view
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.full_name,
  p.username,
  p.avatar_url,
  p.bio,
  p.is_host,
  p.verification_status,
  p.created_at
FROM profiles p;

-- Grant select to anon and authenticated so the view is accessible
GRANT SELECT ON public.public_profiles TO anon, authenticated;
