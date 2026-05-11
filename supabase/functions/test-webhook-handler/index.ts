import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * TEST HARNESS: Direct webhook handler testing without Stripe signature
 * 
 * This function allows testing webhook handling logic directly by simulating
 * the internal processing that would occur after signature verification.
 * 
 * SECURITY: Only accessible with CRON_SECRET for admin testing.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// STATE MACHINE (duplicated from stripe-webhook for testing)
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  "confirmed": ["awaiting_payment", "deposit_paid"],
  "awaiting_payment": ["deposit_paid", "cancelled_by_system"],
  "deposit_paid": ["awaiting_checkin", "awaiting_remaining_payment", "checkin_dispute", 
                   "cancelled_by_guest", "cancelled_by_host", "cancelled_by_system", "disputed"],
  "awaiting_checkin": ["awaiting_remaining_payment", "checkin_dispute", 
                       "cancelled_by_guest", "cancelled_by_host", "cancelled_by_system"],
  "awaiting_remaining_payment": ["checked_in", "cancelled_by_guest", "cancelled_by_host", 
                                  "cancelled_by_system", "auto_cancelled", "payment_failed"],
  "checkin_dispute": ["cancelled_by_guest", "cancelled_by_host", "refunded", 
                      "awaiting_remaining_payment", "disputed"],
  "checked_in": ["checked_out", "disputed", "settlement_pending"],
  "checked_out": ["settlement_pending"],
  "settlement_pending": ["dispute_window", "disputed", "settled"],
  "dispute_window": ["settled", "disputed"],
  "disputed": ["refunded", "settled"],
  "settled": [],
  "refunded": [],
  "cancelled_by_guest": [],
  "cancelled_by_host": [],
  "cancelled_by_system": [],
  "auto_cancelled": [],
  "declined": [],
  "payment_failed": ["awaiting_remaining_payment", "cancelled_by_system"],
};

function isValidTransition(currentState: string, targetState: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[currentState];
  if (!allowed) return false;
  return allowed.includes(targetState);
}

async function getBookingState(bookingId: string) {
  const { data, error } = await supabaseClient
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();
  
  if (error) return null;
  return data;
}

async function logTestEvent(
  testId: string,
  eventType: string,
  bookingId: string | null,
  status: string,
  dbChanges: Record<string, unknown> | null,
  error: string | null
) {
  await supabaseClient.from("webhook_events").upsert({
    event_id: `test_${testId}`,
    event_type: eventType,
    booking_id: bookingId,
    metadata: { source: "test-harness" },
    payload: {},
    processing_status: status,
    db_changes: dbChanges,
    error_message: error,
    processed_at: new Date().toISOString(),
  }, { onConflict: "event_id" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Security: Require service role key or valid user session
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  // Verify using Supabase - check if caller is admin
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
  
  // If not a valid user token, check if it's the cron secret
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (authError || !user) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  } else {
    // Verify user is admin
    const { data: isAdmin } = await supabaseClient.rpc("is_admin");
    if (!isAdmin) {
      return new Response("Admin access required", { status: 403 });
    }
  }

  try {
    const { testCase, bookingId, eventId, paymentIntentId } = await req.json();

    console.log(`[TEST] Running test case: ${testCase} for booking: ${bookingId}`);

    const results: Record<string, unknown> = {
      testCase,
      bookingId,
      timestamp: new Date().toISOString(),
    };

    // Get booking state before test
    const beforeBooking = await getBookingState(bookingId);
    results.beforeState = beforeBooking ? {
      status: beforeBooking.status,
      payment_status: beforeBooking.payment_status,
      escrow_status: beforeBooking.escrow_status,
      remaining_payment_status: beforeBooking.remaining_payment_status,
    } : null;

    switch (testCase) {
      // =========================================
      // TEST CASE 1: Deposit Payment Processing
      // =========================================
      case "deposit_payment": {
        if (!beforeBooking) {
          results.error = "Booking not found";
          break;
        }

        // Check idempotency
        if (beforeBooking.payment_status === "paid" && beforeBooking.stripe_payment_intent_id === paymentIntentId) {
          results.outcome = "IDEMPOTENT_SKIP";
          results.message = "Already processed - no mutation";
          break;
        }

        // Validate transition
        const targetState = "deposit_paid";
        if (!isValidTransition(beforeBooking.status, targetState) && beforeBooking.status !== targetState) {
          results.outcome = "INVALID_TRANSITION";
          results.message = `Cannot transition ${beforeBooking.status} → ${targetState}`;
          break;
        }

        // Perform update with optimistic locking
        const { error: updateError, data } = await supabaseClient
          .from("bookings")
          .update({
            status: "deposit_paid",
            payment_status: "paid",
            escrow_status: "held",
            stripe_payment_intent_id: paymentIntentId || `test_pi_${Date.now()}`,
          })
          .eq("id", bookingId)
          .eq("status", beforeBooking.status)
          .select();

        if (updateError) {
          results.outcome = "UPDATE_FAILED";
          results.error = updateError.message;
        } else if (!data || data.length === 0) {
          results.outcome = "OPTIMISTIC_LOCK_FAILURE";
          results.message = "State changed concurrently - no update applied";
        } else {
          results.outcome = "SUCCESS";
          results.afterState = {
            status: data[0].status,
            payment_status: data[0].payment_status,
            escrow_status: data[0].escrow_status,
          };
        }

        await logTestEvent(eventId || `deposit_${Date.now()}`, "checkout.session.completed", bookingId, 
          results.outcome === "SUCCESS" ? "processed" : "skipped",
          { before: results.beforeState, after: results.afterState || null },
          results.error as string || null);
        break;
      }

      // =========================================
      // TEST CASE 2: Remaining Payment Processing
      // =========================================
      case "remaining_payment": {
        if (!beforeBooking) {
          results.error = "Booking not found";
          break;
        }

        // Check idempotency
        if (beforeBooking.remaining_payment_status === "paid" && beforeBooking.full_payment_locked) {
          results.outcome = "IDEMPOTENT_SKIP";
          results.message = "Already processed - no mutation";
          break;
        }

        // Must be in awaiting_remaining_payment state
        if (beforeBooking.status !== "awaiting_remaining_payment") {
          results.outcome = "WRONG_STATE";
          results.message = `Expected awaiting_remaining_payment, got ${beforeBooking.status}`;
          break;
        }

        // Perform update
        const { error: updateError, data } = await supabaseClient
          .from("bookings")
          .update({
            status: "checked_in",
            remaining_payment_status: "paid",
            remaining_payment_paid_at: new Date().toISOString(),
            full_payment_locked: true,
            stripe_remaining_payment_intent_id: paymentIntentId || `test_pi_${Date.now()}`,
          })
          .eq("id", bookingId)
          .eq("status", "awaiting_remaining_payment")
          .select();

        if (!data || data.length === 0) {
          results.outcome = "OPTIMISTIC_LOCK_FAILURE";
        } else {
          results.outcome = "SUCCESS";
          results.afterState = {
            status: data[0].status,
            remaining_payment_status: data[0].remaining_payment_status,
            full_payment_locked: data[0].full_payment_locked,
          };
        }

        await logTestEvent(eventId || `remaining_${Date.now()}`, "checkout.session.completed", bookingId,
          results.outcome === "SUCCESS" ? "processed" : "skipped",
          { before: results.beforeState, after: results.afterState || null },
          null);
        break;
      }

      // =========================================
      // TEST CASE 3: Duplicate Event (Idempotency)
      // =========================================
      case "duplicate_event": {
        // First check if event already logged
        const { data: existingEvent } = await supabaseClient
          .from("webhook_events")
          .select("*")
          .eq("event_id", eventId)
          .single();

        if (existingEvent) {
          results.outcome = "IDEMPOTENT_DETECTED";
          results.existingEvent = {
            event_id: existingEvent.event_id,
            processing_status: existingEvent.processing_status,
            created_at: existingEvent.created_at,
          };
          results.message = "Event already processed - no duplicate action";
        } else {
          results.outcome = "NEW_EVENT";
          results.message = "First time processing this event";
        }
        break;
      }

      // =========================================
      // TEST CASE 4: Out-of-Order Event
      // =========================================
      case "out_of_order_remaining_before_deposit": {
        if (!beforeBooking) {
          results.error = "Booking not found";
          break;
        }

        // Attempt remaining payment when deposit not paid
        if (beforeBooking.status !== "awaiting_remaining_payment") {
          results.outcome = "BLOCKED";
          results.message = `Correctly blocked: status is ${beforeBooking.status}, not awaiting_remaining_payment`;
          results.stateUnchanged = true;
        } else {
          results.outcome = "UNEXPECTED_ALLOWED";
          results.message = "This should not happen if state machine is correct";
        }

        await logTestEvent(eventId || `ooo_${Date.now()}`, "out_of_order_test", bookingId, "skipped",
          { reason: "out_of_order_attempt", before: results.beforeState },
          "Attempted remaining payment before deposit");
        break;
      }

      // =========================================
      // TEST CASE 5: Payment Failed
      // =========================================
      case "payment_failed": {
        if (!beforeBooking) {
          results.error = "Booking not found";
          break;
        }

        const terminalStates = ["cancelled_by_guest", "cancelled_by_host", "cancelled_by_system", 
                                "refunded", "settled", "checked_in", "checked_out"];
        
        if (terminalStates.includes(beforeBooking.status)) {
          results.outcome = "TERMINAL_STATE";
          results.message = `No action - booking in terminal state: ${beforeBooking.status}`;
        } else {
          const { data } = await supabaseClient
            .from("bookings")
            .update({
              payment_failure_reason: "Test payment failure",
              payment_failure_at: new Date().toISOString(),
            })
            .eq("id", bookingId)
            .select();

          results.outcome = "FAILURE_RECORDED";
          results.afterState = data?.[0] ? {
            payment_failure_reason: data[0].payment_failure_reason,
            payment_failure_at: data[0].payment_failure_at,
          } : null;
        }

        await logTestEvent(eventId || `failed_${Date.now()}`, "payment_intent.payment_failed", bookingId,
          "processed", { before: results.beforeState, after: results.afterState || null }, null);
        break;
      }

      // =========================================
      // TEST CASE 6: Dispute Created
      // =========================================
      case "dispute_created": {
        if (!beforeBooking) {
          results.error = "Booking not found";
          break;
        }

        // Check if already disputed
        if (beforeBooking.escrow_status === "frozen" && beforeBooking.stripe_dispute_id) {
          results.outcome = "IDEMPOTENT_SKIP";
          results.message = "Dispute already recorded";
          break;
        }

        const { data } = await supabaseClient
          .from("bookings")
          .update({
            status: "disputed",
            escrow_status: "frozen",
            stripe_dispute_id: `dp_test_${Date.now()}`,
            stripe_dispute_status: "needs_response",
            stripe_dispute_reason: "fraudulent",
            dispute_opened_at: new Date().toISOString(),
          })
          .eq("id", bookingId)
          .select();

        results.outcome = "DISPUTE_LOCKED";
        results.afterState = data?.[0] ? {
          status: data[0].status,
          escrow_status: data[0].escrow_status,
          stripe_dispute_id: data[0].stripe_dispute_id,
        } : null;

        await logTestEvent(eventId || `dispute_${Date.now()}`, "charge.dispute.created", bookingId,
          "processed", { before: results.beforeState, after: results.afterState }, null);
        break;
      }

      // =========================================
      // TEST CASE 7: Transfer Failed
      // =========================================
      case "transfer_failed": {
        if (!beforeBooking) {
          results.error = "Booking not found";
          break;
        }

        const { data } = await supabaseClient
          .from("bookings")
          .update({
            escrow_status: "transfer_failed",
            transfer_failure_reason: "Test transfer failure",
            transfer_failure_at: new Date().toISOString(),
          })
          .eq("id", bookingId)
          .select();

        results.outcome = "TRANSFER_FAILURE_RECORDED";
        results.afterState = data?.[0] ? {
          escrow_status: data[0].escrow_status,
          transfer_failure_reason: data[0].transfer_failure_reason,
        } : null;

        await logTestEvent(eventId || `transfer_${Date.now()}`, "transfer.failed", bookingId,
          "processed", { before: results.beforeState, after: results.afterState }, null);
        break;
      }

      // =========================================
      // TEST CASE 8: Full State Machine Test
      // =========================================
      case "state_machine_validation": {
        results.stateMachine = ALLOWED_TRANSITIONS;
        results.validTransitions = [];
        results.blockedTransitions = [];

        // Test a few key transitions
        const tests = [
          { from: "confirmed", to: "deposit_paid", shouldPass: true },
          { from: "deposit_paid", to: "checked_in", shouldPass: false }, // must go through awaiting_remaining_payment
          { from: "awaiting_remaining_payment", to: "checked_in", shouldPass: true },
          { from: "checked_in", to: "confirmed", shouldPass: false }, // no going back
          { from: "settled", to: "disputed", shouldPass: false }, // terminal
        ];

        for (const t of tests) {
          const result = isValidTransition(t.from, t.to);
          const passed = result === t.shouldPass;
          (passed ? results.validTransitions : results.blockedTransitions).push({
            from: t.from,
            to: t.to,
            expected: t.shouldPass,
            actual: result,
            passed,
          });
        }
        results.outcome = results.blockedTransitions.length === 0 ? "ALL_PASSED" : "SOME_FAILED";
        break;
      }

      default:
        results.error = `Unknown test case: ${testCase}`;
    }

    // Get booking state after test
    const afterBooking = await getBookingState(bookingId);
    if (afterBooking && !results.afterState) {
      results.currentState = {
        status: afterBooking.status,
        payment_status: afterBooking.payment_status,
        escrow_status: afterBooking.escrow_status,
        remaining_payment_status: afterBooking.remaining_payment_status,
      };
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    console.error("[TEST] Error:", error);
    return new Response(JSON.stringify({ error }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
