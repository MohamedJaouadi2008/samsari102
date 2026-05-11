-- Create escrow audit log table for tracking all automated actions
CREATE TABLE IF NOT EXISTS public.escrow_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'auto_cancel', 'auto_release', 'auto_dispute', 'admin_override', 'auto_refund'
  action_reason TEXT NOT NULL, -- Human-readable explanation
  triggered_by TEXT NOT NULL, -- 'cron', 'admin', 'user'
  triggered_by_user_id UUID, -- If admin or user action
  previous_status TEXT,
  new_status TEXT,
  previous_escrow_status TEXT,
  new_escrow_status TEXT,
  amount_affected NUMERIC, -- Amount refunded or released
  stripe_transfer_id TEXT,
  stripe_refund_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_escrow_audit_log_booking_id ON public.escrow_audit_log(booking_id);
CREATE INDEX idx_escrow_audit_log_created_at ON public.escrow_audit_log(created_at DESC);
CREATE INDEX idx_escrow_audit_log_action_type ON public.escrow_audit_log(action_type);

-- RLS policies for escrow_audit_log
ALTER TABLE public.escrow_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.escrow_audit_log
FOR SELECT
USING (public.is_admin());

-- Only system (via service role) can insert audit logs
CREATE POLICY "Service role can insert audit logs"
ON public.escrow_audit_log
FOR INSERT
WITH CHECK (true);

-- Add remaining_payment_deadline to bookings if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'remaining_payment_deadline'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN remaining_payment_deadline TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add dispute_deadline to bookings if not exists (48 hours after both checkout confirmations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'dispute_deadline'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN dispute_deadline TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add auto_action_taken flag to prevent duplicate auto-actions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'auto_action_taken'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN auto_action_taken TEXT;
  END IF;
END $$;

-- Add auto_action_taken_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'auto_action_taken_at'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN auto_action_taken_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Index for cron job to find bookings needing action
CREATE INDEX IF NOT EXISTS idx_bookings_deadline_enforcement 
ON public.bookings(status, escrow_status, check_in_deadline, remaining_payment_deadline, check_out_deadline, dispute_deadline)
WHERE status NOT IN ('settled', 'refunded', 'cancelled_by_guest', 'cancelled_by_host', 'declined');