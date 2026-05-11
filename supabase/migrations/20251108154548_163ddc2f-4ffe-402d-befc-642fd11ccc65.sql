-- Create a view for hosts to see their bookings without commission data
CREATE VIEW host_bookings_view AS
SELECT 
  id,
  property_id,
  guest_id,
  host_id,
  check_in_date,
  check_out_date,
  total_price,
  created_at,
  updated_at,
  check_in_time,
  check_out_time,
  actual_check_in,
  actual_check_out,
  responded_at,
  host_response,
  payment_status,
  payment_method,
  status,
  stripe_payment_intent_id,
  request_message,
  deposit_amount
FROM bookings;

-- Grant appropriate access to the view
GRANT SELECT ON host_bookings_view TO authenticated;

-- Create RLS policy for the view
ALTER VIEW host_bookings_view SET (security_invoker = on);

-- Note: The original bookings table RLS policies remain in place for guests
-- Hosts will need to query the view instead to avoid seeing commission data