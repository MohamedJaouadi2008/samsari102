-- Create webhook_events table to store all Stripe webhook events
CREATE TABLE public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  booking_id UUID REFERENCES public.bookings(id),
  metadata JSONB,
  payload JSONB,
  processing_status TEXT NOT NULL DEFAULT 'received',
  db_changes JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Add index for faster lookups
CREATE INDEX idx_webhook_events_event_type ON public.webhook_events(event_type);
CREATE INDEX idx_webhook_events_booking_id ON public.webhook_events(booking_id);
CREATE INDEX idx_webhook_events_created_at ON public.webhook_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook events
CREATE POLICY "Admins can view webhook events"
ON public.webhook_events
FOR SELECT
USING (public.is_admin());

-- Add comment
COMMENT ON TABLE public.webhook_events IS 'Stores all Stripe webhook events for debugging and audit trails';