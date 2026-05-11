import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Format YYYY-MM-DD as YYYYMMDD for ICS DATE values
const toIcsDate = (d: string) => d.replace(/-/g, "");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const property_id = url.searchParams.get("property_id");
  const token = url.searchParams.get("token");

  if (!property_id || !token) {
    return new Response("Missing property_id or token", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Validate token matches a feed for this property (any feed's token works as the property's export key)
  const { data: feed } = await supabase
    .from("property_calendar_feeds")
    .select("id")
    .eq("property_id", property_id)
    .eq("export_token", token)
    .maybeSingle();

  if (!feed) {
    return new Response("Invalid token", { status: 403 });
  }

  // Fetch confirmed bookings for this property
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, check_in_date, check_out_date, status")
    .eq("property_id", property_id)
    .in("status", [
      "confirmed",
      "deposit_paid",
      "awaiting_checkin",
      "awaiting_remaining_payment",
      "checked_in",
      "checked_out",
      "settlement_pending",
      "settled",
    ]);

  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Samsari//iCal Export//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const b of bookings ?? []) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:samsari-${b.id}@samsari.tech`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${toIcsDate(b.check_in_date)}`,
      `DTEND;VALUE=DATE:${toIcsDate(b.check_out_date)}`,
      `SUMMARY:Samsari Booking (Reserved)`,
      `STATUS:CONFIRMED`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="samsari-${property_id}.ics"`,
    },
  });
});
