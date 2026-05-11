import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PAY-REMAINING] ${step}${detailsStr}`);
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

    const body = await req.json().catch(() => ({}));
    const bookingId = typeof body?.bookingId === "string" ? body.bookingId : "";
    const returnUrl = typeof body?.returnUrl === "string" ? body.returnUrl : "";
    const currency = typeof body?.currency === "string" ? body.currency : "usd";
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(bookingId) || !returnUrl) {
      throw new Error("Invalid request");
    }
    try {
      const u = new URL(returnUrl);
      if (u.protocol !== "https:" && u.hostname !== "localhost") throw new Error("bad protocol");
    } catch {
      throw new Error("Invalid returnUrl");
    }
    logStep("Request params", { bookingId, currency });

    // Validate currency - only USD and EUR supported for escrow
    const validCurrency = ['usd', 'eur'].includes(currency.toLowerCase()) ? currency.toLowerCase() : 'usd';

    // Get booking
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .select(`
        *,
        properties (title)
      `)
      .eq("id", bookingId)
      .eq("guest_id", user.id)
      .single();

    if (bookingError || !booking) {
      logStep("Booking not found", { error: bookingError?.message });
      throw new Error("Booking not found");
    }

    // STRICT STATE VALIDATION: Must be awaiting remaining payment
    if (booking.status !== 'awaiting_remaining_payment') {
      logStep("Invalid state for remaining payment", { currentStatus: booking.status });
      throw new Error(`Cannot pay remaining amount in status: ${booking.status}. Expected: awaiting_remaining_payment`);
    }

    // DUAL CONFIRMATION ENFORCEMENT: Both parties must confirm check-in
    if (!booking.host_check_in_confirmed_at) {
      throw new Error("Host must confirm check-in before remaining payment can be processed");
    }
    if (!booking.guest_check_in_confirmed_at) {
      throw new Error("Guest must confirm check-in before remaining payment can be processed");
    }

    // Prevent double payment
    if (booking.remaining_payment_status === 'paid' || booking.remaining_payment_paid_at) {
      throw new Error("Remaining payment has already been made");
    }

    // Prevent payment if there's a check-in dispute
    if (booking.check_in_issues_reported) {
      throw new Error("Cannot process payment while check-in issues are reported. Dispute must be resolved first.");
    }

    const remainingAmount = booking.remaining_payment_amount || (booking.total_price - (booking.deposit_amount || 0));
    const remainingAmountCents = Math.round(remainingAmount * 100);
    const propertyTitle = (booking.properties as any)?.title || 'Property';

    logStep("Creating payment session", { remainingAmount, remainingAmountCents });

    // Create checkout session for remaining 80%
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: validCurrency,
            product_data: {
              name: `Remaining Payment for ${propertyTitle}`,
              description: `80% remaining payment. Funds held in escrow until checkout.`,
            },
            unit_amount: remainingAmountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}&type=remaining`,
      cancel_url: `${returnUrl}?canceled=true`,
      metadata: {
        bookingId: bookingId,
        userId: user.id,
        hostId: booking.host_id,
        paymentType: "remaining",
      },
      payment_intent_data: {
        metadata: {
          bookingId: bookingId,
          hostId: booking.host_id,
          paymentType: "remaining",
        },
        transfer_group: `booking_${bookingId}`,
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

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
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});