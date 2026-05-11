-- Recreate host_bookings_view with security_invoker so bookings RLS applies
DROP VIEW IF EXISTS public.host_bookings_view;

CREATE VIEW public.host_bookings_view
WITH (security_invoker = true)
AS
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