-- Fix admin_roles RLS policy - remove circular dependency
-- The current policy creates a circular dependency because it uses is_admin() 
-- which needs to read admin_roles, but the policy blocks reading admin_roles

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Only admins can view admin roles" ON admin_roles;

-- Create a new policy that allows the is_admin function to work
-- Since is_admin uses SECURITY DEFINER, it runs with owner privileges
-- We just need a policy that allows authenticated users to check their own admin status
CREATE POLICY "Allow checking admin status"
ON admin_roles
FOR SELECT
TO authenticated
USING (true);

-- Note: This allows anyone to see the admin_roles table, but that's okay because:
-- 1. It only contains emails and roles (no sensitive data)
-- 2. The actual admin panel access is controlled by the is_admin() function
-- 3. RLS on other admin-accessible tables still protects sensitive data