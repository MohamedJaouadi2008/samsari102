ALTER TABLE public.property_promotions
ADD COLUMN auto_renew boolean DEFAULT false,
ADD COLUMN stripe_subscription_id text;