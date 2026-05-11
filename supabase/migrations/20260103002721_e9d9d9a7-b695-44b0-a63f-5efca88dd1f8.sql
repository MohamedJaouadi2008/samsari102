-- Add Stripe Connect fields to profiles for hosts
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_account_status TEXT DEFAULT 'not_connected',
ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT false;

-- Add escrow tracking fields to bookings
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS escrow_held_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS escrow_released_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
ADD COLUMN IF NOT EXISTS host_stripe_account_id TEXT;

-- Create index for escrow status lookups
CREATE INDEX IF NOT EXISTS idx_bookings_escrow_status ON public.bookings(escrow_status);

-- Add comment to document escrow statuses
COMMENT ON COLUMN public.bookings.escrow_status IS 'Escrow status: pending, held, released, refunded';