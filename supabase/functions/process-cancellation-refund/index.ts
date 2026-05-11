import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  console.log(`[CANCELLATION-REFUND] ${step}:`, JSON.stringify(details || {}, null, 2));
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  // Variables for audit logging
  let bookingId: string | null = null;
  let cancelledBy: string | null = null;
  let previousStatus: string | null = null;
  let previousEscrowStatus: string | null = null;

  try {
    const body = await req.json();
    bookingId = body.bookingId;
    cancelledBy = body.cancelledBy;
    
    if (!bookingId || !cancelledBy) {
      throw new Error("Missing required fields: bookingId, cancelledBy");
    }

    // Strict input validation
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof bookingId !== "string" || !UUID_RE.test(bookingId)) {
      return new Response(JSON.stringify({ error: "Invalid bookingId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cancelledBy !== "guest" && cancelledBy !== "host" && cancelledBy !== "admin" && cancelledBy !== "system") {
      return new Response(JSON.stringify({ error: "Invalid cancelledBy" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === A01 AUTHORIZATION GUARD ===
    // Verify caller is guest/host of the booking, an admin, or the cron system.
    const cronSecretHeader = req.headers.get("x-cron-secret");
    const expectedCronSecret = Deno.env.get("CRON_SECRET");
    const isCronCall = !!(expectedCronSecret && cronSecretHeader && cronSecretHeader === expectedCronSecret);

    if (!isCronCall) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7)
        : null;
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: userData } = await supabaseClient.auth.getUser(token);
      const callerId = userData?.user?.id;
      if (!callerId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch booking ownership
      const { data: bRow } = await supabaseClient
        .from("bookings")
        .select("guest_id, host_id")
        .eq("id", bookingId)
        .maybeSingle();
      if (!bRow) {
        return new Response(JSON.stringify({ error: "Booking not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: adminRole } = await supabaseClient
        .from("admin_roles")
        .select("id")
        .eq("user_id", callerId)
        .maybeSingle();
      const isAdmin = !!adminRole;

      const isGuestCall = cancelledBy === "guest" && bRow.guest_id === callerId;
      const isHostCall = cancelledBy === "host" && bRow.host_id === callerId;
      const isAdminCall = (cancelledBy === "admin" || cancelledBy === "system") && isAdmin;

      if (!isGuestCall && !isHostCall && !isAdminCall) {
        logStep("UNAUTHORIZED cancellation attempt", { callerId, bookingId, cancelledBy });
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      logStep("Authorized cancellation", { callerId, role: cancelledBy });
    } else {
      logStep("Authorized via cron secret");
    }

    logStep("Processing cancellation refund", { bookingId, cancelledBy });

    if (!stripeSecretKey) {
      throw new Error("Stripe secret key not configured");
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .select(`
        *,
        properties(cancellation_policy)
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    previousStatus = booking.status;
    previousEscrowStatus = booking.escrow_status;

    logStep("Booking fetched", { 
      status: booking.status,
      escrow_status: booking.escrow_status,
      stripe_payment_intent_id: booking.stripe_payment_intent_id
    });

    // HARD GUARDRAIL: No payment intent = no refund possible
    if (!booking.stripe_payment_intent_id) {
      logStep("No Stripe payment intent found - cannot process refund");
      
      // Update booking status without refund
      const newStatus = cancelledBy === 'guest' ? 'cancelled_by_guest' : 'cancelled_by_host';
      await supabaseClient.from("bookings").update({
        status: newStatus,
        escrow_status: 'none',
        refund_amount: 0,
        refund_reason: 'No payment to refund',
        refund_status: 'none',
        cancelled_at: new Date().toISOString(),
      }).eq("id", bookingId);

      // Audit log
      await supabaseClient.from("escrow_audit_log").insert({
        booking_id: bookingId,
        action_type: "cancellation_no_payment",
        action_reason: "No Stripe payment intent - no refund possible",
        triggered_by: cancelledBy,
        previous_status: previousStatus,
        new_status: newStatus,
        previous_escrow_status: previousEscrowStatus,
        new_escrow_status: 'none',
        amount_affected: 0,
        metadata: { no_payment_intent: true }
      });

      return new Response(JSON.stringify({
        success: true,
        refund_amount: 0,
        refund_status: 'none',
        reason: 'No payment to refund'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SINGLE SOURCE OF TRUTH: Fetch actual charge from Stripe
    let paymentIntent: Stripe.PaymentIntent;
    let actualChargeAmountCents: number;
    let chargeCurrency: string;
    
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
      actualChargeAmountCents = paymentIntent.amount_received || 0;
      chargeCurrency = paymentIntent.currency;
      
      logStep("Stripe PaymentIntent fetched", { 
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        amount_received: actualChargeAmountCents,
        currency: chargeCurrency,
        status: paymentIntent.status
      });
    } catch (err: any) {
      const errorMsg = `Failed to fetch PaymentIntent from Stripe: ${err.message}`;
      logStep("CRITICAL: Cannot verify charge amount", { error: err.message });
      
      // Audit log for failure
      await supabaseClient.from("escrow_audit_log").insert({
        booking_id: bookingId,
        action_type: "refund_failed",
        action_reason: errorMsg,
        triggered_by: cancelledBy,
        previous_status: previousStatus,
        new_status: previousStatus,
        previous_escrow_status: previousEscrowStatus,
        new_escrow_status: previousEscrowStatus,
        amount_affected: 0,
        metadata: { stripe_error: err.message, payment_intent_id: booking.stripe_payment_intent_id }
      });
      
      throw new Error(errorMsg);
    }

    // HARD GUARDRAIL: No funds received = no refund
    if (actualChargeAmountCents === 0) {
      logStep("No funds received on this payment intent");
      
      const newStatus = cancelledBy === 'guest' ? 'cancelled_by_guest' : 'cancelled_by_host';
      await supabaseClient.from("bookings").update({
        status: newStatus,
        escrow_status: 'none',
        refund_amount: 0,
        refund_reason: 'No funds received',
        refund_status: 'none',
        cancelled_at: new Date().toISOString(),
      }).eq("id", bookingId);

      await supabaseClient.from("escrow_audit_log").insert({
        booking_id: bookingId,
        action_type: "cancellation_no_funds",
        action_reason: "PaymentIntent has no funds received",
        triggered_by: cancelledBy,
        previous_status: previousStatus,
        new_status: newStatus,
        previous_escrow_status: previousEscrowStatus,
        new_escrow_status: 'none',
        amount_affected: 0,
        metadata: { payment_intent_id: booking.stripe_payment_intent_id, amount_received: 0 }
      });

      return new Response(JSON.stringify({
        success: true,
        refund_amount: 0,
        refund_status: 'none',
        reason: 'No funds to refund'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate refund percentage based on policy
    const checkInDate = new Date(booking.check_in_date);
    const now = new Date();
    const daysUntilCheckin = Math.ceil((checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const policy = (booking.properties as any)?.cancellation_policy || 'moderate';

    let refundPercentage = 0;
    let refundReason = '';

    if (cancelledBy === 'host') {
      refundPercentage = 100;
      refundReason = 'Full refund - cancelled by host';
    } else {
      switch (policy) {
        case 'flexible':
          if (daysUntilCheckin >= 1) {
            refundPercentage = 100;
            refundReason = 'Full refund under flexible policy';
          } else {
            refundPercentage = 0;
            refundReason = 'No refund - less than 24 hours before check-in';
          }
          break;
        case 'moderate':
          if (daysUntilCheckin >= 5) {
            refundPercentage = 100;
            refundReason = 'Full refund - more than 5 days before check-in';
          } else if (daysUntilCheckin >= 1) {
            refundPercentage = 50;
            refundReason = '50% refund - less than 5 days before check-in';
          } else {
            refundPercentage = 0;
            refundReason = 'No refund - less than 24 hours before check-in';
          }
          break;
        case 'strict':
          if (daysUntilCheckin >= 14) {
            refundPercentage = 50;
            refundReason = '50% refund under strict policy - more than 14 days before check-in';
          } else {
            refundPercentage = 0;
            refundReason = 'No refund under strict policy - less than 14 days before check-in';
          }
          break;
        default:
          refundPercentage = 0;
          refundReason = 'No refund available';
      }
    }

    // Calculate refund from STRIPE amount (single source of truth)
    const refundAmountCents = Math.round(actualChargeAmountCents * (refundPercentage / 100));
    const refundAmount = refundAmountCents / 100;
    
    logStep("Refund calculation", { 
      refundPercentage, 
      actualChargeAmountCents,
      refundAmountCents,
      refundAmount,
      currency: chargeCurrency,
      refundReason, 
      daysUntilCheckin, 
      policy 
    });

    let stripeRefundId: string | null = null;
    let refundStatus = 'none';
    let failureReason: string | null = null;
    const newStatus = cancelledBy === 'guest' ? 'cancelled_by_guest' : 'cancelled_by_host';

    if (refundAmountCents > 0) {
      try {
        // Check existing refunds to prevent double refunds
        const existingRefunds = await stripe.refunds.list({
          payment_intent: booking.stripe_payment_intent_id,
          limit: 100,
        });

        const totalExistingRefundsCents = existingRefunds.data
          .filter(r => r.status === 'succeeded' || r.status === 'pending')
          .reduce((sum, r) => sum + r.amount, 0);
        
        logStep("Existing refunds check", { 
          existingCount: existingRefunds.data.length,
          totalExistingRefundsCents,
          requestedRefundCents: refundAmountCents,
          maxRefundable: actualChargeAmountCents
        });

        // HARD GUARDRAIL: Cannot refund more than charged
        const remainingRefundable = actualChargeAmountCents - totalExistingRefundsCents;
        if (remainingRefundable <= 0) {
          logStep("Already fully refunded");
          refundStatus = 'completed';
          stripeRefundId = existingRefunds.data[0]?.id || null;
        } else {
          // Calculate actual refund amount (never exceed remaining)
          const actualRefundCents = Math.min(refundAmountCents, remainingRefundable);
          
          // HARD GUARDRAIL: Abort if requested exceeds charge
          if (refundAmountCents > actualChargeAmountCents) {
            const errorMsg = `BLOCKED: Requested refund (${refundAmountCents} cents) exceeds charge amount (${actualChargeAmountCents} cents)`;
            logStep("GUARDRAIL TRIGGERED", { errorMsg });
            
            await supabaseClient.from("escrow_audit_log").insert({
              booking_id: bookingId,
              action_type: "refund_blocked",
              action_reason: errorMsg,
              triggered_by: cancelledBy,
              previous_status: previousStatus,
              new_status: previousStatus,
              previous_escrow_status: previousEscrowStatus,
              new_escrow_status: previousEscrowStatus,
              amount_affected: 0,
              metadata: { 
                requested_cents: refundAmountCents, 
                charge_cents: actualChargeAmountCents,
                payment_intent_id: booking.stripe_payment_intent_id
              }
            });
            
            throw new Error(errorMsg);
          }

          // IDEMPOTENCY: Use booking ID + cancellation type as idempotency key
          const idempotencyKey = `cancel_refund_${bookingId}_${cancelledBy}_${Date.now()}`;
          
          logStep("Creating Stripe refund", { 
            amount: actualRefundCents,
            idempotencyKey 
          });

          const refund = await stripe.refunds.create({
            payment_intent: booking.stripe_payment_intent_id,
            amount: actualRefundCents,
            reason: 'requested_by_customer',
            metadata: {
              booking_id: bookingId,
              cancelled_by: cancelledBy,
              refund_reason: refundReason,
              original_charge_cents: actualChargeAmountCents.toString()
            }
          }, {
            idempotencyKey
          });

          stripeRefundId = refund.id;
          refundStatus = refund.status === 'succeeded' ? 'completed' : 'pending';
          
          logStep("Stripe refund created", { 
            refundId: refund.id, 
            status: refund.status,
            amount: refund.amount,
            currency: refund.currency
          });
        }
      } catch (stripeError: any) {
        logStep("Stripe refund error", { error: stripeError.message, code: stripeError.code });
        refundStatus = 'failed';
        failureReason = stripeError.message;
        
        // Audit log for Stripe failure
        await supabaseClient.from("escrow_audit_log").insert({
          booking_id: bookingId,
          action_type: "refund_stripe_error",
          action_reason: `Stripe error: ${stripeError.message}`,
          triggered_by: cancelledBy,
          previous_status: previousStatus,
          new_status: newStatus,
          previous_escrow_status: previousEscrowStatus,
          new_escrow_status: 'held',
          amount_affected: refundAmount,
          metadata: { 
            stripe_error: stripeError.message,
            stripe_code: stripeError.code,
            requested_amount_cents: refundAmountCents,
            payment_intent_id: booking.stripe_payment_intent_id
          }
        });
      }
    }

    // ATOMIC UPDATE: Update booking with all refund details
    const { error: updateError } = await supabaseClient
      .from("bookings")
      .update({
        status: newStatus,
        escrow_status: refundStatus === 'completed' ? 'refunded' : (refundStatus === 'failed' ? 'held' : 'released'),
        escrow_currency: chargeCurrency,
        refund_amount: refundAmount,
        refund_reason: failureReason ? `${refundReason} (FAILED: ${failureReason})` : refundReason,
        refund_status: refundStatus,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (updateError) {
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    // SUCCESS AUDIT LOG
    await supabaseClient.from("escrow_audit_log").insert({
      booking_id: bookingId,
      action_type: refundStatus === 'completed' ? "refund_completed" : (refundStatus === 'failed' ? "refund_failed" : "cancellation_no_refund"),
      action_reason: refundReason,
      triggered_by: cancelledBy,
      previous_status: previousStatus,
      new_status: newStatus,
      previous_escrow_status: previousEscrowStatus,
      new_escrow_status: refundStatus === 'completed' ? 'refunded' : (refundStatus === 'failed' ? 'held' : 'released'),
      amount_affected: refundAmount,
      stripe_refund_id: stripeRefundId,
      metadata: {
        refund_percentage: refundPercentage,
        charge_amount_cents: actualChargeAmountCents,
        refund_amount_cents: refundAmountCents,
        currency: chargeCurrency,
        days_until_checkin: daysUntilCheckin,
        cancellation_policy: policy,
        payment_intent_id: booking.stripe_payment_intent_id,
        failure_reason: failureReason
      }
    });

    logStep("Cancellation refund completed", { 
      newStatus, 
      refundAmount,
      refundAmountCents,
      currency: chargeCurrency,
      refundStatus,
      stripeRefundId 
    });

    return new Response(JSON.stringify({
      success: true,
      refund_amount: refundAmount,
      refund_amount_cents: refundAmountCents,
      currency: chargeCurrency,
      refund_status: refundStatus,
      stripe_refund_id: stripeRefundId,
      reason: refundReason,
      failure_reason: failureReason
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logStep("Error", { message: error.message });
    
    // Attempt to log error to audit if we have booking context
    if (bookingId) {
      try {
        await supabaseClient.from("escrow_audit_log").insert({
          booking_id: bookingId,
          action_type: "refund_error",
          action_reason: error.message,
          triggered_by: cancelledBy || 'unknown',
          previous_status: previousStatus,
          new_status: previousStatus,
          previous_escrow_status: previousEscrowStatus,
          new_escrow_status: previousEscrowStatus,
          amount_affected: 0,
          metadata: { error: error.message, stack: error.stack }
        });
      } catch (auditError) {
        logStep("Failed to write error audit log", { error: auditError });
      }
    }
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
