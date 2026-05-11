import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * ESCROW DEADLINE ENFORCEMENT CRON JOB
 * 
 * Runs every 15 minutes to enforce automated deadline actions.
 * 
 * RULES (PLAIN ENGLISH):
 * 
 * 0. PAYMENT DEADLINE (24 hours after host confirms booking)
 *    - Guest hasn't paid 100% + 5% service fee within 24 hours
 *    - Action: Auto-cancel booking, property becomes available again
 *    - No refund needed (no payment was made)
 * 
 * 1. CHECK-IN DEADLINE MISSED (2 hours after scheduled check-in time)
 *    - If NEITHER party confirmed: Auto-cancel, full refund to guest
 *    - If HOST confirmed but guest didn't: Auto-cancel, full refund to guest
 *    - If GUEST confirmed but host didn't: Auto-cancel, full refund to guest
 * 
 * 2. DISPUTE WINDOW EXPIRED (24 hours after check-in)
 *    - Guest can only report property damage within first 24 hours
 *    - If no dispute filed: Auto-mark as "no issues", proceed to normal checkout flow
 * 
 * 3. CHECKOUT DEADLINE MISSED (24 hours after scheduled checkout)
 *    - If no damage reported by host: Auto-release to host
 *    - If host reported damage: Stay in disputed status for admin review
 * 
 * 4. SETTLEMENT WINDOW EXPIRED (48 hours after both parties confirm checkout)
 *    - If no dispute filed: Auto-release to host
 * 
 * IDEMPOTENCY GUARANTEES:
 * - Each booking has auto_action_taken field to prevent duplicate actions
 * - All Stripe operations checked for existing transfers/refunds
 * - Audit log created for every action for transparency
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ESCROW-CRON] ${step}${detailsStr}`);
};

// Helper to send notification emails
async function sendNotificationEmail(request: {
  type: string;
  recipientEmail: string;
  recipientName?: string;
  message?: string;
  propertyTitle?: string;
  amount?: number;
  currency?: string;
  deadline?: string;
  reason?: string;
  link?: string;
}): Promise<void> {
  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification-email`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      logStep("Email send failed", { status: response.status, error: errorText });
    } else {
      logStep("Email sent", { type: request.type, to: request.recipientEmail });
    }
  } catch (error) {
    logStep("Email send error", { error: error instanceof Error ? error.message : String(error) });
  }
}

// Helper to get participant info (email, name, property title) for a booking
async function getBookingParticipantInfo(
  supabase: any, 
  userId: string, 
  bookingId: string
): Promise<{ email: string; name: string; propertyTitle: string } | null> {
  try {
    // Get user email from auth
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);
    if (!user?.email) return null;
    
    // Get user name from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();
    
    // Get property title from booking
    const { data: booking } = await supabase
      .from("bookings")
      .select("property_id, properties(title)")
      .eq("id", bookingId)
      .single();
    
    return {
      email: user.email,
      name: profile?.full_name || "there",
      propertyTitle: (booking?.properties as any)?.title || "your property"
    };
  } catch (error) {
    logStep("Failed to get participant info", { userId, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

interface BookingForEnforcement {
  id: string;
  guest_id: string;
  host_id: string;
  status: string;
  escrow_status: string;
  deposit_amount: number;
  remaining_payment_amount: number;
  total_price: number;
  check_in_date: string;
  check_in_time: string | null;
  check_out_date: string;
  check_out_time: string | null;
  check_in_deadline: string | null;
  remaining_payment_deadline: string | null;
  check_out_deadline: string | null;
  dispute_deadline: string | null;
  host_check_in_confirmed_at: string | null;
  guest_check_in_confirmed_at: string | null;
  host_check_out_confirmed_at: string | null;
  guest_check_out_confirmed_at: string | null;
  host_reported_damage: boolean | null;
  check_in_issues_reported: boolean | null;
  full_payment_locked: boolean | null;
  auto_action_taken: string | null;
  stripe_payment_intent_id: string | null;
  remaining_payment_intent_id: string | null;
  escrow_currency: string | null;
  responded_at: string | null;
  payment_status: string | null;
}

interface ActionResult {
  booking_id: string;
  action: string;
  success: boolean;
  error?: string;
  details?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ====== PHASE 1: CRON SECRET AUTHENTICATION ======
  // Reject ALL requests unless X-Cron-Secret matches CRON_SECRET
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("X-Cron-Secret");
  
  if (!cronSecret || !providedSecret || providedSecret !== cronSecret) {
    // Do NOT log the secret or any identifying information
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
    );
  }

  const results: ActionResult[] = [];
  const now = new Date();

  try {
    logStep("Cron job started", { timestamp: now.toISOString() });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Fetch all bookings that might need deadline enforcement
    // Exclude terminal states
    const { data: bookings, error: fetchError } = await supabase
      .from("bookings")
      .select(`
        id, guest_id, host_id, status, escrow_status,
        deposit_amount, remaining_payment_amount, total_price,
        check_in_date, check_in_time, check_out_date, check_out_time,
        check_in_deadline, remaining_payment_deadline, check_out_deadline, dispute_deadline,
        host_check_in_confirmed_at, guest_check_in_confirmed_at,
        host_check_out_confirmed_at, guest_check_out_confirmed_at,
        host_reported_damage, check_in_issues_reported, full_payment_locked,
        auto_action_taken, stripe_payment_intent_id, remaining_payment_intent_id,
        escrow_currency, responded_at, payment_status
      `)
      .not("status", "in", "(settled,refunded,cancelled_by_guest,cancelled_by_host,cancelled_by_system,declined)")
      .is("auto_action_taken", null);

    if (fetchError) {
      throw new Error(`Failed to fetch bookings: ${fetchError.message}`);
    }

    logStep("Fetched bookings for enforcement", { count: bookings?.length || 0 });

    if (!bookings || bookings.length === 0) {
      return new Response(
        JSON.stringify({ message: "No bookings require action", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Process each booking
    for (const booking of bookings as BookingForEnforcement[]) {
      try {
        // Skip non-USD/EUR bookings (TND not in escrow system)
        if (booking.escrow_currency && !['usd', 'eur'].includes(booking.escrow_currency.toLowerCase())) {
          continue;
        }

        const result = await processBookingDeadline(supabase, stripe, booking, now);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logStep("Error processing booking", { bookingId: booking.id, error: errorMessage });
        results.push({
          booking_id: booking.id,
          action: "processing_error",
          success: false,
          error: errorMessage,
        });
      }
    }

    logStep("Cron job completed", { actionsCount: results.length });

    return new Response(
      JSON.stringify({ 
        message: `Processed ${results.length} actions`,
        timestamp: now.toISOString(),
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("CRITICAL ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

async function processBookingDeadline(
  supabase: any,
  stripe: Stripe,
  booking: BookingForEnforcement,
  now: Date
): Promise<ActionResult | null> {
  
  // PRIORITY ORDER: Check deadlines from earliest to latest stage
  
  // 0. PAYMENT DEADLINE (24h after host confirms)
  if ((booking.status === 'confirmed' || booking.status === 'awaiting_payment') && booking.payment_status !== 'paid') {
    if (booking.responded_at) {
      const depositDeadline = new Date(new Date(booking.responded_at).getTime() + 24 * 60 * 60 * 1000);
      if (now > depositDeadline) {
        return await handleDepositPaymentDeadlineMissed(supabase, booking, depositDeadline);
      }
    }
  }

  // 1. CHECK-IN DEADLINE
  if (booking.status === 'deposit_paid' || booking.status === 'awaiting_checkin') {
    const checkInDeadline = booking.check_in_deadline 
      ? new Date(booking.check_in_deadline)
      : calculateDefaultCheckInDeadline(booking);
    
    if (now > checkInDeadline) {
      return await handleCheckInDeadlineMissed(supabase, stripe, booking, checkInDeadline);
    }
  }

  // 2. DISPUTE WINDOW EXPIRED (24h after check-in — guest didn't report damage)
  if (booking.status === 'checked_in' && !booking.check_in_issues_reported) {
    const disputeDeadline = booking.dispute_deadline
      ? new Date(booking.dispute_deadline)
      : (booking.host_check_in_confirmed_at 
          ? new Date(new Date(booking.host_check_in_confirmed_at).getTime() + 24 * 60 * 60 * 1000)
          : null);
    
    if (disputeDeadline && now > disputeDeadline) {
      return await handleDisputeWindowAfterCheckIn(supabase, booking, disputeDeadline);
    }
  }

  // 3. CHECKOUT DEADLINE (24h after scheduled checkout)
  if (booking.status === 'checked_in' && booking.full_payment_locked) {
    const checkoutDeadline = booking.check_out_deadline
      ? new Date(booking.check_out_deadline)
      : calculateDefaultCheckoutDeadline(booking);
    
    if (now > checkoutDeadline) {
      return await handleCheckoutDeadlineMissed(supabase, stripe, booking, checkoutDeadline);
    }
  }

  // 4. SETTLEMENT WINDOW EXPIRED (48h after both confirm checkout)
  if (booking.status === 'settlement_pending' || booking.escrow_status === 'ready_for_release') {
    const settlementDeadline = booking.dispute_deadline
      ? new Date(booking.dispute_deadline)
      : calculateDefaultDisputeDeadline(booking);
    
    if (settlementDeadline && now > settlementDeadline) {
      return await handleDisputeWindowExpired(supabase, stripe, booking, settlementDeadline);
    }
  }

  return null; // No action needed
}

// ============= DEADLINE CALCULATIONS =============

function calculateDefaultCheckInDeadline(booking: BookingForEnforcement): Date {
  // Default: 2 hours after scheduled check-in time
  const checkInDate = new Date(booking.check_in_date);
  const checkInTime = booking.check_in_time || '14:00';
  const [hours, minutes] = checkInTime.split(':').map(Number);
  checkInDate.setHours(hours, minutes, 0, 0);
  checkInDate.setHours(checkInDate.getHours() + 2); // 2 hour grace period
  return checkInDate;
}

function calculateDefaultRemainingPaymentDeadline(booking: BookingForEnforcement): Date {
  // Default: 30 minutes after both parties confirm check-in
  // Use the later of the two confirmation timestamps
  const hostConfirm = booking.host_check_in_confirmed_at ? new Date(booking.host_check_in_confirmed_at) : null;
  const guestConfirm = booking.guest_check_in_confirmed_at ? new Date(booking.guest_check_in_confirmed_at) : null;
  
  if (!hostConfirm || !guestConfirm) {
    // Shouldn't happen in awaiting_remaining_payment status, but fallback
    return new Date(Date.now() + 30 * 60 * 1000);
  }
  
  const laterConfirm = hostConfirm > guestConfirm ? hostConfirm : guestConfirm;
  return new Date(laterConfirm.getTime() + 30 * 60 * 1000); // 30 minutes
}

function calculateDefaultCheckoutDeadline(booking: BookingForEnforcement): Date {
  // Default: 24 hours after scheduled checkout time
  const checkOutDate = new Date(booking.check_out_date);
  const checkOutTime = booking.check_out_time || '11:00';
  const [hours, minutes] = checkOutTime.split(':').map(Number);
  checkOutDate.setHours(hours, minutes, 0, 0);
  checkOutDate.setHours(checkOutDate.getHours() + 24); // 24 hour grace period
  return checkOutDate;
}

function calculateDefaultDisputeDeadline(booking: BookingForEnforcement): Date | null {
  // Default: 48 hours after BOTH parties confirm checkout
  const hostConfirm = booking.host_check_out_confirmed_at ? new Date(booking.host_check_out_confirmed_at) : null;
  const guestConfirm = booking.guest_check_out_confirmed_at ? new Date(booking.guest_check_out_confirmed_at) : null;
  
  if (!hostConfirm || !guestConfirm) {
    return null; // Can't calculate without both confirmations
  }
  
  const laterConfirm = hostConfirm > guestConfirm ? hostConfirm : guestConfirm;
  return new Date(laterConfirm.getTime() + 48 * 60 * 60 * 1000); // 48 hours
}

// ============= ACTION HANDLERS =============

async function handleDepositPaymentDeadlineMissed(
  supabase: any,
  booking: BookingForEnforcement,
  deadline: Date
): Promise<ActionResult> {
  logStep("Processing deposit payment deadline missed", { 
    bookingId: booking.id, 
    deadline: deadline.toISOString(),
    respondedAt: booking.responded_at
  });

  const reason = "Payment deadline passed: Guest did not pay within 24 hours of booking confirmation. Booking auto-cancelled to free the property for other guests.";

  // No refund needed — no payment was ever made
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      status: "cancelled_by_system",
      cancelled_at: new Date().toISOString(),
      auto_action_taken: "deposit_deadline_cancel",
      auto_action_taken_at: new Date().toISOString(),
      refund_reason: reason,
    })
    .eq("id", booking.id);

  if (updateError) {
    throw new Error(`Failed to update booking: ${updateError.message}`);
  }

  // Notify guest
  const guestInfo = await getBookingParticipantInfo(supabase, booking.guest_id, booking.id);
  if (guestInfo?.email) {
    await sendNotificationEmail({
      type: "booking_cancelled",
      recipientEmail: guestInfo.email,
      recipientName: guestInfo.name,
      propertyTitle: guestInfo.propertyTitle,
      reason: "Your booking was automatically cancelled because the deposit was not paid within 24 hours.",
    });
  }

  // Notify host
  const hostInfo = await getBookingParticipantInfo(supabase, booking.host_id, booking.id);
  if (hostInfo?.email) {
    await sendNotificationEmail({
      type: "booking_cancelled",
      recipientEmail: hostInfo.email,
      recipientName: hostInfo.name,
      propertyTitle: hostInfo.propertyTitle,
      reason: "A booking was automatically cancelled because the guest did not pay the deposit within 24 hours. Your property is now available again.",
    });
  }

  // Create in-app notifications
  await supabase.from("notifications").insert([
    {
      user_id: booking.guest_id,
      type: "booking_cancelled",
      title: "Booking Cancelled - Deposit Not Paid",
      message: "Your booking was cancelled because the deposit was not paid within 24 hours of confirmation.",
      booking_id: booking.id,
    },
    {
      user_id: booking.host_id,
      type: "booking_cancelled",
      title: "Booking Cancelled - Guest Didn't Pay",
      message: "A booking was cancelled because the guest did not pay the deposit within 24 hours. Your property is available again.",
      booking_id: booking.id,
    },
  ]);

  // Audit log
  await supabase.from("escrow_audit_log").insert({
    booking_id: booking.id,
    action_type: "deposit_deadline_cancel",
    triggered_by: "system_cron",
    action_reason: reason,
    previous_status: booking.status,
    new_status: "cancelled_by_system",
  });

  logStep("Deposit deadline cancellation complete", { bookingId: booking.id });

  return {
    booking_id: booking.id,
    action: "deposit_deadline_cancel",
    success: true,
    details: { reason, deadline: deadline.toISOString() },
  };
}

async function handleCheckInDeadlineMissed(
  supabase: any,
  stripe: Stripe,
  booking: BookingForEnforcement,
  deadline: Date
): Promise<ActionResult> {
  logStep("Processing check-in deadline missed", { 
    bookingId: booking.id, 
    deadline: deadline.toISOString(),
    hostConfirmed: !!booking.host_check_in_confirmed_at,
    guestConfirmed: !!booking.guest_check_in_confirmed_at
  });

  let reason: string;
  if (!booking.host_check_in_confirmed_at && !booking.guest_check_in_confirmed_at) {
    reason = "Check-in deadline passed: Neither party confirmed arrival. Booking auto-cancelled with full deposit refund to guest.";
  } else if (booking.host_check_in_confirmed_at && !booking.guest_check_in_confirmed_at) {
    reason = "Check-in deadline passed: Host confirmed but guest did not arrive. Booking auto-cancelled with full deposit refund to guest (guest no-show).";
  } else {
    reason = "Check-in deadline passed: Guest confirmed but host did not confirm. Booking auto-cancelled with full deposit refund to guest (host at fault).";
  }

  // Refund the deposit to guest
  let refundResult = null;
  if (booking.stripe_payment_intent_id && booking.deposit_amount && booking.deposit_amount > 0) {
    try {
      // Check if refund already exists (idempotency check)
      const existingRefunds = await stripe.refunds.list({
        payment_intent: booking.stripe_payment_intent_id,
        limit: 1,
      });

      if (existingRefunds.data.length === 0) {
        // IDEMPOTENCY: Use booking ID as key to prevent duplicate refunds
        refundResult = await stripe.refunds.create({
          payment_intent: booking.stripe_payment_intent_id,
          amount: Math.round(booking.deposit_amount),
          reason: 'requested_by_customer',
          metadata: {
            booking_id: booking.id,
            action: 'auto_cancel_checkin_missed',
          },
        }, {
          idempotencyKey: `refund_${booking.id}_checkin_missed`,
        });
        logStep("Refund created", { refundId: refundResult.id });
      } else {
        logStep("Refund already exists", { existingRefundId: existingRefunds.data[0].id });
        refundResult = existingRefunds.data[0];
      }
    } catch (refundError) {
      const errorMsg = refundError instanceof Error ? refundError.message : String(refundError);
      logStep("Refund failed", { error: errorMsg });
      // Continue with status update even if refund fails - admin can handle manually
    }
  }

  // Update booking status
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      status: "cancelled_by_system",
      escrow_status: refundResult ? "refunded" : "pending_refund",
      cancelled_at: new Date().toISOString(),
      auto_action_taken: "checkin_deadline_cancel",
      auto_action_taken_at: new Date().toISOString(),
      refund_amount: booking.deposit_amount,
      refund_reason: reason,
      refund_status: refundResult ? "completed" : "pending",
    })
    .eq("id", booking.id);

  if (updateError) {
    throw new Error(`Failed to update booking: ${updateError.message}`);
  }

  // Send email notification to guest
  const guestInfo = await getBookingParticipantInfo(supabase, booking.guest_id, booking.id);
  if (guestInfo?.email) {
    await sendNotificationEmail({
      type: "booking_cancelled",
      recipientEmail: guestInfo.email,
      recipientName: guestInfo.name,
      propertyTitle: guestInfo.propertyTitle,
      reason: reason,
      amount: refundResult ? (booking.deposit_amount || 0) / 100 : undefined,
      currency: booking.escrow_currency?.toUpperCase() || "USD",
    });
  }

  // Send email notification to host
  const hostInfo = await getBookingParticipantInfo(supabase, booking.host_id, booking.id);
  if (hostInfo?.email) {
    await sendNotificationEmail({
      type: "booking_cancelled",
      recipientEmail: hostInfo.email,
      recipientName: hostInfo.name,
      propertyTitle: hostInfo.propertyTitle,
      reason: reason,
    });
  }

  // Create audit log
  await createAuditLog(supabase, {
    booking_id: booking.id,
    action_type: "auto_cancel",
    action_reason: reason,
    triggered_by: "cron",
    previous_status: booking.status,
    new_status: "cancelled_by_system",
    previous_escrow_status: booking.escrow_status,
    new_escrow_status: refundResult ? "refunded" : "pending_refund",
    amount_affected: booking.deposit_amount,
    stripe_refund_id: refundResult?.id,
    metadata: {
      deadline_type: "check_in",
      deadline: deadline.toISOString(),
      host_confirmed: !!booking.host_check_in_confirmed_at,
      guest_confirmed: !!booking.guest_check_in_confirmed_at,
    },
  });

  return {
    booking_id: booking.id,
    action: "auto_cancel_checkin_missed",
    success: true,
    details: { reason, refundId: refundResult?.id },
  };
}

// NEW: Handle 24h dispute window after check-in (no damage reported)
async function handleDisputeWindowAfterCheckIn(
  supabase: any,
  booking: BookingForEnforcement,
  deadline: Date
): Promise<ActionResult> {
  logStep("Processing dispute window after check-in expired", { bookingId: booking.id });

  const reason = "24-hour dispute window expired after check-in. Guest did not report any property damage. Property confirmed in good condition.";

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      check_in_condition_confirmed: true,
      guest_condition_confirmed: true,
    })
    .eq("id", booking.id);

  if (updateError) {
    throw new Error(`Failed to update booking: ${updateError.message}`);
  }

  await createAuditLog(supabase, {
    booking_id: booking.id,
    action_type: "dispute_window_closed",
    action_reason: reason,
    triggered_by: "cron",
    previous_status: booking.status,
    new_status: booking.status,
    metadata: { deadline_type: "checkin_dispute_window", deadline: deadline.toISOString() },
  });

  return {
    booking_id: booking.id,
    action: "checkin_dispute_window_closed",
    success: true,
    details: { reason },
  };
}

async function handleRemainingPaymentDeadlineMissed(
  supabase: any,
  booking: BookingForEnforcement,
  deadline: Date
): Promise<ActionResult> {
  logStep("Processing remaining payment deadline missed", { 
    bookingId: booking.id, 
    deadline: deadline.toISOString()
  });

  // ====== PHASE 2: SAFE DEPOSIT FORFEITURE - 50/50 SPLIT ======
  // Instead of 100% forfeit to host, we split:
  // - 50% → host (compensation for lost opportunity)
  // - 50% → platform hold (requires admin review before any action)
  // This protects against chargebacks and abuse while still compensating the host
  
  const depositAmount = booking.deposit_amount || 0;
  const hostCompensation = Math.round(depositAmount * 0.5);  // 50% to host (pre-calculated, not auto-released)
  const platformHold = depositAmount - hostCompensation;      // 50% held for admin review

  const reason = `Remaining payment deadline passed: Guest confirmed check-in but did not pay remaining 80% within time limit. Deposit split 50/50: ${hostCompensation} cents to host (pending admin release), ${platformHold} cents held for admin review.`;

  // Update booking with split amounts - do NOT auto-release anything
  // Admin must manually finalize the host portion
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      status: "cancelled_by_system",
      escrow_status: "forfeited_split_pending",  // New status indicating 50/50 split awaiting admin
      cancelled_at: new Date().toISOString(),
      auto_action_taken: "remaining_payment_deadline_split",
      auto_action_taken_at: new Date().toISOString(),
      host_payout_amount: hostCompensation,  // Pre-calculated for admin to release
      platform_commission: platformHold,      // Held portion
    })
    .eq("id", booking.id);

  if (updateError) {
    throw new Error(`Failed to update booking: ${updateError.message}`);
  }

  // Send email notification to guest about cancellation
  const guestInfo = await getBookingParticipantInfo(supabase, booking.guest_id, booking.id);
  if (guestInfo?.email) {
    await sendNotificationEmail({
      type: "booking_cancelled",
      recipientEmail: guestInfo.email,
      recipientName: guestInfo.name,
      propertyTitle: guestInfo.propertyTitle,
      reason: "Your booking was cancelled because the remaining payment was not completed within the required time. Your deposit has been forfeited per our terms.",
    });
  }

  // Send email notification to host about the situation
  const hostInfo = await getBookingParticipantInfo(supabase, booking.host_id, booking.id);
  if (hostInfo?.email) {
    await sendNotificationEmail({
      type: "booking_cancelled",
      recipientEmail: hostInfo.email,
      recipientName: hostInfo.name,
      propertyTitle: hostInfo.propertyTitle,
      reason: "Guest did not complete remaining payment. You will receive 50% of the deposit after admin review.",
      amount: hostCompensation / 100,
      currency: booking.escrow_currency?.toUpperCase() || "USD",
    });
  }

  await createAuditLog(supabase, {
    booking_id: booking.id,
    action_type: "auto_forfeit_split",
    action_reason: reason,
    triggered_by: "cron",
    previous_status: booking.status,
    new_status: "cancelled_by_system",
    previous_escrow_status: booking.escrow_status,
    new_escrow_status: "forfeited_split_pending",
    amount_affected: depositAmount,
    metadata: {
      deadline_type: "remaining_payment",
      deadline: deadline.toISOString(),
      remaining_amount_unpaid: booking.remaining_payment_amount,
      host_compensation: hostCompensation,
      platform_hold: platformHold,
      split_ratio: "50/50",
      requires_admin_review: true,
    },
  });

  return {
    booking_id: booking.id,
    action: "auto_forfeit_split",
    success: true,
    details: { 
      reason, 
      depositAmount,
      hostCompensation,
      platformHold,
      splitRatio: "50/50",
      requiresAdminReview: true
    },
  };
}

async function handleCheckoutDeadlineMissed(
  supabase: any,
  stripe: Stripe,
  booking: BookingForEnforcement,
  deadline: Date
): Promise<ActionResult> {
  logStep("Processing checkout deadline missed", { 
    bookingId: booking.id, 
    deadline: deadline.toISOString(),
    hostReportedDamage: booking.host_reported_damage
  });

  // If host reported damage, stay in disputed - don't auto-release
  if (booking.host_reported_damage) {
    const reason = "Checkout deadline passed with damage reported. Booking remains in disputed status pending admin review.";
    
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "disputed",
        escrow_status: "disputed",
        auto_action_taken: "checkout_deadline_disputed",
        auto_action_taken_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    if (updateError) {
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    // Send email notification to guest about the dispute
    const guestInfo = await getBookingParticipantInfo(supabase, booking.guest_id, booking.id);
    if (guestInfo?.email) {
      await sendNotificationEmail({
        type: "dispute_opened",
        recipientEmail: guestInfo.email,
        recipientName: guestInfo.name,
        propertyTitle: guestInfo.propertyTitle,
        reason: "The host has reported property damage. An admin will review and contact you.",
      });
    }

    // Send email notification to host about dispute status
    const hostInfo = await getBookingParticipantInfo(supabase, booking.host_id, booking.id);
    if (hostInfo?.email) {
      await sendNotificationEmail({
        type: "dispute_opened",
        recipientEmail: hostInfo.email,
        recipientName: hostInfo.name,
        propertyTitle: hostInfo.propertyTitle,
        reason: "Your damage report is under review. An admin will contact you soon.",
      });
    }

    await createAuditLog(supabase, {
      booking_id: booking.id,
      action_type: "auto_dispute",
      action_reason: reason,
      triggered_by: "cron",
      previous_status: booking.status,
      new_status: "disputed",
      previous_escrow_status: booking.escrow_status,
      new_escrow_status: "disputed",
      metadata: {
        deadline_type: "check_out",
        deadline: deadline.toISOString(),
        host_reported_damage: true,
      },
    });

    return {
      booking_id: booking.id,
      action: "auto_dispute_damage_reported",
      success: true,
      details: { reason },
    };
  }

  // No damage reported - auto-release to host
  const reason = "Checkout deadline passed: No damage reported by host within 24 hours of scheduled checkout. Funds auto-released to host.";
  
  return await releaseEscrowToHost(supabase, stripe, booking, reason, "checkout_deadline");
}

async function handleDisputeWindowExpired(
  supabase: any,
  stripe: Stripe,
  booking: BookingForEnforcement,
  deadline: Date
): Promise<ActionResult> {
  logStep("Processing dispute window expired", { 
    bookingId: booking.id, 
    deadline: deadline.toISOString()
  });

  const reason = "Dispute window expired: Both parties confirmed checkout and 48-hour dispute window passed without issues. Funds auto-released to host.";
  
  return await releaseEscrowToHost(supabase, stripe, booking, reason, "dispute_window");
}

async function releaseEscrowToHost(
  supabase: any,
  stripe: Stripe,
  booking: BookingForEnforcement,
  reason: string,
  deadlineType: string
): Promise<ActionResult> {
  // Get host's Stripe account
  const { data: hostProfile, error: hostError } = await supabase
    .from("profiles")
    .select("stripe_account_id, stripe_onboarding_complete")
    .eq("id", booking.host_id)
    .single();

  if (hostError || !hostProfile?.stripe_account_id || !hostProfile?.stripe_onboarding_complete) {
    // Can't release - mark for manual admin action
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "settlement_pending",
        escrow_status: "release_pending_host_setup",
        auto_action_taken: `${deadlineType}_release_blocked`,
        auto_action_taken_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    await createAuditLog(supabase, {
      booking_id: booking.id,
      action_type: "auto_release_blocked",
      action_reason: `${reason} However, release blocked because host Stripe account not set up. Admin action required.`,
      triggered_by: "cron",
      previous_status: booking.status,
      new_status: "settlement_pending",
      previous_escrow_status: booking.escrow_status,
      new_escrow_status: "release_pending_host_setup",
      metadata: { deadline_type: deadlineType, host_stripe_missing: true },
    });

    return {
      booking_id: booking.id,
      action: "auto_release_blocked",
      success: false,
      error: "Host Stripe account not set up",
      details: { reason },
    };
  }

  // Get dynamic platform fee rate from database
  const { data: feeRateData } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'platform_fee_rate')
    .single();
  
  const platformFeeRate = feeRateData?.value ? parseFloat(feeRateData.value) : 0.09; // Default 9%
  
  // Calculate payout
  const totalAmount = booking.full_payment_locked 
    ? (booking.deposit_amount || 0) + (booking.remaining_payment_amount || 0)
    : (booking.deposit_amount || 0);
  const platformCommission = Math.round(totalAmount * platformFeeRate);
  const hostPayout = totalAmount - platformCommission;

  if (hostPayout <= 0) {
    throw new Error("Invalid payout amount");
  }

  // Check for existing transfer (idempotency)
  const existingTransfers = await stripe.transfers.list({
    transfer_group: `booking_${booking.id}`,
    limit: 1,
  });

  let transfer;
  if (existingTransfers.data.length > 0) {
    logStep("Transfer already exists", { transferId: existingTransfers.data[0].id });
    transfer = existingTransfers.data[0];
  } else {
    // Create transfer to host with IDEMPOTENCY KEY
    transfer = await stripe.transfers.create({
      amount: hostPayout,
      currency: booking.escrow_currency || "usd",
      destination: hostProfile.stripe_account_id,
      transfer_group: `booking_${booking.id}`,
      metadata: {
        booking_id: booking.id,
        host_id: booking.host_id,
        type: "escrow_auto_release",
        deadline_type: deadlineType,
      },
    }, {
      idempotencyKey: `transfer_${booking.id}_${deadlineType}`,
    });
    logStep("Transfer created", { transferId: transfer.id, amount: hostPayout });
  }

  // Update booking
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      status: "settled",
      escrow_status: "released",
      escrow_released_at: new Date().toISOString(),
      settled_at: new Date().toISOString(),
      stripe_transfer_id: transfer.id,
      host_payout_amount: hostPayout,
      platform_commission: platformCommission,
      auto_action_taken: `${deadlineType}_auto_release`,
      auto_action_taken_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (updateError) {
    console.error("CRITICAL: Transfer created but booking update failed", {
      transferId: transfer.id,
      bookingId: booking.id,
    });
    throw new Error(`Failed to update booking after transfer: ${updateError.message}`);
  }

  // Send email notification to host about funds release
  const hostInfo = await getBookingParticipantInfo(supabase, booking.host_id, booking.id);
  if (hostInfo?.email) {
    await sendNotificationEmail({
      type: "payment_released",
      recipientEmail: hostInfo.email,
      recipientName: hostInfo.name,
      propertyTitle: hostInfo.propertyTitle,
      amount: hostPayout / 100,
      currency: (booking.escrow_currency || "usd").toUpperCase(),
    });
  }

  // Send settlement complete notification to guest
  const guestInfo = await getBookingParticipantInfo(supabase, booking.guest_id, booking.id);
  if (guestInfo?.email) {
    await sendNotificationEmail({
      type: "checked_out",
      recipientEmail: guestInfo.email,
      recipientName: guestInfo.name,
      propertyTitle: guestInfo.propertyTitle,
      message: "Your booking has been settled. Thank you for staying with us!",
    });
  }

  await createAuditLog(supabase, {
    booking_id: booking.id,
    action_type: "auto_release",
    action_reason: reason,
    triggered_by: "cron",
    previous_status: booking.status,
    new_status: "settled",
    previous_escrow_status: booking.escrow_status,
    new_escrow_status: "released",
    amount_affected: hostPayout,
    stripe_transfer_id: transfer.id,
    metadata: {
      deadline_type: deadlineType,
      total_amount: totalAmount,
      platform_commission: platformCommission,
      host_payout: hostPayout,
    },
  });

  return {
    booking_id: booking.id,
    action: `auto_release_${deadlineType}`,
    success: true,
    details: {
      reason,
      transferId: transfer.id,
      hostPayout,
      platformCommission,
    },
  };
}

// ============= UTILITIES =============

async function createAuditLog(supabase: any, log: {
  booking_id: string;
  action_type: string;
  action_reason: string;
  triggered_by: string;
  triggered_by_user_id?: string;
  previous_status?: string;
  new_status?: string;
  previous_escrow_status?: string;
  new_escrow_status?: string;
  amount_affected?: number;
  stripe_transfer_id?: string;
  stripe_refund_id?: string;
  metadata?: any;
}): Promise<void> {
  const { error } = await supabase.from("escrow_audit_log").insert(log);
  if (error) {
    console.error("Failed to create audit log", { error: error.message, log });
    // Don't throw - audit log failure shouldn't block the action
  } else {
    logStep("Audit log created", { action: log.action_type, bookingId: log.booking_id });
  }
}
