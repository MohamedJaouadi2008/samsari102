import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useUnreadSupportMessages = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) { setUnreadCount(0); return; }

    try {
      const { data: convos } = await supabase
        .from('support_conversations')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['open', 'assigned']);

      if (!convos?.length) { setUnreadCount(0); return; }

      const { data: msgs } = await supabase
        .from('support_messages')
        .select('id')
        .in('conversation_id', convos.map(c => c.id))
        .eq('read', false)
        .neq('sender_id', user.id);

      setUnreadCount(msgs?.length || 0);
    } catch {
      setUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    fetchUnreadCount();

    const channel = supabase
      .channel(`support-unread-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchUnreadCount]);

  return { unreadCount, refetch: fetchUnreadCount };
};
