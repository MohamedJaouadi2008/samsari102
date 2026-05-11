import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, sandbox } = await req.json();

    if (!sessionId) {
      throw new Error("Missing session ID");
    }

    // === A01 AUTHORIZATION GUARD ===
    // Verify the caller is authenticated; later we cross-check against the promotion's host_id.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = sandbox ? Deno.env.get("STRIPE_TEST_SECRET_KEY") : Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe configuration missing");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // For subscriptions, payment_status might be 'paid', or we might just check status
    if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
      throw new Error("Payment not completed");
    }

    const promotionId = session.metadata?.promotion_id;
    if (!promotionId) {
      throw new Error("No promotion ID in session metadata");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify caller identity
    const { data: callerData } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    const callerId = callerData?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: promotion, error: fetchError } = await supabaseAdmin
      .from("property_promotions")
      .select("*")
      .eq("id", promotionId)
      .single();

    if (fetchError || !promotion) {
      throw new Error("Promotion not found");
    }

    // Object-level check: caller must be the host who created this promotion (or admin)
    if (promotion.host_id !== callerId) {
      const { data: adminRole } = await supabaseAdmin
        .from("admin_roles")
        .select("id")
        .eq("user_id", callerId)
        .maybeSingle();
      if (!adminRole) {
        console.error("IDOR: user", callerId, "tried to verify promotion", promotionId, "owned by", promotion.host_id);
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (promotion.status === "active") {
      return new Response(JSON.stringify({ success: true, message: "Already active" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check for existing active promotion to extend it instead of overlapping
    const { data: existingPromotions } = await supabaseAdmin
      .from("property_promotions")
      .select("*")
      .eq("property_id", promotion.property_id)
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .order("ends_at", { ascending: false })
      .limit(1);

    const existingPromotion = existingPromotions?.[0];

    const startsAt = existingPromotion ? new Date(existingPromotion.ends_at) : new Date();
    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + promotion.days);

    const { error: updateError } = await supabaseAdmin
      .from("property_promotions")
      .update({
        status: "active",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        stripe_payment_intent_id: session.payment_intent as string,
        stripe_subscription_id: session.subscription as string,
      })
      .eq("id", promotionId);

    if (updateError) {
      throw new Error("Failed to activate promotion: " + updateError.message);
    }

    return new Response(JSON.stringify({ success: true, promotionId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in verify-ad-payment:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
