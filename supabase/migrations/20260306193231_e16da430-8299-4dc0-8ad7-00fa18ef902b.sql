DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker=on) AS
SELECT 
  id,
  username,
  full_name,
  avatar_url,
  is_host,
  verification_status,
  created_at
FROM profiles;