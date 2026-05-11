import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Criteria: avg rating >= 4.8, completed bookings >= 10
const MIN_RATING = 4.8;
const MIN_BOOKINGS = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Cron-only endpoint
    if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Get all hosts
    const { data: hosts } = await supabase
      .from("profiles")
      .select("id, is_superhost")
      .eq("is_host", true);

    if (!hosts) return new Response(JSON.stringify({ processed: 0 }), { headers: corsHeaders });

    let promoted = 0;
    let demoted = 0;

    for (const host of hosts) {
      const { data: properties } = await supabase
        .from("properties")
        .select("id")
        .eq("host_id", host.id);

      const propIds = (properties || []).map(p => p.id);
      if (propIds.length === 0) {
        if (host.is_superhost) {
          await supabase.from("profiles").update({ is_superhost: false }).eq("id", host.id);
          demoted++;
        }
        continue;
      }

      const { count: bookingCount } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("host_id", host.id)
        .in("status", ["settled", "checked_out", "settlement_pending"]);

      const { data: reviews } = await supabase
        .from("reviews")
        .select("rating")
        .in("property_id", propIds)
        .eq("status", "approved");

      const ratings = (reviews || []).map(r => Number(r.rating));
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      const qualifies = (bookingCount || 0) >= MIN_BOOKINGS && avgRating >= MIN_RATING;

      if (qualifies && !host.is_superhost) {
        await supabase.from("profiles").update({
          is_superhost: true,
          superhost_since: new Date().toISOString(),
        }).eq("id", host.id);
        promoted++;

        await supabase.from("notifications").insert({
          user_id: host.id,
          type: "superhost_awarded",
          title: "🏆 You're now a Superhost!",
          message: `Congratulations! With your ${avgRating.toFixed(1)}★ rating across ${bookingCount} stays, you've earned Superhost status.`,
          link: "/profile",
        });
      } else if (!qualifies && host.is_superhost) {
        await supabase.from("profiles").update({ is_superhost: false }).eq("id", host.id);
        demoted++;
      }
    }

    return new Response(
      JSON.stringify({ processed: hosts.length, promoted, demoted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("compute-superhost error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
