import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-CONNECT-ONBOARD] ${step}${detailsStr}`);
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
      logStep("Unauthorized", { error: userError?.message });
      throw new Error("Unauthorized");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { returnUrl } = await req.json();
    const origin = returnUrl || req.headers.get("origin") || "https://samsari.app";

    // Check if user already has a Stripe Connect account
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("stripe_account_id, stripe_account_status, is_host")
      .eq("id", user.id)
      .single();

    if (profileError) {
      logStep("Profile error", { error: profileError.message });
      throw new Error("Profile not found");
    }

    if (!profile.is_host) {
      throw new Error("Only hosts can connect to Stripe");
    }

    let accountId = profile.stripe_account_id;

    // Create new Stripe Connect account if doesn't exist
    if (!accountId) {
      logStep("Creating new Stripe Connect account");
      
      const account = await stripe.accounts.create({
        type: "express",
        country: "TN", // Tunisia
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          user_id: user.id,
        },
      });

      accountId = account.id;
      logStep("Stripe Connect account created", { accountId });

      // Save to profile
      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({
          stripe_account_id: accountId,
          stripe_account_status: "pending",
        })
        .eq("id", user.id);

      if (updateError) {
        logStep("Failed to update profile", { error: updateError.message });
        throw new Error("Failed to save Stripe account");
      }
    }

    // Create account link for onboarding
    logStep("Creating account link for onboarding");
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/profile?stripe=refresh`,
      return_url: `${origin}/profile?stripe=success`,
      type: "account_onboarding",
    });

    logStep("Account link created", { url: accountLink.url });

    return new Response(
      JSON.stringify({ 
        url: accountLink.url,
        accountId: accountId,
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
