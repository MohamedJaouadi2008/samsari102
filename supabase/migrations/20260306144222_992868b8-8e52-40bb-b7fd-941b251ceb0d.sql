-- Clear all ID verification records
TRUNCATE TABLE public.id_verifications;

-- Reset all profiles verification status back to unverified
UPDATE public.profiles 
SET verification_status = 'unverified', 
    verification_submitted_at = NULL 
WHERE verification_status != 'unverified';