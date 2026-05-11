-- P1.5: Add refund tracking columns to bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS dispute_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS dispute_opened_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS settlement_due_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS host_payout_amount NUMERIC DEFAULT 0;

-- P1.5: Create function to calculate refund based on cancellation policy
CREATE OR REPLACE FUNCTION public.calculate_cancellation_refund(
  p_booking_id UUID,
  p_cancelled_by TEXT  -- 'guest' or 'host'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_property RECORD;
  v_days_until_checkin INTEGER;
  v_refund_percentage NUMERIC;
  v_refund_amount NUMERIC;
  v_reason TEXT;
BEGIN
  -- Get booking details
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Booking not found');
  END IF;
  
  -- Get property for cancellation policy
  SELECT * INTO v_property FROM properties WHERE id = v_booking.property_id;
  
  -- Calculate days until check-in
  v_days_until_checkin := v_booking.check_in_date - CURRENT_DATE;
  
  -- If host cancels, guest gets full refund
  IF p_cancelled_by = 'host' THEN
    v_refund_percentage := 100;
    v_reason := 'Host cancelled - full refund';
  ELSE
    -- Guest cancellation - apply policy
    CASE v_property.cancellation_policy
      WHEN 'flexible' THEN
        -- Full refund up to 24 hours before check-in
        IF v_days_until_checkin >= 1 THEN
          v_refund_percentage := 100;
          v_reason := 'Flexible policy - cancelled 24+ hours before check-in';
        ELSE
          v_refund_percentage := 0;
          v_reason := 'Flexible policy - cancelled less than 24 hours before check-in';
        END IF;
        
      WHEN 'moderate' THEN
        -- Full refund up to 5 days before check-in
        IF v_days_until_checkin >= 5 THEN
          v_refund_percentage := 100;
          v_reason := 'Moderate policy - cancelled 5+ days before check-in';
        ELSIF v_days_until_checkin >= 1 THEN
          v_refund_percentage := 50;
          v_reason := 'Moderate policy - cancelled 1-5 days before check-in (50% refund)';
        ELSE
          v_refund_percentage := 0;
          v_reason := 'Moderate policy - cancelled less than 24 hours before check-in';
        END IF;
        
      WHEN 'strict' THEN
        -- Full refund up to 7 days, 50% up to 48 hours
        IF v_days_until_checkin >= 7 THEN
          v_refund_percentage := 100;
          v_reason := 'Strict policy - cancelled 7+ days before check-in';
        ELSIF v_days_until_checkin >= 2 THEN
          v_refund_percentage := 50;
          v_reason := 'Strict policy - cancelled 2-7 days before check-in (50% refund)';
        ELSE
          v_refund_percentage := 0;
          v_reason := 'Strict policy - cancelled less than 48 hours before check-in';
        END IF;
        
      ELSE
        -- Default to moderate
        IF v_days_until_checkin >= 5 THEN
          v_refund_percentage := 100;
          v_reason := 'Default policy - cancelled 5+ days before check-in';
        ELSE
          v_refund_percentage := 50;
          v_reason := 'Default policy - partial refund';
        END IF;
    END CASE;
  END IF;
  
  -- Calculate refund amount based on what was paid
  IF v_booking.payment_status = 'paid' THEN
    v_refund_amount := (COALESCE(v_booking.deposit_amount, 0) * v_refund_percentage / 100);
  ELSE
    v_refund_amount := 0;
  END IF;
  
  RETURN jsonb_build_object(
    'refund_percentage', v_refund_percentage,
    'refund_amount', v_refund_amount,
    'reason', v_reason,
    'days_until_checkin', v_days_until_checkin,
    'cancellation_policy', v_property.cancellation_policy,
    'deposit_paid', COALESCE(v_booking.deposit_amount, 0)
  );
END;
$$;

-- P1.7: Create function to process settlement after dispute window
CREATE OR REPLACE FUNCTION public.process_booking_settlement(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_host_payout NUMERIC;
  v_platform_commission NUMERIC;
BEGIN
  -- Get booking
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Booking not found');
  END IF;
  
  -- Check if eligible for settlement
  IF v_booking.status NOT IN ('dispute_window', 'settlement_pending') THEN
    RETURN jsonb_build_object('error', 'Booking not eligible for settlement');
  END IF;
  
  -- Check if dispute window has passed (48 hours after checkout)
  IF v_booking.actual_check_out IS NULL THEN
    RETURN jsonb_build_object('error', 'Checkout not recorded');
  END IF;
  
  IF v_booking.actual_check_out + INTERVAL '48 hours' > NOW() THEN
    RETURN jsonb_build_object('error', 'Dispute window still active', 'ends_at', v_booking.actual_check_out + INTERVAL '48 hours');
  END IF;
  
  -- Calculate commission (10% platform fee)
  v_platform_commission := v_booking.total_price * 0.10;
  v_host_payout := v_booking.total_price - v_platform_commission;
  
  -- Update booking to settled
  UPDATE bookings SET
    status = 'settled',
    settled_at = NOW(),
    host_payout_amount = v_host_payout,
    platform_commission = v_platform_commission
  WHERE id = p_booking_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'host_payout', v_host_payout,
    'platform_commission', v_platform_commission,
    'settled_at', NOW()
  );
END;
$$;

-- P1.6 & P1.7: Update booking status change trigger to handle settlement timing
CREATE OR REPLACE FUNCTION public.handle_booking_status_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set timestamps based on status changes
  IF NEW.status = 'checked_in' AND OLD.status != 'checked_in' THEN
    NEW.actual_check_in := COALESCE(NEW.actual_check_in, NOW());
  END IF;
  
  IF NEW.status = 'checked_out' AND OLD.status != 'checked_out' THEN
    NEW.actual_check_out := COALESCE(NEW.actual_check_out, NOW());
    -- Automatically transition to settlement_pending
    NEW.status := 'settlement_pending';
    NEW.settlement_due_at := NOW() + INTERVAL '48 hours';
  END IF;
  
  IF NEW.status IN ('cancelled_by_guest', 'cancelled_by_host') AND OLD.status NOT IN ('cancelled_by_guest', 'cancelled_by_host') THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, NOW());
  END IF;
  
  IF NEW.status = 'disputed' AND OLD.status != 'disputed' THEN
    NEW.dispute_opened_at := COALESCE(NEW.dispute_opened_at, NOW());
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_status_timestamps ON public.bookings;
CREATE TRIGGER booking_status_timestamps
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_booking_status_timestamps();

-- Update the status transition validation to include new flows
CREATE OR REPLACE FUNCTION public.validate_booking_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  valid_transitions JSONB := '{
    "pending": ["confirmed", "declined", "cancelled_by_guest", "cancelled_by_host"],
    "confirmed": ["awaiting_payment", "cancelled_by_guest", "cancelled_by_host"],
    "awaiting_payment": ["deposit_paid", "cancelled_by_guest", "cancelled_by_host"],
    "deposit_paid": ["payment_authorized", "payment_held", "checked_in", "cancelled_by_guest", "cancelled_by_host"],
    "payment_authorized": ["payment_held", "cancelled_by_guest", "cancelled_by_host"],
    "payment_held": ["checked_in", "cancelled_by_guest", "cancelled_by_host"],
    "checked_in": ["checked_out"],
    "checked_out": ["settlement_pending"],
    "settlement_pending": ["dispute_window", "disputed", "settled"],
    "dispute_window": ["settled", "disputed"],
    "disputed": ["refunded", "settled"],
    "settled": [],
    "refunded": [],
    "cancelled_by_guest": [],
    "cancelled_by_host": [],
    "declined": []
  }'::JSONB;
  allowed_statuses JSONB;
BEGIN
  -- Skip validation if status hasn't changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get allowed transitions for current status
  allowed_statuses := valid_transitions -> OLD.status;
  
  -- Check if transition is valid
  IF allowed_statuses IS NULL OR NOT (allowed_statuses ? NEW.status) THEN
    RAISE EXCEPTION 'Invalid booking status transition from % to %', OLD.status, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$;