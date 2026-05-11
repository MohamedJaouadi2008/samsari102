ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS arrival_instructions text,
  ADD COLUMN IF NOT EXISTS wifi_name text,
  ADD COLUMN IF NOT EXISTS wifi_password text,
  ADD COLUMN IF NOT EXISTS parking_info text,
  ADD COLUMN IF NOT EXISTS lockbox_code text;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_pre_checkin_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_arrival_day_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_pre_checkout_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_review_nudge_sent_at timestamptz;