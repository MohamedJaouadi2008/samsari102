-- Add new escrow system fields to bookings table

-- Check-in confirmation fields
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS host_check_in_confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS guest_check_in_confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS check_in_condition_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS check_in_issues_reported BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS check_in_issues_description TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS check_in_issues_photos JSONB DEFAULT '[]'::jsonb;

-- Remaining payment (80%) fields
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS remaining_payment_amount NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS remaining_payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS remaining_payment_intent_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS remaining_payment_paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Check-out confirmation fields
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS host_check_out_confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS guest_check_out_confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS host_reported_damage BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS host_damage_description TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS host_damage_photos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS guest_condition_confirmed BOOLEAN DEFAULT FALSE;

-- Full payment lock
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS full_payment_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS full_payment_locked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Auto-protection timers
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS check_in_deadline TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS check_out_deadline TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Abuse tracking
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS dispute_filed_by TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS dispute_evidence JSONB DEFAULT NULL;

-- Currency for escrow (USD/EUR only)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS escrow_currency TEXT DEFAULT 'usd';

-- Create index for escrow management
CREATE INDEX IF NOT EXISTS idx_bookings_escrow_management 
ON public.bookings (escrow_status, status, check_out_date) 
WHERE escrow_status IN ('pending', 'held', 'disputed');

-- Create index for pending check-ins
CREATE INDEX IF NOT EXISTS idx_bookings_pending_checkin
ON public.bookings (check_in_date, host_check_in_confirmed_at, guest_check_in_confirmed_at)
WHERE status IN ('deposit_paid', 'awaiting_checkin');

-- Add abuse strike tracking to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS host_strikes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS guest_strikes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_strike_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS strike_reason TEXT DEFAULT NULL;