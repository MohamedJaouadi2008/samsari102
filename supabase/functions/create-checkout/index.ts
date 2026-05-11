import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const body = await req.json().catch(() => ({}));
    const bookingId = typeof body?.bookingId === "string" ? body.bookingId : "";
    const amount = Number(body?.amount);
    const propertyTitle = typeof body?.propertyTitle === "string" ? body.propertyTitle.slice(0, 200) : "";
    const returnUrl = typeof body?.returnUrl === "string" ? body.returnUrl : "";
    const currency = typeof body?.currency === "string" ? body.currency : "usd";
    const sandbox = body?.sandbox === true;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(bookingId) || !Number.isFinite(amount) || amount <= 0 || amount > 100_000_00 || !propertyTitle || !returnUrl) {
      throw new Error("Invalid request");
    }
    try {
      const u = new URL(returnUrl);
      if (u.protocol !== "https:" && u.hostname !== "localhost") throw new Error("bad protocol");
    } catch {
      throw new Error("Invalid returnUrl");
    }
    logStep("Request params", { bookingId, amount, propertyTitle, currency, sandbox });

    // Use test key for sandbox mode, live key for production
    const stripeKey = sandbox 
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY") 
      : Deno.env.get("STRIPE_SECRET_KEY");
    
    if (!stripeKey) {
      throw new Error(sandbox ? "STRIPE_TEST_SECRET_KEY is not configured" : "STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    // Use service role key to bypass RLS for booking verification
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
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Create or find Stripe customer for future off-session charges
    let stripeCustomerId: string | undefined;
    try {
      const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: { supabase_user_id: user.id },
        });
        stripeCustomerId = customer.id;
      }
      logStep("Stripe customer", { customerId: stripeCustomerId });
    } catch (custError) {
      logStep("Customer creation failed - continuing without", { error: (custError as Error).message });
    }

    // Body already parsed above

    if (!bookingId || !amount || !propertyTitle || !returnUrl) {
      throw new Error("Missing required fields");
    }

    // ESCROW ONLY SUPPORTS USD AND EUR - TND is NOT linked to Stripe
    // Validate currency - only USD and EUR are supported for escrow payments
    const validCurrency = ['usd', 'eur'].includes(currency.toLowerCase()) ? currency.toLowerCase() : 'usd';
    
    if (currency.toLowerCase() === 'tnd') {
      logStep("TND currency rejected - escrow only supports USD/EUR");
      throw new Error("Escrow payments only support USD and EUR. Please use USD or EUR for payment.");
    }
    // Verify booking belongs to user and get host info
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .select("id, status, payment_status, guest_id, host_id, deposit_amount")
      .eq("id", bookingId)
      .eq("guest_id", user.id)
      .maybeSingle();

    if (bookingError || !booking) {
      logStep("Booking not found", { error: bookingError?.message });
      throw new Error("Booking not found");
    }

    if (booking.payment_status === "paid") {
      throw new Error("Already paid");
    }

    logStep("Booking found", { 
      id: booking.id, 
      hostId: booking.host_id,
      depositAmount: booking.deposit_amount 
    });

    // Get host's Stripe Connect account
    const { data: hostProfile, error: hostError } = await supabaseClient
      .from("profiles")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("id", booking.host_id)
      .single();

    if (hostError) {
      logStep("Host profile error", { error: hostError.message });
    }

    // Get dynamic platform fee rate from database
    const { data: feeRateData } = await supabaseClient
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_fee_rate')
      .single();
    
    const platformFeeRate = feeRateData?.value ? parseFloat(feeRateData.value) : 0.09; // Default 9%
    
    // Calculate platform fee using dynamic rate
    const depositAmountCents = Math.round(amount);
    const platformFee = Math.round(depositAmountCents * platformFeeRate);

    logStep("Fee calculation", { 
      depositAmountCents, 
      platformFee,
      hostHasStripe: !!hostProfile?.stripe_account_id,
      hostOnboardingComplete: hostProfile?.stripe_onboarding_complete
    });

    // Build checkout session options
    const sessionOptions: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: validCurrency,
            product_data: {
              name: `Payment for ${propertyTitle}`,
              description: `Full payment + 5% service fee. Funds held in escrow until check-out.`,
            },
            unit_amount: depositAmountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}${sandbox ? '&sandbox=true' : ''}`,
      cancel_url: `${returnUrl}?canceled=true`,
      metadata: {
        bookingId: bookingId,
        userId: user.id,
        hostId: booking.host_id,
        paymentType: "deposit",
      },
      // Hold funds in platform account (escrow)
      payment_intent_data: {
        metadata: {
          bookingId: bookingId,
          hostId: booking.host_id,
          paymentType: "deposit",
        },
        // We'll transfer to host later via release-escrow function
        transfer_group: `booking_${bookingId}`,
        // Save the card for future off-session charges (e.g. damage claims)
        setup_future_usage: "off_session",
      },
    };

    // If host has a connected Stripe account, we can set up the future transfer
    // But funds stay in platform account until released
    if (hostProfile?.stripe_account_id && hostProfile?.stripe_onboarding_complete) {
      logStep("Host has Stripe Connect - funds will be held for escrow transfer");
      // Store host's account ID for later transfer
      await supabaseClient
        .from("bookings")
        .update({ host_stripe_account_id: hostProfile.stripe_account_id })
        .eq("id", bookingId);
    } else {
      logStep("Host does not have Stripe Connect yet - funds held in platform escrow");
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create(sessionOptions);

    logStep("Checkout session created", { 
      sessionId: session.id, 
      url: session.url 
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage.startsWith("Invalid") || errorMessage === "Unauthorized" || errorMessage === "Booking not found" || errorMessage === "Already paid" ? errorMessage : "Checkout failed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
