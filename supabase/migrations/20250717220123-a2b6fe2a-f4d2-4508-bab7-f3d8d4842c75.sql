
-- Add new columns to properties table for enhanced details
ALTER TABLE public.properties 
ADD COLUMN safety_features JSONB,
ADD COLUMN sleeping_arrangements JSONB,
ADD COLUMN minimum_stay INTEGER DEFAULT 1,
ADD COLUMN house_rules TEXT,
ADD COLUMN check_in_time TIME,
ADD COLUMN check_out_time TIME,
ADD COLUMN cancellation_policy TEXT DEFAULT 'moderate';
