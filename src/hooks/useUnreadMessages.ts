
import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useUnreadMessages = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      // Get all conversations for the user
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .or(`host_id.eq.${user.id},guest_id.eq.${user.id}`);

      if (convError) throw convError;

      if (!conversations || conversations.length === 0) {
        setUnreadCount(0);
        return;
      }

      // Get unread messages count - only messages sent by other users
      const { data: unreadMessages, error: msgError } = await supabase
        .from('messages')
        .select('id')
        .in('conversation_id', conversations.map(c => c.id))
        .eq('read', false)
        .neq('sender_id', user.id);

      if (msgError) throw msgError;

      const count = unreadMessages?.length || 0;
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    // Initial fetch
    fetchUnreadCount();

    // Set up real-time subscription - refetch on any message change
    const channel = supabase
      .channel(`unread-messages-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        // If it's not from the current user, refetch count
        if (payload.new.sender_id !== user.id) {
          fetchUnreadCount();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
      }, () => {
        // Refetch count on any message update (read status change)
        fetchUnreadCount();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations'
      }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  // Mark all messages as read and clear badge
  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    
    try {
      // Get all conversations for the user
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .or(`host_id.eq.${user.id},guest_id.eq.${user.id}`);

      if (convError) throw convError;

      if (!conversations || conversations.length === 0) return;

      // Mark all unread messages as read
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .in('conversation_id', conversations.map(c => c.id))
        .eq('read', false)
        .neq('sender_id', user.id);

      if (error) throw error;
      
      // Immediately set count to 0
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [user]);

  return { unreadCount, refetch: fetchUnreadCount, markAllAsRead };
};
