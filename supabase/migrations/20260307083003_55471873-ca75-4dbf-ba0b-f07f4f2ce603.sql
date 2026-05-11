-- Fix settled bookings with missing payout amounts
UPDATE bookings 
SET 
  host_payout_amount = ROUND(total_price * 0.91, 2), 
  platform_commission = ROUND(total_price * 0.09, 2) 
WHERE status = 'settled' 
  AND (host_payout_amount = 0 OR host_payout_amount IS NULL) 
  AND total_price > 0;