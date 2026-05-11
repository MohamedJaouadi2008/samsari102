-- Add revenue tracking columns to bookings table
ALTER TABLE public.bookings
ADD COLUMN platform_commission numeric DEFAULT 0,
ADD COLUMN guest_service_fee numeric DEFAULT 0,
ADD COLUMN payment_status text DEFAULT 'pending',
ADD COLUMN payment_method text,
ADD COLUMN stripe_payment_intent_id text,
ADD COLUMN deposit_amount numeric DEFAULT 100;

-- Add comment for clarity
COMMENT ON COLUMN bookings.platform_commission IS 'Host commission percentage taken by platform (stored as amount)';
COMMENT ON COLUMN bookings.guest_service_fee IS 'Service fee charged to guest (12% of subtotal)';
COMMENT ON COLUMN bookings.payment_status IS 'Status: pending, completed, failed, refunded';
COMMENT ON COLUMN bookings.deposit_amount IS 'Reservation deposit amount in TND';