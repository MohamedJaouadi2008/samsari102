import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // We'll determine sandbox mode after parsing the body
    // For now, create supabase client first

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
      logStep("Unauthorized", { error: userError?.message });
      throw new Error("Unauthorized");
    }
    logStep("User authenticated", { userId: user.id });

    const { sessionId, bookingId, sandbox = false } = await req.json();
    logStep("Request body", { sessionId, bookingId, sandbox });

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

    if (!sessionId && !bookingId) {
      throw new Error("Session ID or Booking ID required");
    }

    let booking;
    let stripeSession;

    // If we have a session ID, retrieve the Stripe session first
    if (sessionId) {
      logStep("Retrieving Stripe session", { sessionId });
      stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
      logStep("Stripe session retrieved", { 
        status: stripeSession.payment_status,
        bookingId: stripeSession.metadata?.bookingId 
      });

      if (stripeSession.payment_status !== 'paid') {
        logStep("Payment not completed", { status: stripeSession.payment_status });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Payment not completed",
            status: stripeSession.payment_status 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      // Get booking ID from session metadata
      const metaBookingId = stripeSession.metadata?.bookingId;
      if (!metaBookingId) {
        throw new Error("Booking ID not found in session");
      }

      // Verify booking belongs to user
      const { data: bookingData, error: bookingError } = await supabaseClient
        .from("bookings")
        .select("id, status, payment_status, guest_id")
        .eq("id", metaBookingId)
        .eq("guest_id", user.id)
        .maybeSingle();

      if (bookingError || !bookingData) {
        logStep("Booking not found", { error: bookingError?.message });
        throw new Error("Booking not found");
      }

      booking = bookingData;
      logStep("Booking found", { 
        id: booking.id, 
        status: booking.status, 
        payment_status: booking.payment_status 
      });

    } else if (bookingId) {
      // Just verify using booking ID (for checking current status)
      const { data: bookingData, error: bookingError } = await supabaseClient
        .from("bookings")
        .select("id, status, payment_status, guest_id, stripe_payment_intent_id")
        .eq("id", bookingId)
        .eq("guest_id", user.id)
        .maybeSingle();

      if (bookingError || !bookingData) {
        throw new Error("Booking not found");
      }

      booking = bookingData;
      logStep("Booking found by ID", { 
        id: booking.id, 
        status: booking.status, 
        payment_status: booking.payment_status 
      });

      // If already paid, return success
      if (booking.payment_status === 'paid') {
        return new Response(
          JSON.stringify({ 
            success: true, 
            already_paid: true,
            booking: { id: booking.id, status: booking.status, payment_status: booking.payment_status }
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
    }

    // Update booking to deposit_paid if payment confirmed
    // Database has a status transition trigger that requires:
    // confirmed -> awaiting_payment -> deposit_paid
    if (stripeSession && stripeSession.payment_status === 'paid') {
      logStep("Updating booking - current status: " + booking.status);
      
      // If status is "confirmed", we need to transition through awaiting_payment first
      if (booking.status === 'confirmed') {
        logStep("Transitioning from confirmed to awaiting_payment first");
        const { error: awaitingError } = await supabaseClient
          .from("bookings")
          .update({ status: "awaiting_payment" })
          .eq("id", booking.id);
        
        if (awaitingError) {
          logStep("Error transitioning to awaiting_payment", { error: awaitingError.message });
          throw new Error("Failed to update booking status");
        }
        logStep("Transitioned to awaiting_payment");
      }
      
      // Now transition to deposit_paid with escrow status and full_payment_locked
      logStep("Updating booking to deposit_paid with escrow held and full payment locked");
      const { error: updateError } = await supabaseClient
        .from("bookings")
        .update({
          status: "deposit_paid",
          payment_status: "paid",
          stripe_payment_intent_id: stripeSession.payment_intent as string,
          escrow_status: "held",
          escrow_held_at: new Date().toISOString(),
          full_payment_locked: true,
          full_payment_locked_at: new Date().toISOString(),
        })
        .eq("id", booking.id);

      if (updateError) {
        logStep("Error updating booking", { error: updateError.message });
        throw new Error("Failed to update booking");
      }

      logStep("Booking updated successfully - deposit_paid, escrow held");

      return new Response(
        JSON.stringify({ 
          success: true, 
          booking: { 
            id: booking.id, 
            status: "deposit_paid", 
            payment_status: "paid" 
          }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Return current status
    return new Response(
      JSON.stringify({ 
        success: booking.payment_status === 'paid',
        booking: { 
          id: booking.id, 
          status: booking.status, 
          payment_status: booking.payment_status 
        }
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
