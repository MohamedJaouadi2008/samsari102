-- =====================================================
-- FIX 1: Profiles Table - Remove the dangerous 'OR true' policy
-- =====================================================

-- Drop the problematic policy that exposes all profiles to everyone
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Recreate it properly - admins only (no 'OR true')
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (is_admin());

-- =====================================================
-- FIX 2: Admin Roles Table - Restrict to own record only
-- =====================================================

-- Drop the dangerous policy that exposes all admin emails
DROP POLICY IF EXISTS "Allow checking admin status" ON admin_roles;

-- Create new policy - users can only see their own admin status (if any)
-- The is_admin() function uses SECURITY DEFINER so it bypasses RLS and still works
CREATE POLICY "Users can check their own admin status"
ON admin_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());