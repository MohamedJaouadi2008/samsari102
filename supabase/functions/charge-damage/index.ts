import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHARGE-DAMAGE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check admin role
    const { data: adminRole } = await supabaseClient
      .from("admin_roles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminRole) {
      throw new Error("Admin access required");
    }

    const body = await req.json().catch(() => ({}));
    const bookingId = typeof body?.bookingId === "string" ? body.bookingId : "";
    const amount = Number(body?.amount);
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    const currency = typeof body?.currency === "string" ? body.currency : "usd";
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(bookingId) || !Number.isFinite(amount) || amount <= 0 || amount > 50_000 || !reason || reason.length < 10) {
      throw new Error("Invalid request");
    }
    logStep("Request params", { bookingId, amount, reason, currency });

    // Get booking with stripe info
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .select("id, guest_id, host_id, stripe_payment_intent_id, stripe_customer_id, status, escrow_currency")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found");
    }

    logStep("Booking found", { 
      id: booking.id, 
      hasCustomerId: !!booking.stripe_customer_id,
      hasPaymentIntent: !!booking.stripe_payment_intent_id
    });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Strategy 1: Use stored customer ID
    // Strategy 2: Look up customer from original payment intent
    let customerId = booking.stripe_customer_id;
    let paymentMethodId: string | null = null;

    if (!customerId && booking.stripe_payment_intent_id) {
      logStep("Looking up customer from payment intent");
      try {
        const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
        if (pi.customer) {
          customerId = typeof pi.customer === 'string' ? pi.customer : pi.customer.id;
        }
        if (pi.payment_method) {
          paymentMethodId = typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method.id;
        }
      } catch (e) {
        logStep("Failed to retrieve payment intent", { error: (e as Error).message });
      }
    }

    if (!customerId) {
      throw new Error("No saved payment method found for this guest. The guest must pay manually.");
    }

    // If we don't have a specific payment method, get the customer's default
    if (!paymentMethodId) {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
        limit: 1,
      });

      if (paymentMethods.data.length === 0) {
        throw new Error("No saved card found for this guest. The guest must pay manually.");
      }

      paymentMethodId = paymentMethods.data[0].id;
    }

    logStep("Charging saved card", { customerId, paymentMethodId, amount });

    const chargeCurrency = ['usd', 'eur'].includes(currency.toLowerCase()) ? currency.toLowerCase() : (booking.escrow_currency || 'usd');
    const amountInCents = Math.round(amount * 100);

    // Create off-session payment intent
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: chargeCurrency,
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          booking_id: bookingId,
          type: "damage_charge",
          reason: reason,
          charged_by: user.id,
        },
        description: `Damage charge for booking ${bookingId}: ${reason}`,
      }, {
        idempotencyKey: `damage_charge_${bookingId}_${Date.now()}`,
      });

      logStep("Payment intent created", { 
        id: paymentIntent.id, 
        status: paymentIntent.status 
      });
    } catch (stripeError: any) {
      // Handle 3DS / authentication_required
      if (stripeError.code === 'authentication_required') {
        logStep("Card requires authentication - cannot charge off-session");
        
        // Notify guest they need to pay manually
        await supabaseClient.from("notifications").insert({
          user_id: booking.guest_id,
          type: 'damage_charge_manual',
          title: 'Damage Payment Required',
          message: `A damage charge of ${amount} ${chargeCurrency.toUpperCase()} has been assessed for your booking. Your card requires authentication - please complete payment manually.`,
          booking_id: bookingId,
          link: '/profile?tab=reservations'
        });

        throw new Error("Card requires 3D Secure authentication. Guest has been notified to pay manually.");
      }
      throw stripeError;
    }

    if (paymentIntent.status !== 'succeeded') {
      // Notify guest about failed charge
      await supabaseClient.from("notifications").insert({
        user_id: booking.guest_id,
        type: 'damage_charge_failed',
        title: 'Damage Payment Failed',
        message: `An automatic damage charge of ${amount} ${chargeCurrency.toUpperCase()} could not be processed. Please update your payment method.`,
        booking_id: bookingId,
        link: '/profile?tab=reservations'
      });

      throw new Error(`Payment failed with status: ${paymentIntent.status}. Guest notified.`);
    }

    // Success - notify both parties
    const guestNotification = supabaseClient.from("notifications").insert({
      user_id: booking.guest_id,
      type: 'damage_charged',
      title: 'Damage Charge Applied',
      message: `A damage charge of ${amount} ${chargeCurrency.toUpperCase()} has been applied to your card. Reason: ${reason}`,
      booking_id: bookingId,
      link: '/profile?tab=reservations'
    });

    const hostNotification = supabaseClient.from("notifications").insert({
      user_id: booking.host_id,
      type: 'damage_charge_collected',
      title: 'Damage Payment Collected',
      message: `A damage charge of ${amount} ${chargeCurrency.toUpperCase()} has been collected from the guest. Reason: ${reason}`,
      booking_id: bookingId,
      link: '/profile?tab=requests'
    });

    // Log to escrow audit
    const auditLog = supabaseClient.from("escrow_audit_log").insert({
      booking_id: bookingId,
      action_type: 'damage_charge',
      action_reason: reason,
      triggered_by: 'admin',
      triggered_by_user_id: user.id,
      amount_affected: amountInCents,
      metadata: {
        stripe_payment_intent_id: paymentIntent.id,
        currency: chargeCurrency,
        customer_id: customerId,
      }
    });

    await Promise.all([guestNotification, hostNotification, auditLog]);

    logStep("Damage charge completed successfully", { 
      paymentIntentId: paymentIntent.id,
      amount,
      currency: chargeCurrency
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        paymentIntentId: paymentIntent.id,
        amount,
        currency: chargeCurrency,
        message: `Successfully charged ${amount} ${chargeCurrency.toUpperCase()} for damage`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    const safe = ["Unauthorized", "Admin access required", "Invalid request", "Booking not found"].includes(errorMessage)
      ? errorMessage
      : "Charge failed";
    return new Response(
      JSON.stringify({ error: safe }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
