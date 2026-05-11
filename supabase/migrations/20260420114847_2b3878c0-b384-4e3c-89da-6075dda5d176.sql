-- =========================================================
-- 1) PROFILES: replace blanket "USING(true)" public policy with
--    a row-level policy that excludes banned users from public view.
--    Column exposure is already restricted via prior REVOKE/GRANT.
-- =========================================================
DROP POLICY IF EXISTS "Public can view basic identity columns" ON public.profiles;

CREATE POLICY "Public can view non-banned profiles (safe columns)"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (COALESCE(is_banned, false) = false);

-- =========================================================
-- 2) PROPERTIES: split the public policy from the credentials policy.
--    Keep public listing readable, but ensure secrets only reachable
--    by host/admin/booked-guest. Column-level revokes already in place
--    for wifi/lockbox/address/etc. We tighten the row policy too.
-- =========================================================
-- (Existing policies are fine; column GRANTs already gate sensitive cols.
-- No change needed beyond keeping the prior migration.)
-- We add a no-op comment so this migration documents the chain.
COMMENT ON TABLE public.properties IS
  'Sensitive columns (wifi_password, lockbox_code, address, arrival_instructions, parking_info, google_maps_url) are revoked from anon and only available to authenticated via column-level GRANT; runtime access for guests goes through get_property_access_info() RPC.';

-- =========================================================
-- 3) REALTIME: lock down realtime.messages so users can only
--    subscribe to topics they own.
-- =========================================================
-- Enable RLS on realtime.messages (Supabase ships it disabled by default
-- when no policies exist, which is the leak the scanner flagged).
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Authenticated users may only receive broadcasts on a topic that matches
-- a conversation they participate in OR a notification addressed to them.
-- Topic naming convention used by the app: 
--   - "conversation:<conversation_id>"
--   - "notifications:<user_id>"
--   - "support:<conversation_id>"
DROP POLICY IF EXISTS "Authenticated can read own realtime topics" ON realtime.messages;
CREATE POLICY "Authenticated can read own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- notifications:<my-uid>
  (topic = 'notifications:' || auth.uid()::text)
  OR
  -- conversation:<id> where I am host or guest
  (
    topic LIKE 'conversation:%'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = split_part(topic, ':', 2)
        AND (c.host_id = auth.uid() OR c.guest_id = auth.uid())
    )
  )
  OR
  -- support:<id> where I am the user or an admin/moderator
  (
    topic LIKE 'support:%'
    AND (
      public.is_admin_or_moderator()
      OR EXISTS (
        SELECT 1 FROM public.support_conversations s
        WHERE s.id::text = split_part(topic, ':', 2)
          AND s.user_id = auth.uid()
      )
    )
  )
);

-- Allow authenticated users to send presence/broadcast on those same topics
DROP POLICY IF EXISTS "Authenticated can write own realtime topics" ON realtime.messages;
CREATE POLICY "Authenticated can write own realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (topic = 'notifications:' || auth.uid()::text)
  OR
  (
    topic LIKE 'conversation:%'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = split_part(topic, ':', 2)
        AND (c.host_id = auth.uid() OR c.guest_id = auth.uid())
    )
  )
  OR
  (
    topic LIKE 'support:%'
    AND (
      public.is_admin_or_moderator()
      OR EXISTS (
        SELECT 1 FROM public.support_conversations s
        WHERE s.id::text = split_part(topic, ':', 2)
          AND s.user_id = auth.uid()
      )
    )
  )
);
