
-- Wishlist Collections
CREATE TABLE public.wishlist_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description TEXT CHECK (char_length(description) <= 500),
  cover_property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wishlist_collections_user ON public.wishlist_collections(user_id);
CREATE INDEX idx_wishlist_collections_share ON public.wishlist_collections(share_token);

ALTER TABLE public.wishlist_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_select_own" ON public.wishlist_collections
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "public_collections_select" ON public.wishlist_collections
  FOR SELECT USING (is_public = true);
CREATE POLICY "owners_insert" ON public.wishlist_collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners_update" ON public.wishlist_collections
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owners_delete" ON public.wishlist_collections
  FOR DELETE USING (auth.uid() = user_id);

-- Wishlist Items
CREATE TABLE public.wishlist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES public.wishlist_collections(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  notes TEXT CHECK (char_length(notes) <= 500),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection_id, property_id)
);
CREATE INDEX idx_wishlist_items_collection ON public.wishlist_items(collection_id);
CREATE INDEX idx_wishlist_items_property ON public.wishlist_items(property_id);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_select_owner" ON public.wishlist_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.wishlist_collections c
      WHERE c.id = wishlist_items.collection_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "items_select_public" ON public.wishlist_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.wishlist_collections c
      WHERE c.id = wishlist_items.collection_id AND c.is_public = true
    )
  );
CREATE POLICY "items_insert_owner" ON public.wishlist_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.wishlist_collections c
      WHERE c.id = wishlist_items.collection_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "items_update_owner" ON public.wishlist_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.wishlist_collections c
      WHERE c.id = wishlist_items.collection_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "items_delete_owner" ON public.wishlist_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.wishlist_collections c
      WHERE c.id = wishlist_items.collection_id AND c.user_id = auth.uid()
    )
  );

-- Saved Searches
CREATE TABLE public.saved_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  last_alerted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_saved_searches_user ON public.saved_searches(user_id);
CREATE INDEX idx_saved_searches_alerts ON public.saved_searches(alerts_enabled) WHERE alerts_enabled = true;

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ss_select_own" ON public.saved_searches
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_insert_own" ON public.saved_searches
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_update_own" ON public.saved_searches
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_delete_own" ON public.saved_searches
  FOR DELETE USING (auth.uid() = user_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER wishlist_collections_touch BEFORE UPDATE ON public.wishlist_collections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER saved_searches_touch BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
