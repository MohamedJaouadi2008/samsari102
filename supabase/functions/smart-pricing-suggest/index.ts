import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Seasonal multipliers for Tunisia (1.0 = baseline)
const MONTH_SEASONALITY: Record<number, number> = {
  1: 0.85, 2: 0.85, 3: 0.9, 4: 1.0, 5: 1.1, 6: 1.25,
  7: 1.45, 8: 1.5, 9: 1.2, 10: 1.0, 11: 0.9, 12: 1.05,
};

const DOW_MULTIPLIER: Record<number, number> = {
  0: 1.0, 1: 0.95, 2: 0.95, 3: 0.97, 4: 1.05, 5: 1.18, 6: 1.18,
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

    const { data: property, error: propErr } = await supabase
      .from("properties")
      .select("id, title, host_id, governorate, city, property_type, bedrooms, bathrooms, max_guests, price_per_night, amenities")
      .eq("id", property_id)
      .eq("host_id", user.id)
      .single();

    if (propErr || !property) {
      return new Response(JSON.stringify({ error: "Property not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Local comps: same governorate, similar bedroom count, listed/published
    const { data: comps } = await supabase
      .from("properties")
      .select("price_per_night, bedrooms, property_type")
      .eq("governorate", property.governorate)
      .eq("status", "published")
      .eq("is_public", true)
      .neq("id", property_id)
      .limit(200);

    const sameTypeComps = (comps || []).filter(
      (c) => Math.abs((c.bedrooms || 0) - (property.bedrooms || 0)) <= 1
    );
    const compPool = sameTypeComps.length >= 5 ? sameTypeComps : comps || [];

    const prices = compPool.map((c) => Number(c.price_per_night)).filter((n) => n > 0).sort((a, b) => a - b);
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : Number(property.price_per_night);
    const p25 = prices.length ? prices[Math.floor(prices.length * 0.25)] : median * 0.85;
    const p75 = prices.length ? prices[Math.floor(prices.length * 0.75)] : median * 1.15;

    // Occupancy over last 90 days
    const ninetyAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: recentBookings } = await supabase
      .from("bookings")
      .select("check_in_date, check_out_date, status")
      .eq("property_id", property_id)
      .gte("check_in_date", ninetyAgo)
      .in("status", ["confirmed", "deposit_paid", "checked_in", "checked_out", "settlement_pending", "settled"]);

    const bookedNights = (recentBookings || []).reduce((sum, b) => {
      const start = new Date(b.check_in_date);
      const end = new Date(b.check_out_date);
      return sum + Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
    }, 0);
    const occupancy90 = Math.min(1, bookedNights / 90);

    // Demand multiplier from occupancy
    let demandMult = 1.0;
    if (occupancy90 > 0.75) demandMult = 1.12;
    else if (occupancy90 > 0.5) demandMult = 1.05;
    else if (occupancy90 < 0.2) demandMult = 0.92;

    // Build a 14-day suggestion calendar
    const today = new Date();
    const calendar: Array<{ date: string; suggested: number; baseline: number; reason: string }> = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const month = d.getMonth() + 1;
      const dow = d.getDay();
      const seasonal = MONTH_SEASONALITY[month] || 1;
      const weekend = DOW_MULTIPLIER[dow] || 1;
      const suggested = Math.round(median * seasonal * weekend * demandMult);
      calendar.push({
        date: d.toISOString().slice(0, 10),
        suggested,
        baseline: Math.round(Number(property.price_per_night)),
        reason: weekend > 1.1 ? "weekend_premium" : seasonal > 1.2 ? "high_season" : seasonal < 0.95 ? "low_season" : "standard",
      });
    }

    const avgSuggested = Math.round(calendar.reduce((s, c) => s + c.suggested, 0) / calendar.length);
    const currentPrice = Number(property.price_per_night);
    const deltaPct = currentPrice ? Math.round(((avgSuggested - currentPrice) / currentPrice) * 100) : 0;

    return new Response(
      JSON.stringify({
        property: { id: property.id, title: property.title, current_price: currentPrice },
        market: {
          comp_count: compPool.length,
          median_price: Math.round(median),
          p25_price: Math.round(p25),
          p75_price: Math.round(p75),
        },
        demand: {
          occupancy_90d: Math.round(occupancy90 * 100),
          booked_nights: bookedNights,
          demand_multiplier: demandMult,
        },
        suggestion: {
          avg_suggested_price: avgSuggested,
          delta_vs_current_pct: deltaPct,
          calendar,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("smart-pricing-suggest error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
