import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

// ============================================================================
// STATE MACHINE: ALLOWED TRANSITIONS
// ============================================================================
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  // Deposit payment flow
  "confirmed": ["awaiting_payment", "deposit_paid"],
  "awaiting_payment": ["deposit_paid", "cancelled_by_system"],
  
  // Post-deposit flow
  "deposit_paid": ["awaiting_checkin", "awaiting_remaining_payment", "checkin_dispute", 
                   "cancelled_by_guest", "cancelled_by_host", "cancelled_by_system", "disputed"],
  
  // Check-in and remaining payment flow
  "awaiting_checkin": ["awaiting_remaining_payment", "checkin_dispute", 
                       "cancelled_by_guest", "cancelled_by_host", "cancelled_by_system"],
  "awaiting_remaining_payment": ["checked_in", "cancelled_by_guest", "cancelled_by_host", 
                                  "cancelled_by_system", "auto_cancelled", "payment_failed"],
  "checkin_dispute": ["cancelled_by_guest", "cancelled_by_host", "refunded", 
                      "awaiting_remaining_payment", "disputed"],
  
  // Post-payment flow
  "checked_in": ["checked_out", "disputed", "settlement_pending"],
  "checked_out": ["settlement_pending"],
  "settlement_pending": ["dispute_window", "disputed", "settled"],
  "dispute_window": ["settled", "disputed"],
  
  // Terminal states (no transitions out)
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

// ============================================================================
// HELPER: Validate state transition
// ============================================================================
function isValidTransition(currentState: string, targetState: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[currentState];
  if (!allowed) {
    console.log(`[STATE-MACHINE] Unknown current state: ${currentState}`);
    return false;
  }
  return allowed.includes(targetState);
}

// ============================================================================
// HELPER: Log webhook event to database
// ============================================================================
async function logWebhookEvent(
  eventId: string,
  eventType: string,
  bookingId: string | null,
  metadata: Record<string, unknown> | null,
  payload: Record<string, unknown>,
  status: "received" | "processed" | "failed" | "skipped",
  dbChanges: Record<string, unknown> | null,
  errorMessage: string | null
) {
  try {
    await supabaseClient.from("webhook_events").upsert({
      event_id: eventId,
      event_type: eventType,
      booking_id: bookingId,
      metadata: metadata,
      payload: payload,
      processing_status: status,
      db_changes: dbChanges,
      error_message: errorMessage,
      processed_at: status !== "received" ? new Date().toISOString() : null,
    }, { onConflict: "event_id" });
  } catch (err) {
    console.error("[WEBHOOK] Failed to log event:", err);
  }
}

// ============================================================================
// HELPER: Log security events to audit log
// ============================================================================
async function logSecurityEvent(eventType: string, details: Record<string, unknown>) {
  try {
    await supabaseClient.from("escrow_audit_log").insert({
      action_type: eventType,
      triggered_by: "webhook",
      action_reason: JSON.stringify(details).substring(0, 500),
      booking_id: details.bookingId as string || "00000000-0000-0000-0000-000000000000",
    });
  } catch (err) {
    console.error("[WEBHOOK] Failed to log security event:", err);
  }
}

// ============================================================================
// HELPER: Create notification for user
// ============================================================================
async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  bookingId: string | null,
  link: string
) {
  try {
    await supabaseClient.from("notifications").insert({
      user_id: userId,
      type,
      title,
      message,
      booking_id: bookingId,
      link,
    });
  } catch (err) {
    console.error("[WEBHOOK] Failed to create notification:", err);
  }
}

// ============================================================================
// HELPER: Notify admins
// ============================================================================
async function notifyAdmins(subject: string, details: Record<string, unknown>) {
  try {
    // Get all admin user IDs
    const { data: admins } = await supabaseClient
      .from("admin_roles")
      .select("user_id");
    
    if (admins && admins.length > 0) {
      const notifications = admins.filter(admin => admin.user_id != null).map(admin => ({
        user_id: admin.user_id!,
        type: "admin_alert",
        title: subject,
        message: JSON.stringify(details).substring(0, 500),
        link: "/admin",
      }));
      
      await supabaseClient.from("notifications").insert(notifications);
    }
  } catch (err) {
    console.error("[WEBHOOK] Failed to notify admins:", err);
  }
}

// ============================================================================
// HELPER: Get booking with current state
// ============================================================================
async function getBookingState(bookingId: string) {
  const { data, error } = await supabaseClient
    .from("bookings")
    .select(`
      id, status, payment_status, escrow_status, 
      remaining_payment_status, stripe_payment_intent_id,
      stripe_remaining_payment_intent_id, deposit_amount,
      remaining_payment_amount, total_price, guest_id, host_id,
      host_check_in_confirmed_at, guest_check_in_confirmed_at,
      full_payment_locked
    `)
    .eq("id", bookingId)
    .single();
  
  if (error) {
    console.error("[WEBHOOK] Failed to get booking:", error);
    return null;
  }
  return data;
}

// ============================================================================
// HANDLER: Deposit Payment (checkout.session.completed with paymentType=deposit)
// ============================================================================
async function handleDepositPayment(
  event: Stripe.Event,
  session: Stripe.Checkout.Session
): Promise<{ success: boolean; dbChanges: Record<string, unknown> | null; error: string | null }> {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) {
    return { success: false, dbChanges: null, error: "No bookingId in metadata" };
  }

  console.log(`[DEPOSIT] Processing deposit for booking: ${bookingId}`);

  // STEP 1: Read current state
  const booking = await getBookingState(bookingId);
  if (!booking) {
    return { success: false, dbChanges: null, error: "Booking not found" };
  }

  const beforeState = {
    status: booking.status,
    payment_status: booking.payment_status,
    stripe_payment_intent_id: booking.stripe_payment_intent_id,
  };

  // STEP 2: Check if already processed (IDEMPOTENCY)
  if (booking.payment_status === "paid" && booking.stripe_payment_intent_id === session.payment_intent) {
    console.log(`[DEPOSIT] Already processed - idempotency check passed`);
    return { 
      success: true, 
      dbChanges: { note: "Already processed - idempotent skip", before: beforeState }, 
      error: null 
    };
  }

  // STEP 3: Validate state transition
  const targetState = "deposit_paid";
  if (!isValidTransition(booking.status, targetState) && booking.status !== targetState) {
    const error = `Invalid transition: ${booking.status} → ${targetState}`;
    console.error(`[DEPOSIT] ${error}`);
    return { success: false, dbChanges: { before: beforeState }, error };
  }

  // STEP 4: Perform atomic update — full payment, set full_payment_locked immediately
  // Also store stripe_customer_id for future off-session charges (damage claims)
  const customerId = session.customer ? (typeof session.customer === 'string' ? session.customer : session.customer.id) : null;
  
  const updateData: Record<string, unknown> = {
    status: "deposit_paid",
    payment_status: "paid",
    escrow_status: "held",
    full_payment_locked: true,
    full_payment_locked_at: new Date().toISOString(),
    stripe_payment_intent_id: session.payment_intent as string,
  };
  
  if (customerId) {
    updateData.stripe_customer_id = customerId;
  }
  
  const { error: updateError } = await supabaseClient
    .from("bookings")
    .update(updateData)
    .eq("id", bookingId)
    .eq("status", booking.status); // Optimistic locking

  if (updateError) {
    return { success: false, dbChanges: { before: beforeState }, error: updateError.message };
  }

  const afterState = {
    status: "deposit_paid",
    payment_status: "paid",
    escrow_status: "held",
    stripe_payment_intent_id: session.payment_intent,
  };

  console.log(`[DEPOSIT] Successfully updated booking ${bookingId}`);

  // STEP 5: Notify guest
  await createNotification(
    booking.guest_id,
    "deposit_received",
    "Deposit Received",
    "Your deposit has been received. Your booking is secured!",
    bookingId,
    "/profile?tab=reservations"
  );

  return { success: true, dbChanges: { before: beforeState, after: afterState }, error: null };
}

// ============================================================================
// HANDLER: Remaining Payment (checkout.session.completed with paymentType=remaining)
// ============================================================================
async function handleRemainingPayment(
  event: Stripe.Event,
  session: Stripe.Checkout.Session
): Promise<{ success: boolean; dbChanges: Record<string, unknown> | null; error: string | null }> {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) {
    return { success: false, dbChanges: null, error: "No bookingId in metadata" };
  }

  console.log(`[REMAINING] Processing remaining payment for booking: ${bookingId}`);

  // STEP 1: Read current state
  const booking = await getBookingState(bookingId);
  if (!booking) {
    return { success: false, dbChanges: null, error: "Booking not found" };
  }

  const beforeState = {
    status: booking.status,
    remaining_payment_status: booking.remaining_payment_status,
    full_payment_locked: booking.full_payment_locked,
  };

  // STEP 2: Check if already processed (IDEMPOTENCY)
  if (booking.remaining_payment_status === "paid" && booking.full_payment_locked === true) {
    console.log(`[REMAINING] Already processed - idempotency check passed`);
    return { 
      success: true, 
      dbChanges: { note: "Already processed - idempotent skip", before: beforeState }, 
      error: null 
    };
  }

  // STEP 3: Validate state - must be awaiting_remaining_payment
  if (booking.status !== "awaiting_remaining_payment") {
    const error = `Cannot process remaining payment in state: ${booking.status}. Expected: awaiting_remaining_payment`;
    console.error(`[REMAINING] ${error}`);
    return { success: false, dbChanges: { before: beforeState }, error };
  }

  // STEP 4: Validate dual check-in confirmation
  if (!booking.host_check_in_confirmed_at || !booking.guest_check_in_confirmed_at) {
    const error = "Dual check-in confirmation required before remaining payment";
    console.error(`[REMAINING] ${error}`);
    return { success: false, dbChanges: { before: beforeState }, error };
  }

  // STEP 5: Perform atomic update
  const { error: updateError } = await supabaseClient
    .from("bookings")
    .update({
      status: "checked_in",
      remaining_payment_status: "paid",
      remaining_payment_paid_at: new Date().toISOString(),
      full_payment_locked: true,
      stripe_remaining_payment_intent_id: session.payment_intent as string,
    })
    .eq("id", bookingId)
    .eq("status", "awaiting_remaining_payment"); // Optimistic locking

  if (updateError) {
    return { success: false, dbChanges: { before: beforeState }, error: updateError.message };
  }

  const afterState = {
    status: "checked_in",
    remaining_payment_status: "paid",
    full_payment_locked: true,
    stripe_remaining_payment_intent_id: session.payment_intent,
  };

  console.log(`[REMAINING] Successfully updated booking ${bookingId}`);

  // STEP 6: Notify guest
  await createNotification(
    booking.guest_id,
    "payment_complete",
    "Full Payment Complete",
    "Your full payment is complete. Enjoy your stay!",
    bookingId,
    "/profile?tab=reservations"
  );

  return { success: true, dbChanges: { before: beforeState, after: afterState }, error: null };
}

// ============================================================================
// HANDLER: Payment Failed
// ============================================================================
async function handlePaymentFailed(
  event: Stripe.Event,
  paymentIntent: Stripe.PaymentIntent
): Promise<{ success: boolean; dbChanges: Record<string, unknown> | null; error: string | null }> {
  const bookingId = paymentIntent.metadata?.bookingId;
  const paymentType = paymentIntent.metadata?.paymentType;
  
  if (!bookingId) {
    return { success: true, dbChanges: { note: "No bookingId - not a booking payment" }, error: null };
  }

  console.log(`[FAILED] Payment failed for booking: ${bookingId}, type: ${paymentType}`);

  const booking = await getBookingState(bookingId);
  if (!booking) {
    return { success: false, dbChanges: null, error: "Booking not found" };
  }

  const beforeState = { status: booking.status, payment_status: booking.payment_status };

  // Don't update if already in a terminal state
  const terminalStates = ["cancelled_by_guest", "cancelled_by_host", "cancelled_by_system", 
                          "refunded", "settled", "checked_in", "checked_out"];
  if (terminalStates.includes(booking.status)) {
    console.log(`[FAILED] Booking in terminal state ${booking.status} - no action needed`);
    return { success: true, dbChanges: { note: "Terminal state - no action", before: beforeState }, error: null };
  }

  // Update booking with failure info
  const updateData: Record<string, unknown> = {
    payment_failure_reason: paymentIntent.last_payment_error?.message || "Payment failed",
    payment_failure_at: new Date().toISOString(),
  };

  // For remaining payments that fail, mark specifically
  if (paymentType === "remaining" && booking.status === "awaiting_remaining_payment") {
    updateData.remaining_payment_status = "failed";
  }

  await supabaseClient
    .from("bookings")
    .update(updateData)
    .eq("id", bookingId);

  // Notify guest
  await createNotification(
    booking.guest_id,
    "payment_failed",
    "Payment Failed",
    `Your payment could not be processed: ${paymentIntent.last_payment_error?.message || "Please try again"}`,
    bookingId,
    "/profile?tab=reservations"
  );

  // Notify admins for awareness
  await notifyAdmins("Payment Failed", {
    bookingId,
    paymentType,
    error: paymentIntent.last_payment_error?.message,
    amount: paymentIntent.amount,
  });

  return { 
    success: true, 
    dbChanges: { before: beforeState, after: updateData }, 
    error: null 
  };
}

// ============================================================================
// HANDLER: Checkout Session Expired
// ============================================================================
async function handleCheckoutExpired(
  event: Stripe.Event,
  session: Stripe.Checkout.Session
): Promise<{ success: boolean; dbChanges: Record<string, unknown> | null; error: string | null }> {
  const bookingId = session.metadata?.bookingId;
  const paymentType = session.metadata?.paymentType || session.metadata?.escrowType;
  
  if (!bookingId) {
    return { success: true, dbChanges: { note: "No bookingId - not a booking session" }, error: null };
  }

  console.log(`[EXPIRED] Checkout expired for booking: ${bookingId}, type: ${paymentType}`);

  const booking = await getBookingState(bookingId);
  if (!booking) {
    return { success: false, dbChanges: null, error: "Booking not found" };
  }

  const beforeState = { status: booking.status };

  // Only act if booking is still waiting for this specific payment
  if (paymentType === "deposit" && booking.status === "awaiting_payment") {
    // Deposit session expired - could auto-cancel or just notify
    await createNotification(
      booking.guest_id,
      "payment_expired",
      "Payment Session Expired",
      "Your payment session expired. Please try again to complete your booking.",
      bookingId,
      "/profile?tab=reservations"
    );
  } else if (paymentType === "remaining" && booking.status === "awaiting_remaining_payment") {
    // Remaining payment session expired
    await createNotification(
      booking.guest_id,
      "payment_expired",
      "Payment Session Expired",
      "Your remaining payment session expired. Please try again.",
      bookingId,
      "/profile?tab=reservations"
    );
  }

  return { 
    success: true, 
    dbChanges: { before: beforeState, note: "Session expired - notification sent" }, 
    error: null 
  };
}

// ============================================================================
// HANDLER: Transfer Failed (payout to host failed)
// ============================================================================
async function handleTransferFailed(
  event: Stripe.Event,
  transfer: Stripe.Transfer
): Promise<{ success: boolean; dbChanges: Record<string, unknown> | null; error: string | null }> {
  const bookingId = transfer.metadata?.booking_id;
  
  if (!bookingId) {
    // Check transfer_group format: booking_{id}
    const match = transfer.transfer_group?.match(/^booking_(.+)$/);
    if (!match) {
      return { success: true, dbChanges: { note: "No booking reference found" }, error: null };
    }
  }

  const actualBookingId = bookingId || transfer.transfer_group?.replace("booking_", "");
  console.log(`[TRANSFER-FAILED] Transfer failed for booking: ${actualBookingId}`);

  if (!actualBookingId) {
    return { success: true, dbChanges: { note: "Could not determine bookingId" }, error: null };
  }

  const booking = await getBookingState(actualBookingId);
  if (!booking) {
    return { success: false, dbChanges: null, error: "Booking not found" };
  }

  const beforeState = { escrow_status: booking.escrow_status };

  // Update booking to indicate transfer failure
  await supabaseClient
    .from("bookings")
    .update({
      escrow_status: "transfer_failed",
      transfer_failure_reason: "Stripe transfer failed - requires manual intervention",
      transfer_failure_at: new Date().toISOString(),
    })
    .eq("id", actualBookingId);

  // CRITICAL: Notify admins immediately
  await notifyAdmins("CRITICAL: Host Payout Failed", {
    bookingId: actualBookingId,
    transferId: transfer.id,
    amount: transfer.amount,
    destination: transfer.destination,
    error: "Transfer to host failed - funds still in platform account",
  });

  // Log to audit
  await logSecurityEvent("transfer_failed", {
    bookingId: actualBookingId,
    transferId: transfer.id,
    amount: transfer.amount,
  });

  return { 
    success: true, 
    dbChanges: { before: beforeState, after: { escrow_status: "transfer_failed" } }, 
    error: null 
  };
}

// ============================================================================
// HANDLER: Dispute Created (Chargeback)
// ============================================================================
async function handleDisputeCreated(
  event: Stripe.Event,
  dispute: Stripe.Dispute
): Promise<{ success: boolean; dbChanges: Record<string, unknown> | null; error: string | null }> {
  console.log(`[DISPUTE] Dispute created: ${dispute.id}`);

  // Find booking by payment intent
  const paymentIntentId = typeof dispute.payment_intent === "string" 
    ? dispute.payment_intent 
    : dispute.payment_intent?.id;

  if (!paymentIntentId) {
    return { success: true, dbChanges: { note: "No payment intent in dispute" }, error: null };
  }

  // Search for booking with this payment intent
  const { data: booking } = await supabaseClient
    .from("bookings")
    .select("id, status, escrow_status, guest_id, host_id")
    .or(`stripe_payment_intent_id.eq.${paymentIntentId},stripe_remaining_payment_intent_id.eq.${paymentIntentId}`)
    .single();

  if (!booking) {
    console.log(`[DISPUTE] No booking found for payment intent: ${paymentIntentId}`);
    // Still notify admins of unknown dispute
    await notifyAdmins("CRITICAL: Unknown Dispute Received", {
      disputeId: dispute.id,
      paymentIntentId,
      amount: dispute.amount,
      reason: dispute.reason,
    });
    return { success: true, dbChanges: { note: "No booking found for this dispute" }, error: null };
  }

  const beforeState = { status: booking.status, escrow_status: booking.escrow_status };

  // LOCK BOOKING: Freeze escrow and mark as disputed
  const { error: updateError } = await supabaseClient
    .from("bookings")
    .update({
      status: "disputed",
      escrow_status: "frozen",
      dispute_opened_at: new Date().toISOString(),
      stripe_dispute_id: dispute.id,
      stripe_dispute_reason: dispute.reason,
      stripe_dispute_status: dispute.status,
    })
    .eq("id", booking.id);

  if (updateError) {
    return { success: false, dbChanges: { before: beforeState }, error: updateError.message };
  }

  const afterState = {
    status: "disputed",
    escrow_status: "frozen",
    stripe_dispute_id: dispute.id,
  };

  // Notify host
  await createNotification(
    booking.host_id,
    "dispute_created",
    "⚠️ Payment Dispute Filed",
    "A guest has filed a payment dispute. Funds are frozen pending resolution.",
    booking.id,
    "/profile?tab=requests"
  );

  // CRITICAL: Notify admins immediately
  await notifyAdmins("CRITICAL: Chargeback Dispute Filed", {
    bookingId: booking.id,
    disputeId: dispute.id,
    amount: dispute.amount,
    reason: dispute.reason,
    evidence_due_by: dispute.evidence_details?.due_by,
  });

  // Audit log
  await logSecurityEvent("stripe_dispute_created", {
    bookingId: booking.id,
    disputeId: dispute.id,
    amount: dispute.amount,
    reason: dispute.reason,
  });

  return { success: true, dbChanges: { before: beforeState, after: afterState }, error: null };
}

// ============================================================================
// HANDLER: Dispute Closed (Chargeback resolved)
// ============================================================================
async function handleDisputeClosed(
  event: Stripe.Event,
  dispute: Stripe.Dispute
): Promise<{ success: boolean; dbChanges: Record<string, unknown> | null; error: string | null }> {
  console.log(`[DISPUTE] Dispute closed: ${dispute.id}, status: ${dispute.status}`);

  // Find booking by dispute ID or payment intent
  let booking;
  
  // First try by dispute ID
  const { data: bookingByDispute } = await supabaseClient
    .from("bookings")
    .select("id, status, escrow_status, guest_id, host_id, stripe_payment_intent_id")
    .eq("stripe_dispute_id", dispute.id)
    .single();
  
  if (bookingByDispute) {
    booking = bookingByDispute;
  } else {
    // Fallback to payment intent
    const paymentIntentId = typeof dispute.payment_intent === "string" 
      ? dispute.payment_intent 
      : dispute.payment_intent?.id;
    
    if (paymentIntentId) {
      const { data } = await supabaseClient
        .from("bookings")
        .select("id, status, escrow_status, guest_id, host_id, stripe_payment_intent_id")
        .or(`stripe_payment_intent_id.eq.${paymentIntentId},stripe_remaining_payment_intent_id.eq.${paymentIntentId}`)
        .single();
      booking = data;
    }
  }

  if (!booking) {
    console.log(`[DISPUTE] No booking found for dispute: ${dispute.id}`);
    return { success: true, dbChanges: { note: "No booking found for this dispute" }, error: null };
  }

  const beforeState = { status: booking.status, escrow_status: booking.escrow_status };

  // Determine outcome
  // dispute.status can be: warning_needs_response, warning_under_review, warning_closed, 
  // needs_response, under_review, won, lost
  const hostWon = dispute.status === "won";
  const guestWon = dispute.status === "lost"; // Lost from merchant perspective = guest won

  let newStatus: string;
  let newEscrowStatus: string;
  let notificationMessage: string;

  if (hostWon) {
    // Dispute won by host - unfreeze escrow, proceed with payout
    newStatus = "settlement_pending";
    newEscrowStatus = "ready_for_release";
    notificationMessage = "The payment dispute has been resolved in your favor. Payout will proceed.";
  } else if (guestWon) {
    // Dispute lost - guest gets refund via Stripe, mark our escrow accordingly
    newStatus = "refunded";
    newEscrowStatus = "refunded_by_dispute";
    notificationMessage = "The payment dispute has been resolved in the guest's favor. Funds have been refunded.";
  } else {
    // Still under review or other status
    console.log(`[DISPUTE] Dispute not yet resolved: ${dispute.status}`);
    
    // Just update the status tracking
    await supabaseClient
      .from("bookings")
      .update({ stripe_dispute_status: dispute.status })
      .eq("id", booking.id);
    
    return { 
      success: true, 
      dbChanges: { before: beforeState, note: `Dispute status updated to: ${dispute.status}` }, 
      error: null 
    };
  }

  // Update booking
  const { error: updateError } = await supabaseClient
    .from("bookings")
    .update({
      status: newStatus,
      escrow_status: newEscrowStatus,
      stripe_dispute_status: dispute.status,
      dispute_resolved_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (updateError) {
    return { success: false, dbChanges: { before: beforeState }, error: updateError.message };
  }

  const afterState = { status: newStatus, escrow_status: newEscrowStatus };

  // Notify host
  await createNotification(
    booking.host_id,
    hostWon ? "dispute_won" : "dispute_lost",
    hostWon ? "Dispute Resolved - You Won" : "Dispute Resolved - Guest Won",
    notificationMessage,
    booking.id,
    "/profile?tab=requests"
  );

  // Notify admins
  await notifyAdmins(`Dispute Resolved: ${hostWon ? "Host Won" : "Guest Won"}`, {
    bookingId: booking.id,
    disputeId: dispute.id,
    outcome: dispute.status,
  });

  // Audit log
  await logSecurityEvent("stripe_dispute_resolved", {
    bookingId: booking.id,
    disputeId: dispute.id,
    outcome: dispute.status,
    hostWon,
    guestWon,
  });

  return { success: true, dbChanges: { before: beforeState, after: afterState }, error: null };
}

// ============================================================================
// MAIN WEBHOOK HANDLER
// ============================================================================
serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  
  let event: Stripe.Event;

  // ========================
  // SIGNATURE VERIFICATION
  // ========================
  if (!webhookSecret) {
    console.error("CRITICAL: STRIPE_WEBHOOK_SECRET is not configured!");
    await logSecurityEvent("webhook_security_error", {
      error: "STRIPE_WEBHOOK_SECRET not configured",
      timestamp: new Date().toISOString(),
    });
    return new Response("Webhook configuration error", { status: 500 });
  }

  if (!signature) {
    console.error("SECURITY: Missing stripe-signature header");
    await logSecurityEvent("webhook_signature_missing", {
      ip: req.headers.get("x-forwarded-for") || "unknown",
      timestamp: new Date().toISOString(),
    });
    return new Response("Missing signature", { status: 401 });
  }

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    console.log(`[WEBHOOK] Verified event: ${event.id} (${event.type})`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("SECURITY: Signature verification failed:", errorMessage);
    await logSecurityEvent("webhook_signature_invalid", {
      error: errorMessage,
      ip: req.headers.get("x-forwarded-for") || "unknown",
    });
    return new Response(`Signature verification failed: ${errorMessage}`, { status: 401 });
  }

  // ========================
  // IDEMPOTENCY / REPLAY PROTECTION
  // Reject duplicate Stripe events (Stripe may retry valid events)
  // ========================
  try {
    const { error: insertErr } = await supabase
      .from("processed_stripe_events")
      .insert({ event_id: event.id, event_type: event.type });
    if (insertErr) {
      // Postgres unique-violation = already processed
      if ((insertErr as any).code === "23505") {
        console.log(`[WEBHOOK] Duplicate event ${event.id} ignored`);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      console.error("[WEBHOOK] Failed to record event for idempotency:", insertErr);
      // Fail closed: do not process if we can't guarantee idempotency
      return new Response("Idempotency check failed", { status: 500 });
    }
  } catch (e) {
    console.error("[WEBHOOK] Idempotency check threw:", e);
    return new Response("Idempotency check failed", { status: 500 });
  }

  // ========================
  // EXTRACT COMMON DATA
  // ========================
  const eventObject = event.data.object as any;
  const metadata = eventObject.metadata || null;
  const bookingId = metadata?.bookingId || metadata?.booking_id || null;
  const paymentType = metadata?.paymentType || metadata?.escrowType || "unknown";

  // Log as received
  await logWebhookEvent(
    event.id,
    event.type,
    bookingId,
    metadata,
    { object_id: eventObject.id, object_type: eventObject.object },
    "received",
    null,
    null
  );

  // ========================
  // EVENT ROUTING
  // ========================
  let result: { success: boolean; dbChanges: Record<string, unknown> | null; error: string | null };

  try {
    switch (event.type) {
      // ---- CHECKOUT COMPLETED ----
      case "checkout.session.completed": {
        const session = eventObject as Stripe.Checkout.Session;
        const type = session.metadata?.paymentType || session.metadata?.escrowType;
        
        if (type === "remaining") {
          result = await handleRemainingPayment(event, session);
        } else {
          // Default to deposit (for backward compatibility with escrowType: "deposit")
          result = await handleDepositPayment(event, session);
        }
        break;
      }

      // ---- PAYMENT FAILED ----
      case "payment_intent.payment_failed": {
        result = await handlePaymentFailed(event, eventObject as Stripe.PaymentIntent);
        break;
      }

      // ---- CHECKOUT EXPIRED ----
      case "checkout.session.expired": {
        result = await handleCheckoutExpired(event, eventObject as Stripe.Checkout.Session);
        break;
      }

      // ---- TRANSFER FAILED ----
      case "transfer.failed": {
        result = await handleTransferFailed(event, eventObject as Stripe.Transfer);
        break;
      }

      // ---- DISPUTE CREATED ----
      case "charge.dispute.created": {
        result = await handleDisputeCreated(event, eventObject as Stripe.Dispute);
        break;
      }

      // ---- DISPUTE CLOSED ----
      case "charge.dispute.closed":
      case "charge.dispute.updated": {
        // Handle both closed and updated to catch status changes
        const dispute = eventObject as Stripe.Dispute;
        if (["won", "lost"].includes(dispute.status)) {
          result = await handleDisputeClosed(event, dispute);
        } else {
          result = { 
            success: true, 
            dbChanges: { note: `Dispute update: ${dispute.status}` }, 
            error: null 
          };
        }
        break;
      }

      // ---- INFORMATIONAL EVENTS (log only) ----
      case "payment_intent.succeeded":
      case "payment_intent.created":
      case "charge.succeeded":
      case "charge.refunded": {
        result = { 
          success: true, 
          dbChanges: { note: `Informational event logged: ${event.type}` }, 
          error: null 
        };
        break;
      }

      // ---- UNKNOWN EVENTS ----
      default: {
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
        result = { 
          success: true, 
          dbChanges: { note: `Unhandled event type: ${event.type}` }, 
          error: null 
        };
      }
    }

    // Log final result
    await logWebhookEvent(
      event.id,
      event.type,
      bookingId,
      metadata,
      { object_id: eventObject.id },
      result.success ? "processed" : "failed",
      result.dbChanges,
      result.error
    );

  } catch (processingError) {
    const errorMsg = processingError instanceof Error ? processingError.message : "Unknown error";
    console.error(`[WEBHOOK] Processing error: ${errorMsg}`);
    
    await logWebhookEvent(
      event.id,
      event.type,
      bookingId,
      metadata,
      { object_id: eventObject.id },
      "failed",
      null,
      errorMsg
    );

    // Still return 200 to prevent Stripe retries for processing errors
    // (signature was valid, we just had internal issues)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
