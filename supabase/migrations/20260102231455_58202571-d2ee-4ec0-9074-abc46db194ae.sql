-- Drop the old restrictive status check constraint
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Create new constraint with all valid statuses used in the application
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text, 
  'confirmed'::text, 
  'awaiting_payment'::text,
  'deposit_paid'::text,
  'payment_authorized'::text,
  'payment_held'::text,
  'checked_in'::text,
  'checked_out'::text,
  'settlement_pending'::text,
  'dispute_window'::text,
  'disputed'::text,
  'settled'::text,
  'refunded'::text,
  'cancelled'::text,
  'cancelled_by_guest'::text, 
  'cancelled_by_host'::text,
  'declined'::text,
  'completed'::text
]));