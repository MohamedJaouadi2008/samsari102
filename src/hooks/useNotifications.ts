import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  booking_id: string | null;
  read: boolean;
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch from notifications table
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching notifications:", error);
        return;
      }

      setNotifications(data || []);
      
      // Count unread notifications
      const unreadCount = (data || []).filter(n => !n.read).length;
      setNotificationCount(unreadCount);
    } catch (error) {
      console.error("Error in fetchNotifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setNotificationCount(0);
      return;
    }

    fetchNotifications();

    // Set up real-time subscription for new notifications
    const notificationsSubscription = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Add new notification to the list
          setNotifications(prev => [payload.new as Notification, ...prev]);
          setNotificationCount(prev => prev + 1);
        }
      )
      .subscribe();

    // Also subscribe to booking changes for real-time updates
    const bookingsSubscription = supabase
      .channel(`bookings-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings'
        },
        () => {
          // Refresh notifications when bookings change
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsSubscription);
      supabase.removeChannel(bookingsSubscription);
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setNotificationCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setNotificationCount(0);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  // Legacy support - mark as viewed updates all to read
  const markAsViewed = () => {
    markAllAsRead();
  };

  return { 
    notificationCount, 
    notifications, 
    loading,
    markAsViewed,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications
  };
};
