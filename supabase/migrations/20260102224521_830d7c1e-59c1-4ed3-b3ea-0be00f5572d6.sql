-- Drop existing update policy
DROP POLICY IF EXISTS "Hosts can update their property bookings" ON public.bookings;

-- Create new update policy that allows both hosts AND guests to update bookings
CREATE POLICY "Users can update their bookings"
ON public.bookings
FOR UPDATE
USING (auth.uid() = host_id OR auth.uid() = guest_id);