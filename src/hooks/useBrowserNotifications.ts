import { useEffect, useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const useBrowserNotifications = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin status once
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(data === true));
  }, [user]);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  }, []);

  const showNotification = useCallback((title: string, body: string, link?: string | null) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    // Only show if tab is not focused
    if (document.hasFocus()) return;

    const notification = new Notification(title, {
      body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: `samsari-${Date.now()}`,
    });

    notification.onclick = () => {
      window.focus();
      if (link) {
        window.location.href = link;
      }
      notification.close();
    };

    // Auto-close after 8 seconds
    setTimeout(() => notification.close(), 8000);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Request permission on mount
    requestPermission();

    // Listen for new notifications from Supabase
    const channel = supabase
      .channel(`browser-notif-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const n = payload.new as { title: string; message: string; link: string | null };
          showNotification(n.title, n.message, n.link);
        }
      )
      .subscribe();

    // Also listen for new messages
    const msgChannel = supabase
      .channel(`browser-msg-notif-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new as { sender_id: string; content: string };
          if (msg.sender_id !== user.id) {
            showNotification("New Message — Samsari", msg.content, "/profile?tab=inbox");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(msgChannel);
    };
  }, [user, requestPermission, showNotification]);

  // Admin-specific notifications
  useEffect(() => {
    if (!user || !isAdmin) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    // New bookings
    const bookingCh = supabase
      .channel(`admin-bookings-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, () => {
        showNotification('New Booking Request', 'A new booking has been submitted.', '/admin');
      })
      .subscribe();
    channels.push(bookingCh);

    // New ID verifications
    const idCh = supabase
      .channel(`admin-verifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'id_verifications' }, () => {
        showNotification('New ID Verification', 'A user submitted ID verification for review.', '/admin');
      })
      .subscribe();
    channels.push(idCh);

    // Disputes
    const disputeCh = supabase
      .channel(`admin-disputes-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings' }, (payload) => {
        const b = payload.new as { status?: string };
        if (b.status === 'disputed') {
          showNotification('Dispute Filed', 'A booking dispute requires admin attention.', '/admin');
        }
      })
      .subscribe();
    channels.push(disputeCh);

    // User reports
    const reportCh = supabase
      .channel(`admin-reports-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_reports' }, () => {
        showNotification('New User Report', 'A user has been reported and needs review.', '/admin');
      })
      .subscribe();
    channels.push(reportCh);

    // Ban appeals
    const appealCh = supabase
      .channel(`admin-appeals-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ban_appeals' }, () => {
        showNotification('New Ban Appeal', 'A banned user submitted an appeal.', '/admin');
      })
      .subscribe();
    channels.push(appealCh);

    // New property reviews (guest → property) needing moderation
    const reviewCh = supabase
      .channel(`admin-reviews-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, () => {
        showNotification('New Property Review', 'A property review needs moderation.', '/admin');
      })
      .subscribe();
    channels.push(reviewCh);

    // New guest reviews (host → guest) needing moderation
    const guestReviewCh = supabase
      .channel(`admin-guest-reviews-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guest_reviews' }, () => {
        showNotification('New Guest Review', 'A guest review needs moderation.', '/admin');
      })
      .subscribe();

    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [user, isAdmin, showNotification]);

  return { requestPermission };
};
