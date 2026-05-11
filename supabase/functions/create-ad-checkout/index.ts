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
    const { propertyId, days, sandbox, autoRenew } = await req.json();

    if (!propertyId) {
      throw new Error("Invalid parameters: propertyId is required");
    }

    // Minimum days check only applies if not auto-renewing daily
    const finalDays = autoRenew ? 1 : (days && days >= 1 ? days : 2);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: property, error: propertyError } = await supabaseClient
      .from("properties")
      .select("id, title, host_id")
      .eq("id", propertyId)
      .single();

    if (propertyError || !property) {
      throw new Error("Property not found");
    }

    if (property.host_id !== user.id) {
      throw new Error("Only the host can advertise this property");
    }

    const stripeKey = sandbox ? Deno.env.get("STRIPE_TEST_SECRET_KEY") : Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe configuration missing");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Ensure customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Calculate price (20 TND per day -> converted to USD approximate 0.32 rate)
    const amountTnd = finalDays * 20;
    const amountUsd = amountTnd * 0.32;
    const amountStripe = Math.round(amountUsd * 100);

    // Create promotion record
    const { data: promotion, error: promoError } = await supabaseClient
      .from("property_promotions")
      .insert({
        property_id: propertyId,
        host_id: user.id,
        days: finalDays,
        amount_tnd: amountTnd,
        sandbox: sandbox,
        status: "pending",
        auto_renew: autoRenew === true
      })
      .select()
      .single();

    if (promoError || !promotion) {
      throw new Error("Failed to create promotion record");
    }

    const origin = req.headers.get("origin") || "https://samsari.lovable.app";
    const successUrl = `${origin}/advertise/${propertyId}?success=true&session_id={CHECKOUT_SESSION_ID}&sandbox=${sandbox}`;
    const cancelUrl = `${origin}/advertise/${propertyId}?canceled=true`;

    const lineItem = autoRenew ? {
      price_data: {
        currency: "usd",
        product_data: {
          name: `Auto-renew Advertise Property: ${property.title}`,
          description: `Featured placement (Daily)`,
        },
        unit_amount: amountStripe,
        recurring: {
          interval: 'day' as const,
        }
      },
      quantity: 1,
    } : {
      price_data: {
        currency: "usd",
        product_data: {
          name: `Advertise Property: ${property.title}`,
          description: `Featured placement for ${finalDays} days`,
        },
        unit_amount: amountStripe,
      },
      quantity: 1,
    };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: ["card"],
      line_items: [lineItem],
      mode: autoRenew ? "subscription" : "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        promotion_id: promotion.id,
        property_id: propertyId,
        host_id: user.id,
        days: finalDays.toString(),
        auto_renew: autoRenew ? 'true' : 'false'
      },
    });

    await supabaseClient
      .from("property_promotions")
      .update({ stripe_session_id: session.id })
      .eq("id", promotion.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in create-ad-checkout:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
