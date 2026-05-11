import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * SMART TRIP REMINDERS CRON
 *
 * Runs every 30 minutes. For each guest booking, sends:
 *  - pre_checkin reminder (~48h before check-in)
 *  - arrival_day reminder (morning of check-in)
 *  - pre_checkout reminder (~2h before check-out time)
 *  - review_nudge (24h after actual check-out)
 *
 * Each reminder is sent at most once per booking (tracked via reminder_*_sent_at columns).
 * Creates an in-app notification + queues a transactional email via send-notification-email.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: any) => {
  console.log(`[TRIP-REMINDERS] ${step}${details ? " - " + JSON.stringify(details) : ""}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 3600 * 1000);
    const in44h = new Date(now.getTime() + 44 * 3600 * 1000); // 4h tolerance window
    const in2h = new Date(now.getTime() + 2 * 3600 * 1000);
    const past24h = new Date(now.getTime() - 24 * 3600 * 1000);
    const past20h = new Date(now.getTime() - 20 * 3600 * 1000);

    let stats = { pre_checkin: 0, arrival_day: 0, pre_checkout: 0, review_nudge: 0 };

    // ── 1. PRE-CHECK-IN: 48h before check-in date (paid bookings only)
    {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, guest_id, host_id, property_id, check_in_date, properties(title, city, check_in_time)")
        .in("status", ["deposit_paid", "awaiting_checkin", "awaiting_remaining_payment", "payment_held", "payment_authorized"])
        .gte("check_in_date", in44h.toISOString().slice(0, 10))
        .lte("check_in_date", in48h.toISOString().slice(0, 10))
        .is("reminder_pre_checkin_sent_at", null);

      for (const b of bookings || []) {
        await dispatchReminder(supabase, supabaseUrl, serviceKey, {
          booking_id: b.id,
          user_id: b.guest_id,
          type: "trip_pre_checkin",
          title: "Your trip is in 2 days",
          message: `Check-in for ${(b.properties as any)?.title || "your stay"} is in 48 hours. Tap to view your itinerary.`,
          property_title: (b.properties as any)?.title,
          column: "reminder_pre_checkin_sent_at",
        });
        stats.pre_checkin++;
      }
    }

    // ── 2. ARRIVAL DAY: morning of check-in
    {
      const todayStr = now.toISOString().slice(0, 10);
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, guest_id, check_in_date, properties(title, city, address, check_in_time)")
        .in("status", ["deposit_paid", "awaiting_checkin", "awaiting_remaining_payment", "payment_held", "payment_authorized"])
        .eq("check_in_date", todayStr)
        .is("reminder_arrival_day_sent_at", null);

      for (const b of bookings || []) {
        const time = (b.properties as any)?.check_in_time?.slice(0, 5) || "your scheduled time";
        await dispatchReminder(supabase, supabaseUrl, serviceKey, {
          booking_id: b.id,
          user_id: b.guest_id,
          type: "trip_arrival_day",
          title: "Welcome — check-in today",
          message: `You can check into ${(b.properties as any)?.title || "your stay"} from ${time}. Your arrival kit is ready in your itinerary.`,
          property_title: (b.properties as any)?.title,
          column: "reminder_arrival_day_sent_at",
        });
        stats.arrival_day++;
      }
    }

    // ── 3. PRE-CHECKOUT: ~2h before checkout time on checkout day
    {
      const todayStr = now.toISOString().slice(0, 10);
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, guest_id, check_out_date, properties(title, check_out_time)")
        .in("status", ["checked_in"])
        .eq("check_out_date", todayStr)
        .is("reminder_pre_checkout_sent_at", null);

      for (const b of bookings || []) {
        // Only fire if within 4h of checkout time
        const t = (b.properties as any)?.check_out_time;
        if (t) {
          const [hh, mm] = t.split(":").map(Number);
          const checkoutMoment = new Date(now);
          checkoutMoment.setHours(hh, mm, 0, 0);
          const hoursAway = (checkoutMoment.getTime() - now.getTime()) / 3600000;
          if (hoursAway > 4 || hoursAway < -1) continue;
        }
        await dispatchReminder(supabase, supabaseUrl, serviceKey, {
          booking_id: b.id,
          user_id: b.guest_id,
          type: "trip_pre_checkout",
          title: "Check-out reminder",
          message: `Check-out at ${(b.properties as any)?.title || "your stay"} is coming up. Please confirm check-out in the app once you leave.`,
          property_title: (b.properties as any)?.title,
          column: "reminder_pre_checkout_sent_at",
        });
        stats.pre_checkout++;
      }
    }

    // ── 4. REVIEW NUDGE: 24h after actual checkout
    {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, guest_id, actual_check_out, properties(title)")
        .in("status", ["checked_out", "settlement_pending", "dispute_window", "settled"])
        .not("actual_check_out", "is", null)
        .lte("actual_check_out", past24h.toISOString())
        .gte("actual_check_out", past20h.toISOString())
        .is("reminder_review_nudge_sent_at", null);

      for (const b of bookings || []) {
        // Skip if a review already exists
        const { data: existing } = await supabase.from("reviews").select("id").eq("booking_id", b.id).maybeSingle();
        if (existing) {
          await supabase.from("bookings").update({ reminder_review_nudge_sent_at: now.toISOString() }).eq("id", b.id);
          continue;
        }
        await dispatchReminder(supabase, supabaseUrl, serviceKey, {
          booking_id: b.id,
          user_id: b.guest_id,
          type: "trip_review_nudge",
          title: "How was your stay?",
          message: `Tell us about ${(b.properties as any)?.title || "your stay"} — your review helps the community.`,
          property_title: (b.properties as any)?.title,
          column: "reminder_review_nudge_sent_at",
        });
        stats.review_nudge++;
      }
    }

    log("done", stats);
    return new Response(JSON.stringify({ ok: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    log("error", e.message);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function dispatchReminder(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  args: {
    booking_id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    property_title?: string;
    column: string;
  }
) {
  // 1. In-app notification (will trigger email via DB trigger)
  await supabase.from("notifications").insert({
    user_id: args.user_id,
    type: args.type,
    title: args.title,
    message: args.message,
    booking_id: args.booking_id,
    link: "/profile?tab=reservations",
  });

  // 2. Mark as sent
  await supabase.from("bookings").update({ [args.column]: new Date().toISOString() }).eq("id", args.booking_id);

  log("sent", { booking_id: args.booking_id, type: args.type });
}
