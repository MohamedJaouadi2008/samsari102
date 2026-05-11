import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-CONNECT-STATUS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }
    logStep("User authenticated", { userId: user.id });

    // Get user's Stripe account ID
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("stripe_account_id, stripe_account_status, stripe_onboarding_complete")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    if (!profile.stripe_account_id) {
      logStep("No Stripe account connected");
      return new Response(
        JSON.stringify({ 
          connected: false,
          status: "not_connected",
          onboardingComplete: false,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Retrieve account from Stripe to get current status
    logStep("Retrieving Stripe account", { accountId: profile.stripe_account_id });
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    const chargesEnabled = account.charges_enabled;
    const payoutsEnabled = account.payouts_enabled;
    const detailsSubmitted = account.details_submitted;

    let status = "pending";
    if (chargesEnabled && payoutsEnabled) {
      status = "active";
    } else if (detailsSubmitted) {
      status = "pending_verification";
    }

    const onboardingComplete = chargesEnabled && payoutsEnabled && detailsSubmitted;

    // Update profile with latest status
    if (profile.stripe_account_status !== status || profile.stripe_onboarding_complete !== onboardingComplete) {
      await supabaseClient
        .from("profiles")
        .update({
          stripe_account_status: status,
          stripe_onboarding_complete: onboardingComplete,
        })
        .eq("id", user.id);
      logStep("Updated profile status", { status, onboardingComplete });
    }

    logStep("Account status retrieved", { 
      chargesEnabled, 
      payoutsEnabled, 
      detailsSubmitted,
      status,
      onboardingComplete 
    });

    return new Response(
      JSON.stringify({ 
        connected: true,
        accountId: profile.stripe_account_id,
        status,
        onboardingComplete,
        chargesEnabled,
        payoutsEnabled,
        detailsSubmitted,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
