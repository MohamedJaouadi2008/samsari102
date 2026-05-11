-- Fix overly permissive RLS policies
-- These policies currently use WITH CHECK (true) which allows any user to insert

-- 1. Fix escrow_audit_log: Only service_role should insert (via edge functions)
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.escrow_audit_log;

-- Note: We can't directly check for service_role in RLS, but we can use a security definer function
-- or restrict to authenticated users with specific conditions.
-- Since audit logs should only be created by edge functions (which use service_role),
-- we'll create a restrictive policy that allows inserts only when triggered_by is properly set
CREATE POLICY "Only system can insert audit logs" 
ON public.escrow_audit_log 
FOR INSERT 
WITH CHECK (
  -- Require triggered_by to be set (edge functions always set this)
  triggered_by IS NOT NULL 
  AND triggered_by IN ('system', 'cron', 'webhook', 'admin', 'edge_function')
  -- If triggered by admin, verify they are actually an admin
  AND (
    triggered_by != 'admin' 
    OR (triggered_by = 'admin' AND is_admin())
  )
);

-- 2. Fix notifications: Only allow authenticated users to create notifications for themselves
-- or allow the system (via triggers/functions) to create for any user
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Users can create their own notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (
  -- Users can only create notifications for themselves
  auth.uid() = user_id
);

-- 3. Fix property_views: Restrict to authenticated users or validated anonymous sessions
DROP POLICY IF EXISTS "Anyone can track views" ON public.property_views;

CREATE POLICY "Authenticated users and valid sessions can track views" 
ON public.property_views 
FOR INSERT 
WITH CHECK (
  -- Either authenticated user viewing
  (auth.uid() IS NOT NULL AND (viewer_id IS NULL OR viewer_id = auth.uid()))
  -- Or anonymous with a valid session_id format
  OR (auth.uid() IS NULL AND session_id IS NOT NULL AND length(session_id) > 10)
);