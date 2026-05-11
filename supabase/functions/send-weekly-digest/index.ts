import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    let guestEmails = 0;
    let hostEmails = 0;

    // GUEST DIGEST: users with saved searches → new properties this week
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: searches } = await supabase
      .from("saved_searches")
      .select("user_id, name, filters")
      .eq("alerts_enabled", true);

    const { data: newProps } = await supabase
      .from("properties")
      .select("id, title, city, governorate, price_per_night")
      .eq("status", "published")
      .eq("is_public", true)
      .gte("created_at", sevenDaysAgo)
      .limit(50);

    const userMatches = new Map<string, any[]>();
    for (const s of searches || []) {
      const filters: any = s.filters || {};
      const matches = (newProps || []).filter(p => {
        if (filters.governorate && p.governorate !== filters.governorate) return false;
        if (filters.city && p.city !== filters.city) return false;
        if (filters.maxPrice && Number(p.price_per_night) > Number(filters.maxPrice)) return false;
        return true;
      });
      if (matches.length === 0) continue;
      const arr = userMatches.get(s.user_id) || [];
      userMatches.set(s.user_id, [...arr, ...matches.slice(0, 3)]);
    }

    for (const [userId, matches] of userMatches.entries()) {
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      if (!user?.email) continue;
      const top = matches.slice(0, 5);
      const list = top.map(m => `• ${m.title} — ${m.city} — ${m.price_per_night} TND/night`).join("\n");
      await supabase.functions.invoke("send-notification-email", {
        body: {
          type: "weekly_digest_guest",
          recipientEmail: user.email,
          recipientName: "there",
          title: `${top.length} new ${top.length === 1 ? "stay" : "stays"} matching your searches`,
          message: `New properties on Samsari this week:\n\n${list}\n\nBrowse them now on samsari.tech`,
          link: "/search",
        },
      });
      guestEmails++;
    }

    // HOST DIGEST: weekly summary for hosts with bookings
    const { data: hosts } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_host", true);

    for (const host of hosts || []) {
      const { count: weekBookings } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("host_id", host.id)
        .gte("created_at", sevenDaysAgo);

      if (!weekBookings || weekBookings === 0) continue;

      const { data: { user } } = await supabase.auth.admin.getUserById(host.id);
      if (!user?.email) continue;

      await supabase.functions.invoke("send-notification-email", {
        body: {
          type: "weekly_digest_host",
          recipientEmail: user.email,
          recipientName: "Host",
          title: `Your week on Samsari: ${weekBookings} new ${weekBookings === 1 ? "booking" : "bookings"}`,
          message: `You received ${weekBookings} new booking ${weekBookings === 1 ? "request" : "requests"} this week. Log in to manage your reservations and keep your response rate high.`,
          link: "/profile?tab=requests",
        },
      });
      hostEmails++;
    }

    return new Response(
      JSON.stringify({ guestEmails, hostEmails }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("send-weekly-digest error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
