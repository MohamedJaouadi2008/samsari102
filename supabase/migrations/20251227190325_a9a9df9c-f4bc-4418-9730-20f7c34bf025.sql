-- P0.2: Create notifications table for guest and host notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- System can create notifications (via triggers/functions)
CREATE POLICY "System can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- P0.3: Create function to handle booking status changes and notify users
CREATE OR REPLACE FUNCTION public.handle_booking_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  property_title TEXT;
  guest_name TEXT;
  host_name TEXT;
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT;
  target_user_id UUID;
BEGIN
  -- Get property title
  SELECT title INTO property_title FROM properties WHERE id = NEW.property_id;
  
  -- Get guest name
  SELECT full_name INTO guest_name FROM profiles WHERE id = NEW.guest_id;
  
  -- Get host name
  SELECT full_name INTO host_name FROM profiles WHERE id = NEW.host_id;
  
  -- Only process if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Notify guest about status changes
    CASE NEW.status
      WHEN 'confirmed' THEN
        notification_type := 'booking_confirmed';
        notification_title := 'Booking Confirmed!';
        notification_message := 'Your booking for ' || COALESCE(property_title, 'the property') || ' has been confirmed. Please proceed to payment.';
        target_user_id := NEW.guest_id;
        
      WHEN 'awaiting_payment' THEN
        notification_type := 'payment_required';
        notification_title := 'Payment Required';
        notification_message := 'Please complete your deposit payment for ' || COALESCE(property_title, 'the property') || ' to secure your booking.';
        target_user_id := NEW.guest_id;
        
      WHEN 'deposit_paid' THEN
        notification_type := 'deposit_received';
        notification_title := 'Deposit Received';
        notification_message := 'Your deposit for ' || COALESCE(property_title, 'the property') || ' has been received. Your booking is secured!';
        target_user_id := NEW.guest_id;
        
      WHEN 'declined' THEN
        notification_type := 'booking_declined';
        notification_title := 'Booking Declined';
        notification_message := 'Unfortunately, your booking request for ' || COALESCE(property_title, 'the property') || ' was declined by the host.';
        target_user_id := NEW.guest_id;
        
      WHEN 'cancelled_by_host' THEN
        notification_type := 'booking_cancelled';
        notification_title := 'Booking Cancelled by Host';
        notification_message := 'Your booking for ' || COALESCE(property_title, 'the property') || ' has been cancelled by the host.';
        target_user_id := NEW.guest_id;
        
      WHEN 'cancelled_by_guest' THEN
        notification_type := 'booking_cancelled';
        notification_title := 'Booking Cancelled';
        notification_message := COALESCE(guest_name, 'A guest') || ' has cancelled their booking for ' || COALESCE(property_title, 'your property') || '.';
        target_user_id := NEW.host_id;
        
      WHEN 'checked_in' THEN
        notification_type := 'checked_in';
        notification_title := 'Check-in Confirmed';
        notification_message := 'Welcome! Your check-in for ' || COALESCE(property_title, 'the property') || ' has been recorded.';
        target_user_id := NEW.guest_id;
        
      WHEN 'checked_out' THEN
        notification_type := 'checked_out';
        notification_title := 'Check-out Complete';
        notification_message := 'Thank you for staying at ' || COALESCE(property_title, 'the property') || '. Your checkout has been recorded.';
        target_user_id := NEW.guest_id;
        
      WHEN 'settlement_pending' THEN
        notification_type := 'settlement_pending';
        notification_title := 'Settlement Processing';
        notification_message := 'Payment for booking at ' || COALESCE(property_title, 'the property') || ' is being processed. Funds will be released after the dispute window.';
        target_user_id := NEW.host_id;
        
      WHEN 'disputed' THEN
        notification_type := 'dispute_opened';
        notification_title := 'Dispute Filed';
        notification_message := 'A dispute has been filed for booking at ' || COALESCE(property_title, 'the property') || '. Our team will review.';
        target_user_id := NEW.host_id;
        
        -- Also notify guest
        INSERT INTO notifications (user_id, type, title, message, booking_id, link)
        VALUES (NEW.guest_id, 'dispute_opened', 'Dispute Received', 'Your dispute for ' || COALESCE(property_title, 'the property') || ' has been received and is under review.', NEW.id, '/profile?tab=reservations');
        
      WHEN 'settled' THEN
        notification_type := 'payment_released';
        notification_title := 'Payment Released';
        notification_message := 'Funds for booking at ' || COALESCE(property_title, 'the property') || ' have been released to your account.';
        target_user_id := NEW.host_id;
        
      ELSE
        -- No notification for other statuses
        RETURN NEW;
    END CASE;
    
    -- Insert the notification
    IF target_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, booking_id, link)
      VALUES (
        target_user_id, 
        notification_type, 
        notification_title, 
        notification_message, 
        NEW.id,
        CASE 
          WHEN target_user_id = NEW.guest_id THEN '/profile?tab=reservations'
          ELSE '/profile?tab=requests'
        END
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for booking status changes
DROP TRIGGER IF EXISTS on_booking_status_change ON public.bookings;
CREATE TRIGGER on_booking_status_change
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_booking_status_change();

-- Also create a trigger for new bookings to notify hosts
CREATE OR REPLACE FUNCTION public.handle_new_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  property_title TEXT;
  guest_name TEXT;
BEGIN
  -- Get property title
  SELECT title INTO property_title FROM properties WHERE id = NEW.property_id;
  
  -- Get guest name
  SELECT full_name INTO guest_name FROM profiles WHERE id = NEW.guest_id;
  
  -- Notify host about new booking request
  INSERT INTO notifications (user_id, type, title, message, booking_id, link)
  VALUES (
    NEW.host_id,
    'new_booking_request',
    'New Booking Request',
    COALESCE(guest_name, 'A guest') || ' wants to book ' || COALESCE(property_title, 'your property'),
    NEW.id,
    '/profile?tab=requests'
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_booking ON public.bookings;
CREATE TRIGGER on_new_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_booking();

-- P0.3: Create booking status transition function to enforce valid transitions
CREATE OR REPLACE FUNCTION public.validate_booking_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  valid_transitions JSONB := '{
    "pending": ["confirmed", "declined", "cancelled_by_guest", "cancelled_by_host"],
    "confirmed": ["awaiting_payment", "cancelled_by_guest", "cancelled_by_host"],
    "awaiting_payment": ["deposit_paid", "cancelled_by_guest", "cancelled_by_host"],
    "deposit_paid": ["payment_authorized", "cancelled_by_guest", "cancelled_by_host"],
    "payment_authorized": ["payment_held", "cancelled_by_guest", "cancelled_by_host"],
    "payment_held": ["checked_in", "cancelled_by_guest", "cancelled_by_host"],
    "checked_in": ["checked_out"],
    "checked_out": ["settlement_pending", "disputed"],
    "settlement_pending": ["dispute_window", "disputed"],
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
  
  -- Auto-set timestamps based on status
  IF NEW.status = 'checked_in' AND NEW.actual_check_in IS NULL THEN
    NEW.actual_check_in := now();
  END IF;
  
  IF NEW.status = 'checked_out' AND NEW.actual_check_out IS NULL THEN
    NEW.actual_check_out := now();
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_booking_status ON public.bookings;
CREATE TRIGGER validate_booking_status
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_booking_status_transition();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;