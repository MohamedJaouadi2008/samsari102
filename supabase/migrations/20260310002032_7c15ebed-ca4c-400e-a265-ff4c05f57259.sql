
-- Add payout tracking columns to bookings
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS bank_payout_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS bank_payout_reference text,
  ADD COLUMN IF NOT EXISTS bank_payout_provider text,
  ADD COLUMN IF NOT EXISTS bank_payout_amount numeric,
  ADD COLUMN IF NOT EXISTS bank_payout_currency text DEFAULT 'TND',
  ADD COLUMN IF NOT EXISTS bank_payout_initiated_at timestamptz,
  ADD COLUMN IF NOT EXISTS bank_payout_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bank_payout_error text;
