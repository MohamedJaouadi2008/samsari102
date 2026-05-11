
-- Create a function to check if user is admin or moderator (for panel access)
CREATE OR REPLACE FUNCTION public.is_admin_or_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles 
    WHERE admin_roles.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'moderator')
  );
$$;

-- Create a function to get the user's highest panel role
CREATE OR REPLACE FUNCTION public.get_panel_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.admin_roles WHERE admin_roles.user_id = auth.uid()
    ) THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    ) THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'moderator'
    ) THEN 'moderator'
    ELSE NULL
  END;
$$;

-- Allow moderators to read reviews for moderation
CREATE POLICY "Moderators can view all reviews"
ON public.reviews
FOR SELECT
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to update reviews (approve/reject)
CREATE POLICY "Moderators can update reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to view all profiles
CREATE POLICY "Moderators can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to view all ID verifications
CREATE POLICY "Moderators can view all verifications"
ON public.id_verifications
FOR SELECT
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to update ID verifications
CREATE POLICY "Moderators can update verifications"
ON public.id_verifications
FOR UPDATE
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to view all user reports
CREATE POLICY "Moderators can view all reports"
ON public.user_reports
FOR SELECT
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to update user reports
CREATE POLICY "Moderators can update reports"
ON public.user_reports
FOR UPDATE
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to view all ban appeals
CREATE POLICY "Moderators can view all appeals"
ON public.ban_appeals
FOR SELECT
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to update ban appeals
CREATE POLICY "Moderators can update appeals"
ON public.ban_appeals
FOR UPDATE
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to view escrow audit logs (read only)
CREATE POLICY "Moderators can view audit logs"
ON public.escrow_audit_log
FOR SELECT
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to view all properties
CREATE POLICY "Moderators can view all properties"
ON public.properties
FOR SELECT
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to update profiles (for warnings/bans)
CREATE POLICY "Moderators can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to view guest reviews
CREATE POLICY "Moderators can view all guest reviews"
ON public.guest_reviews
FOR SELECT
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to update guest reviews
CREATE POLICY "Moderators can update guest reviews"
ON public.guest_reviews
FOR UPDATE
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to view bookings (for dispute context)
CREATE POLICY "Moderators can view all bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (is_admin_or_moderator());

-- Allow moderators to read platform settings (featured properties)
-- Already has "Anyone can read platform settings" policy

-- Allow moderators to insert/update platform settings (featured properties only - enforced in code)
CREATE POLICY "Moderators can update platform settings"
ON public.platform_settings
FOR UPDATE
TO authenticated
USING (is_admin_or_moderator());

CREATE POLICY "Moderators can insert platform settings"
ON public.platform_settings
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_moderator());
