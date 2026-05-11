-- Drop existing constraint
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Add updated constraint with all required status values
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
CHECK (status = ANY (ARRAY[
  'pending', 'confirmed', 'awaiting_payment', 'deposit_paid', 
  'payment_authorized', 'payment_held', 'awaiting_checkin',
  'awaiting_remaining_payment', 'checkin_dispute',
  'checked_in', 'checked_out', 'settlement_pending', 
  'dispute_window', 'disputed', 'settled', 'refunded', 
  'cancelled', 'cancelled_by_guest', 'cancelled_by_host', 
  'declined', 'completed'
]));