
-- Create reviews table linked to bookings
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(booking_id) -- One review per booking
);

-- Create saved properties table
CREATE TABLE public.saved_properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, property_id) -- One save per user per property
);

-- Add check_in_time and check_out_time to bookings for precise timing
ALTER TABLE public.bookings 
ADD COLUMN check_in_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN check_out_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN actual_check_in TIMESTAMP WITH TIME ZONE,
ADD COLUMN actual_check_out TIMESTAMP WITH TIME ZONE;

-- Enable RLS on reviews table
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Reviews policies
CREATE POLICY "Users can view reviews for properties they can see" 
  ON public.reviews 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p 
      WHERE p.id = property_id 
      AND (p.is_public = true AND p.status = 'published')
    )
  );

CREATE POLICY "Users can create reviews for their completed bookings" 
  ON public.reviews 
  FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM public.bookings b 
      WHERE b.id = booking_id 
      AND b.guest_id = auth.uid()
      AND (
        (b.status = 'completed' AND b.actual_check_out IS NOT NULL)
        OR 
        (b.status = 'cancelled' AND b.actual_check_in IS NOT NULL 
         AND b.actual_check_in + INTERVAL '5 hours' >= now())
      )
    )
  );

CREATE POLICY "Users can update their own reviews" 
  ON public.reviews 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Enable RLS on saved properties
ALTER TABLE public.saved_properties ENABLE ROW LEVEL SECURITY;

-- Saved properties policies
CREATE POLICY "Users can manage their own saved properties" 
  ON public.saved_properties 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_reviews_property_id ON public.reviews(property_id);
CREATE INDEX idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX idx_saved_properties_user_id ON public.saved_properties(user_id);
CREATE INDEX idx_saved_properties_property_id ON public.saved_properties(property_id);
CREATE INDEX idx_bookings_dates ON public.bookings(check_in_date, check_out_date);
