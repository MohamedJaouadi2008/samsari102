import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * ADMIN TRIGGER CRON PROXY
 * 
 * Allows authenticated admins to manually trigger the escrow-deadline-cron
 * without exposing the CRON_SECRET to the frontend.
 * 
 * Authentication: Requires JWT and admin role
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the user is authenticated and is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Check if user is an admin using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: adminRole } = await supabaseAdmin
      .from("admin_roles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden - admin access required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Trigger the escrow-deadline-cron
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!cronSecret) {
      return new Response(
        JSON.stringify({ error: "CRON_SECRET not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`[ADMIN-TRIGGER-CRON] Admin ${user.email} triggering escrow-deadline-cron`);

    const cronResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/escrow-deadline-cron`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Cron-Secret": cronSecret,
        },
      }
    );

    const cronResult = await cronResponse.json();

    console.log(`[ADMIN-TRIGGER-CRON] Cron response:`, cronResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Escrow deadline cron triggered successfully",
        triggered_by: user.email,
        cron_response: cronResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[ADMIN-TRIGGER-CRON] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
