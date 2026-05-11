-- Schedule iCal auto-sync every 6 hours
SELECT cron.unschedule('ical-auto-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ical-auto-sync');

SELECT cron.schedule(
  'ical-auto-sync',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gigzciepwjrwbljdnixh.supabase.co/functions/v1/ical-import',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZ3pjaWVwd2pyd2JsamRuaXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NzYxMzIsImV4cCI6MjA2ODI1MjEzMn0.Q3DP0n5jgRiAjDFFP2eXW9PCgZLyw5FgAdXvIKuFiyE"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);