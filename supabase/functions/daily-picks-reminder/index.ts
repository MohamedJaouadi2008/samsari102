// Daily Picks Reminder
// Triggered by pg_cron 12h, 5h, and 2h before midnight UTC+1.
// If no admin override is set for tomorrow, notify all admins (in-app + email).

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const hoursRemaining = Number(body?.hours_remaining ?? 0);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Compute "tomorrow" in Tunisia time (UTC+1).
    // Cron fires at 11:00, 18:00, 21:00 UTC — local time 12:00, 19:00, 22:00.
    // Tomorrow's date in local time = today UTC + 1 day (since local is +1, the date matches).
    const tunisiaNow = new Date(Date.now() + 60 * 60 * 1000);
    const tomorrow = new Date(tunisiaNow);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowDate = tomorrow.toISOString().slice(0, 10);

    console.log(`[daily-picks-reminder] hours=${hoursRemaining} tomorrow=${tomorrowDate}`);

    // Check if tomorrow already has an override
    const { data: existing, error: existingErr } = await supabase
      .from("admin_picks_override")
      .select("id, property_ids")
      .eq("pick_date", tomorrowDate)
      .maybeSingle();

    if (existingErr) {
      console.error("[daily-picks-reminder] override lookup failed:", existingErr);
    }

    const hasOverride =
      !!existing &&
      Array.isArray(existing.property_ids) &&
      existing.property_ids.length > 0;

    if (hasOverride) {
      console.log(`[daily-picks-reminder] override exists for ${tomorrowDate}, skipping`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, tomorrow: tomorrowDate }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all admins (admin_roles + user_roles where role = 'admin')
    const [adminRolesRes, userRolesRes] = await Promise.all([
      supabase.from("admin_roles").select("user_id, user_email"),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
    ]);

    const adminIds = new Set<string>();
    (adminRolesRes.data ?? []).forEach((r: any) => r.user_id && adminIds.add(r.user_id));
    (userRolesRes.data ?? []).forEach((r: any) => r.user_id && adminIds.add(r.user_id));

    if (adminIds.size === 0) {
      console.warn("[daily-picks-reminder] no admins found");
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ids = Array.from(adminIds);

    // Fetch admin emails from auth.users
    const { data: usersData } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const emailMap = new Map<string, string>();
    (usersData?.users ?? []).forEach((u) => {
      if (ids.includes(u.id) && u.email) emailMap.set(u.id, u.email);
    });

    const urgency =
      hoursRemaining <= 2 ? "🚨 Urgent" : hoursRemaining <= 5 ? "⚠️ Reminder" : "📅 Heads up";
    const title = `${urgency}: set Daily Picks for tomorrow`;
    const message = `No Daily Picks override set for ${tomorrowDate}. ${hoursRemaining}h remaining before auto-pick. Open the admin panel to choose properties.`;
    const link = "/admin?tab=picks";

    // Insert in-app notifications
    const notifications = ids.map((user_id) => ({
      user_id,
      type: "admin_pick_reminder",
      title,
      message,
      link,
      read: false,
    }));

    const { error: notifErr } = await supabase.from("notifications").insert(notifications);
    if (notifErr) {
      console.error("[daily-picks-reminder] notification insert failed:", notifErr);
    }

    // Send emails (best-effort, in parallel)
    const emailPromises = ids
      .filter((id) => emailMap.has(id))
      .map(async (id) => {
        try {
          await supabase.functions.invoke("send-notification-email", {
            body: {
              to: emailMap.get(id),
              subject: title,
              message,
              actionUrl: `https://samsari.tech${link}`,
              actionLabel: "Open Admin Panel",
            },
          });
        } catch (e) {
          console.warn(`[daily-picks-reminder] email to ${id} failed:`, e);
        }
      });
    await Promise.allSettled(emailPromises);

    console.log(`[daily-picks-reminder] notified ${ids.length} admins`);

    return new Response(
      JSON.stringify({
        success: true,
        notified: ids.length,
        emailed: emailMap.size,
        tomorrow: tomorrowDate,
        hours_remaining: hoursRemaining,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[daily-picks-reminder] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
