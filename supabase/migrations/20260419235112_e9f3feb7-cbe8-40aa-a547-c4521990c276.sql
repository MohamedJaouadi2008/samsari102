-- Update has_admin_role to include new roles (panel access roles)
CREATE OR REPLACE FUNCTION public.has_admin_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles WHERE admin_roles.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'moderator'::app_role, 'support'::app_role, 'dispute_manager'::app_role, 'logistics'::app_role)
  )
$function$;

-- Granular role check: does the current user have the given panel role?
CREATE OR REPLACE FUNCTION public.has_panel_role(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    -- Admin in admin_roles is treated as 'admin' for any role check that requires admin
    (
      _role = 'admin'::app_role
      AND EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = _role
    )
$function$;

-- Update get_panel_role to return all role types (priority: admin > moderator > others)
CREATE OR REPLACE FUNCTION public.get_panel_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()) THEN 'admin'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role) THEN 'admin'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'moderator'::app_role) THEN 'moderator'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'dispute_manager'::app_role) THEN 'dispute_manager'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'logistics'::app_role) THEN 'logistics'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'support'::app_role) THEN 'support'
    ELSE NULL
  END;
$function$;

-- Schedule Daily Picks reminder cron: 12h, 5h, and 2h before midnight UTC+1 (Tunisia time)
-- UTC+1 midnight = 23:00 UTC. So reminders at 11:00 UTC, 18:00 UTC, 21:00 UTC.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-picks-reminder-12h') THEN
    PERFORM cron.unschedule('daily-picks-reminder-12h');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-picks-reminder-5h') THEN
    PERFORM cron.unschedule('daily-picks-reminder-5h');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-picks-reminder-2h') THEN
    PERFORM cron.unschedule('daily-picks-reminder-2h');
  END IF;
END $$;

SELECT cron.schedule(
  'daily-picks-reminder-12h',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url:='https://gigzciepwjrwbljdnixh.supabase.co/functions/v1/daily-picks-reminder',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZ3pjaWVwd2pyd2JsamRuaXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NzYxMzIsImV4cCI6MjA2ODI1MjEzMn0.Q3DP0n5jgRiAjDFFP2eXW9PCgZLyw5FgAdXvIKuFiyE"}'::jsonb,
    body:='{"hours_remaining": 12}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'daily-picks-reminder-5h',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url:='https://gigzciepwjrwbljdnixh.supabase.co/functions/v1/daily-picks-reminder',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZ3pjaWVwd2pyd2JsamRuaXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NzYxMzIsImV4cCI6MjA2ODI1MjEzMn0.Q3DP0n5jgRiAjDFFP2eXW9PCgZLyw5FgAdXvIKuFiyE"}'::jsonb,
    body:='{"hours_remaining": 5}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'daily-picks-reminder-2h',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url:='https://gigzciepwjrwbljdnixh.supabase.co/functions/v1/daily-picks-reminder',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZ3pjaWVwd2pyd2JsamRuaXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NzYxMzIsImV4cCI6MjA2ODI1MjEzMn0.Q3DP0n5jgRiAjDFFP2eXW9PCgZLyw5FgAdXvIKuFiyE"}'::jsonb,
    body:='{"hours_remaining": 2}'::jsonb
  );
  $$
);
