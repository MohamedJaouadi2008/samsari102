-- Add preferred currency column to profiles
ALTER TABLE public.profiles 
ADD COLUMN preferred_currency text DEFAULT 'TND' CHECK (preferred_currency IN ('TND', 'USD', 'EUR'));