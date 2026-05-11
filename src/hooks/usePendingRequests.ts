import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const usePendingRequests = () => {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setPendingCount(0);
      return;
    }

    fetchPendingCount();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("pending-requests-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `host_id=eq.${user.id}`,
        },
        () => {
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchPendingCount = async () => {
    if (!user) return;

    try {
      const { count, error } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("host_id", user.id)
        .eq("status", "pending");

      if (!error) {
        setPendingCount(count || 0);
      }
    } catch (error) {
      console.error("Error fetching pending count:", error);
    }
  };

  return { pendingCount, refetch: fetchPendingCount };
};
