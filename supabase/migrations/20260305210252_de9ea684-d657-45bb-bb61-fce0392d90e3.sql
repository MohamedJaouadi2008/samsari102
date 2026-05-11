
-- Add status column to reviews for moderation
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS admin_notes text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewed_by uuid;

-- Update existing reviews to approved (grandfathered in)
UPDATE public.reviews SET status = 'approved' WHERE status = 'pending';

-- Add admin select policy for reviews
CREATE POLICY "Admins can view all reviews" ON public.reviews FOR SELECT TO authenticated USING (is_admin());

-- Add admin update policy for reviews  
CREATE POLICY "Admins can update reviews" ON public.reviews FOR UPDATE TO authenticated USING (is_admin());

-- Update existing select policy to only show approved reviews
DROP POLICY IF EXISTS "Users can view reviews for properties they can see" ON public.reviews;
CREATE POLICY "Users can view approved reviews for public properties" ON public.reviews FOR SELECT USING (
  (status = 'approved' AND EXISTS (
    SELECT 1 FROM properties p WHERE p.id = reviews.property_id AND p.is_public = true AND p.status = 'published'
  ))
);
