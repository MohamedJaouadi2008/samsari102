-- Add user_id column to admin_roles table
ALTER TABLE public.admin_roles ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_roles_user_id ON public.admin_roles(user_id);

-- Populate user_id from existing emails (if any exist)
UPDATE public.admin_roles 
SET user_id = auth.users.id 
FROM auth.users 
WHERE admin_roles.user_email = auth.users.email 
AND admin_roles.user_id IS NULL;

-- Create new is_admin function that uses user_id
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles 
    WHERE admin_roles.user_id = auth.uid()
  );
$$;

-- Drop existing RLS policies that reference auth.users
DROP POLICY IF EXISTS "Admins can view all verifications" ON public.id_verifications;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate RLS policies without auth.users reference
CREATE POLICY "Admins can view all verifications"
ON public.id_verifications
FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_admin() OR true);

-- Add admin policy for properties
CREATE POLICY "Admins can view all properties"
ON public.properties
FOR SELECT
TO authenticated
USING (is_admin() OR ((is_public = true) AND (status = 'published'::text)) OR (auth.uid() = host_id));