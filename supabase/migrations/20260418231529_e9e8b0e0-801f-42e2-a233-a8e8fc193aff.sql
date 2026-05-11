
-- Step 1: confirmed -> awaiting_payment
UPDATE public.bookings
SET status = 'awaiting_payment', updated_at = NOW()
WHERE id = '241caace-d1c2-4243-b636-eda600fe4d7f' AND status = 'confirmed';

-- Step 2: awaiting_payment -> cancelled_by_system
UPDATE public.bookings
SET 
  status = 'cancelled_by_system',
  cancelled_at = NOW(),
  auto_action_taken = 'deposit_deadline_cancel',
  auto_action_taken_at = NOW(),
  refund_reason = 'Manual cleanup: payment deadline expired (cron auth was misconfigured).',
  updated_at = NOW()
WHERE id = '241caace-d1c2-4243-b636-eda600fe4d7f' AND status = 'awaiting_payment';

INSERT INTO public.escrow_audit_log (
  booking_id, action_type, triggered_by, action_reason,
  previous_status, new_status
)
VALUES (
  '241caace-d1c2-4243-b636-eda600fe4d7f',
  'deposit_deadline_cancel',
  'admin_manual',
  'Payment deadline expired 4+ days ago; cron job was misconfigured (placeholder secret in headers). Manually cancelled and cron fixed to read CRON_SECRET from vault.',
  'confirmed',
  'cancelled_by_system'
);

-- Fix cron to read real secret from vault
SELECT cron.unschedule('escrow-deadline-enforcement');

SELECT cron.schedule(
  'escrow-deadline-enforcement',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gigzciepwjrwbljdnixh.supabase.co/functions/v1/escrow-deadline-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1),
        ''
      )
    ),
    body := jsonb_build_object('triggered_at', now()::text)
  );
  $$
);
