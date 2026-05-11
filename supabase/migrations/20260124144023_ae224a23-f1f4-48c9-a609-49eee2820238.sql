-- Update the validate_booking_status_transition function to include payment_failed
CREATE OR REPLACE FUNCTION public.validate_booking_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  valid_transitions JSONB := '{
    "pending": ["confirmed", "declined", "cancelled_by_guest", "cancelled_by_host"],
    "confirmed": ["awaiting_payment", "cancelled_by_guest", "cancelled_by_host"],
    "awaiting_payment": ["deposit_paid", "cancelled_by_guest", "cancelled_by_host", "cancelled_by_system"],
    "deposit_paid": ["payment_authorized", "payment_held", "checked_in", "awaiting_remaining_payment", "awaiting_checkin", "checkin_dispute", "cancelled_by_guest", "cancelled_by_host", "cancelled_by_system", "disputed"],
    "awaiting_checkin": ["awaiting_remaining_payment", "checkin_dispute", "cancelled_by_guest", "cancelled_by_host", "cancelled_by_system"],
    "awaiting_remaining_payment": ["checked_in", "cancelled_by_guest", "cancelled_by_host", "cancelled_by_system", "auto_cancelled", "payment_failed"],
    "payment_failed": ["awaiting_remaining_payment", "cancelled_by_system"],
    "checkin_dispute": ["cancelled_by_guest", "cancelled_by_host", "refunded", "awaiting_remaining_payment", "disputed"],
    "payment_authorized": ["payment_held", "cancelled_by_guest", "cancelled_by_host"],
    "payment_held": ["checked_in", "cancelled_by_guest", "cancelled_by_host"],
    "checked_in": ["checked_out", "disputed", "settlement_pending"],
    "checked_out": ["settlement_pending"],
    "settlement_pending": ["dispute_window", "disputed", "settled"],
    "dispute_window": ["settled", "disputed"],
    "disputed": ["refunded", "settled", "settlement_pending"],
    "settled": [],
    "refunded": [],
    "cancelled_by_guest": [],
    "cancelled_by_host": [],
    "cancelled_by_system": [],
    "auto_cancelled": [],
    "declined": []
  }'::JSONB;
  allowed_statuses JSONB;
BEGIN
  -- Skip validation if status is NULL (new row) or unchanged
  IF OLD.status IS NULL OR OLD.status = NEW.status THEN
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
$function$;