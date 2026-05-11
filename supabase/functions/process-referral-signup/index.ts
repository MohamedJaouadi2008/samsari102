import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const referralCode = typeof body?.referralCode === "string" ? body.referralCode.trim() : "";
    if (!referralCode || !/^[A-Z0-9]{4,16}$/i.test(referralCode)) {
      return new Response(JSON.stringify({ error: "Missing code" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    // Find referrer by code
    const { data: refCode } = await supabase
      .from("referral_codes")
      .select("user_id, code")
      .eq("code", referralCode.toUpperCase())
      .maybeSingle();

    if (!refCode) return new Response(JSON.stringify({ error: "Invalid code" }), { status: 404, headers: corsHeaders });
    if (refCode.user_id === user.id) {
      return new Response(JSON.stringify({ error: "Cannot use your own code" }), { status: 400, headers: corsHeaders });
    }

    // Check if already referred
    const { data: existing } = await supabase
      .from("referrals")
      .select("id")
      .eq("referred_id", user.id)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: "Already used a referral" }), { status: 400, headers: corsHeaders });
    }

    await supabase.from("referrals").insert({
      referrer_id: refCode.user_id,
      referred_id: user.id,
      referral_code: refCode.code,
      status: "pending",
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("process-referral-signup error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
