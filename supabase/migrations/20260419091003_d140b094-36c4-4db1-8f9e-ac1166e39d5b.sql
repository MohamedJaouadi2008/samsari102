-- User search history for personalization
CREATE TABLE public.user_search_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  governorate TEXT,
  city TEXT,
  property_type TEXT,
  num_guests INTEGER,
  check_in DATE,
  check_out DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_search_history_user_id ON public.user_search_history(user_id, created_at DESC);

ALTER TABLE public.user_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own search history"
ON public.user_search_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own search history"
ON public.user_search_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own search history"
ON public.user_search_history FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all search history"
ON public.user_search_history FOR SELECT
USING (is_admin_or_moderator());

-- Daily picks cache
CREATE TABLE public.daily_picks_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pick_date DATE NOT NULL UNIQUE,
  property_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_picks_cache_date ON public.daily_picks_cache(pick_date DESC);

ALTER TABLE public.daily_picks_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view daily picks"
ON public.daily_picks_cache FOR SELECT
USING (true);