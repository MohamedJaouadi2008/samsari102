import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTH_SEASONALITY: Record<number, number> = {
  1: 0.5, 2: 0.55, 3: 0.6, 4: 0.7, 5: 0.78, 6: 0.85,
  7: 0.95, 8: 0.97, 9: 0.82, 10: 0.7, 11: 0.55, 12: 0.65,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const property_id = typeof body?.property_id === "string" ? body.property_id : "";
    const horizon_days = Math.min(Math.max(parseInt(String(body?.horizon_days ?? 90), 10) || 90, 7), 365);
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(property_id)) {
      return new Response(JSON.stringify({ error: "property_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify ownership
    const { data: ownership } = await supabase
      .from("properties")
      .select("host_id")
      .eq("id", property_id)
      .single();
    if (!ownership || ownership.host_id !== user.id) {
      return new Response(JSON.stringify({ error: "Property not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    const horizonEnd = new Date(today);
    horizonEnd.setDate(horizonEnd.getDate() + horizon_days);
    const todayStr = today.toISOString().slice(0, 10);
    const horizonStr = horizonEnd.toISOString().slice(0, 10);

    // Confirmed/paid bookings in horizon
    const { data: bookings } = await supabase
      .from("bookings")
      .select("check_in_date, check_out_date, status, total_price")
      .eq("property_id", property_id)
      .lte("check_in_date", horizonStr)
      .gte("check_out_date", todayStr)
      .in("status", ["confirmed", "deposit_paid", "checked_in", "checked_out", "settlement_pending", "settled", "awaiting_remaining_payment", "awaiting_checkin"]);

    // External blocked dates (iCal imports)
    const { data: feeds } = await supabase
      .from("property_calendar_feeds")
      .select("id")
      .eq("property_id", property_id);
    const feedIds = (feeds || []).map((f) => f.id);
    let blocked: any[] = [];
    if (feedIds.length) {
      const { data } = await supabase
        .from("external_blocked_dates")
        .select("start_date, end_date")
        .in("feed_id", feedIds)
        .lte("start_date", horizonStr)
        .gte("end_date", todayStr);
      blocked = data || [];
    }

    // Mark each day in horizon
    const days: Array<{
      date: string;
      booked: boolean;
      blocked: boolean;
      forecast_probability: number;
      revenue: number;
    }> = [];

    const bookedDates = new Set<string>();
    const bookedRevByDate = new Map<string, number>();
    for (const b of bookings || []) {
      const start = new Date(b.check_in_date);
      const end = new Date(b.check_out_date);
      const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
      const perNight = Number(b.total_price || 0) / nights;
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const k = d.toISOString().slice(0, 10);
        bookedDates.add(k);
        bookedRevByDate.set(k, (bookedRevByDate.get(k) || 0) + perNight);
      }
    }
    const blockedDates = new Set<string>();
    for (const x of blocked) {
      const start = new Date(x.start_date);
      const end = new Date(x.end_date);
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        blockedDates.add(d.toISOString().slice(0, 10));
      }
    }

    let totalForecastNights = 0;
    let totalBookedNights = 0;
    let projectedRevenue = 0;

    const { data: prop } = await supabase
      .from("properties")
      .select("price_per_night")
      .eq("id", property_id)
      .single();
    const nightly = Number(prop?.price_per_night || 0);

    for (let i = 0; i < horizon_days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const k = d.toISOString().slice(0, 10);
      const isBooked = bookedDates.has(k);
      const isBlocked = blockedDates.has(k);
      const month = d.getMonth() + 1;
      const dow = d.getDay();
      const baseProb = MONTH_SEASONALITY[month] || 0.6;
      const weekendBoost = dow === 5 || dow === 6 ? 0.1 : 0;
      const prob = isBooked ? 1 : isBlocked ? 0 : Math.min(1, baseProb + weekendBoost);
      const rev = isBooked ? bookedRevByDate.get(k) || 0 : isBlocked ? 0 : nightly * prob;
      if (isBooked) totalBookedNights++;
      if (!isBlocked) totalForecastNights += prob;
      projectedRevenue += rev;
      days.push({
        date: k,
        booked: isBooked,
        blocked: isBlocked,
        forecast_probability: Math.round(prob * 100),
        revenue: Math.round(rev),
      });
    }

    return new Response(
      JSON.stringify({
        horizon_days,
        booked_nights: totalBookedNights,
        forecast_occupancy_pct: Math.round((totalForecastNights / horizon_days) * 100),
        projected_revenue: Math.round(projectedRevenue),
        nightly_rate: nightly,
        days,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("occupancy-forecast error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
