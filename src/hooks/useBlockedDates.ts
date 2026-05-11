import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useBlockedDates = (propertyId: string) => {
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (propertyId) {
      fetchBlockedDates();
    }
  }, [propertyId]);

  const fetchBlockedDates = async () => {
    try {
      // Get all bookings that block dates (not cancelled/declined)
      const { data, error } = await supabase
        .from("bookings")
        .select("check_in_date, check_out_date, status")
        .eq("property_id", propertyId)
        .not("status", "in", '("cancelled_by_guest","cancelled_by_host","declined","refunded")');

      if (error) throw error;

      // Also fetch externally-imported blocked dates (Airbnb/Booking iCal sync)
      const { data: externalDates } = await supabase
        .from("external_blocked_dates")
        .select("start_date, end_date")
        .eq("property_id", propertyId);

      const dates: Date[] = [];

      data?.forEach((booking) => {
        if (
          ["pending", "confirmed", "awaiting_payment", "deposit_paid", "payment_authorized",
           "payment_held", "awaiting_checkin", "awaiting_remaining_payment", "checked_in"].includes(booking.status || "")
        ) {
          const start = new Date(booking.check_in_date);
          const end = new Date(booking.check_out_date);
          const current = new Date(start);
          while (current <= end) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
          }
        }
      });

      externalDates?.forEach((ext) => {
        const start = new Date(ext.start_date);
        const end = new Date(ext.end_date);
        const current = new Date(start);
        while (current <= end) {
          dates.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }
      });

      setBlockedDates(dates);
    } catch (error) {
      console.error("Error fetching blocked dates:", error);
    } finally {
      setLoading(false);
    }
  };

  const isDateBlocked = (date: Date): boolean => {
    return blockedDates.some(
      (blockedDate) =>
        blockedDate.getFullYear() === date.getFullYear() &&
        blockedDate.getMonth() === date.getMonth() &&
        blockedDate.getDate() === date.getDate()
    );
  };

  return { blockedDates, isDateBlocked, loading, refetch: fetchBlockedDates };
};
