-- Add num_guests column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN num_guests integer NOT NULL DEFAULT 1;

-- Add constraint to ensure num_guests is positive
ALTER TABLE public.bookings 
ADD CONSTRAINT bookings_num_guests_positive CHECK (num_guests > 0);