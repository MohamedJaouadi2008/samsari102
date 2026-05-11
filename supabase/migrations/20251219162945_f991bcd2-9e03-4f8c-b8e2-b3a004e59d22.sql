-- Clear duplicate phone number on newer profile (keeping the older one)
UPDATE public.profiles 
SET phone = NULL 
WHERE id = '0f83fae3-66ab-4399-8704-c998a4645073' AND phone = '+216 99711863';

-- Add unique constraint on phone number (partial index to allow NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique 
ON public.profiles (phone) 
WHERE phone IS NOT NULL;