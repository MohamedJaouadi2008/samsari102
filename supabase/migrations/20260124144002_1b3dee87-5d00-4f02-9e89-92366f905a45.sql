-- Add missing columns for comprehensive payment tracking

-- Stripe dispute tracking
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS stripe_dispute_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_dispute_reason TEXT,
ADD COLUMN IF NOT EXISTS stripe_dispute_status TEXT,
ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMP WITH TIME ZONE;

-- Remaining payment tracking
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS stripe_remaining_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS remaining_payment_paid_at TIMESTAMP WITH TIME ZONE;

-- Payment failure tracking
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS payment_failure_reason TEXT,
ADD COLUMN IF NOT EXISTS payment_failure_at TIMESTAMP WITH TIME ZONE;

-- Transfer failure tracking
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS transfer_failure_reason TEXT,
ADD COLUMN IF NOT EXISTS transfer_failure_at TIMESTAMP WITH TIME ZONE;

-- Add payment_failed to booking status constraint (if not already present)
-- First check if constraint exists and drop it
DO $$ 
BEGIN
  -- The constraint might not allow payment_failed yet, so we need to update it
  -- This is a safe operation that adds the new status value
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_check') THEN
    ALTER TABLE public.bookings DROP CONSTRAINT bookings_status_check;
  END IF;
END $$;

-- Re-create constraint with payment_failed status
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check 
CHECK (status IN (
  'pending', 'confirmed', 'awaiting_payment', 'deposit_paid', 
  'awaiting_checkin', 'awaiting_remaining_payment', 'checkin_dispute',
  'payment_authorized', 'payment_held', 'checked_in', 'checked_out', 
  'settlement_pending', 'dispute_window', 'disputed', 'settled', 'refunded',
  'cancelled_by_guest', 'cancelled_by_host', 'cancelled_by_system', 
  'auto_cancelled', 'declined', 'payment_failed'
));

-- Add escrow status for frozen and transfer_failed
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_escrow_status_check') THEN
    ALTER TABLE public.bookings DROP CONSTRAINT bookings_escrow_status_check;
  END IF;
END $$;

ALTER TABLE public.bookings ADD CONSTRAINT bookings_escrow_status_check 
CHECK (escrow_status IS NULL OR escrow_status IN (
  'none', 'pending', 'held', 'ready_for_release', 'released', 
  'refunded', 'disputed', 'frozen', 'transfer_failed', 
  'pending_manual_payout', 'refunded_by_dispute'
));

-- Create index for dispute lookups
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_dispute_id ON public.bookings(stripe_dispute_id);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_remaining_pi ON public.bookings(stripe_remaining_payment_intent_id);