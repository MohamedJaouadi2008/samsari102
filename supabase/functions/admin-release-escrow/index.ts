import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-RELEASE-ESCROW] ${step}${detailsStr}`);
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

    // Verify user is admin using service role client
    const { data: adminRole, error: adminError } = await supabaseClient
      .from("admin_roles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (adminError || !adminRole) {
      logStep("Not admin", { error: adminError?.message });
      throw new Error("Admin access required");
    }
    logStep("Admin verified");

    const { 
      bookingId, 
      action, // 'release', 'refund_guest', 'partial_release'
      hostAmount, // for partial_release
      guestRefundAmount, // for partial or full refund
      reason, // admin notes
      strikeHost, // issue strike to host
      strikeGuest // issue strike to guest
    } = await req.json();

    logStep("Request params", { bookingId, action, hostAmount, guestRefundAmount, strikeHost, strikeGuest });

    if (!bookingId || !action) {
      throw new Error("Missing required fields: bookingId and action");
    }

    // ADMIN ACTION REQUIRES REASON
    if (!reason || reason.trim().length < 10) {
      throw new Error("Admin actions require a reason of at least 10 characters");
    }

    // Validate action type
    const validActions = ['release', 'refund_guest', 'partial_release'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid action: ${action}. Valid actions: ${validActions.join(', ')}`);
    }

    // Validate amounts for partial release
    if (action === 'partial_release') {
      const hostAmt = parseFloat(hostAmount) || 0;
      const guestAmt = parseFloat(guestRefundAmount) || 0;
      if (hostAmt <= 0 && guestAmt <= 0) {
        throw new Error("Partial release requires at least one positive amount");
      }
    }

    // Validate strike has reason
    if ((strikeHost || strikeGuest) && reason.trim().length < 20) {
      throw new Error("Strikes require a detailed reason (at least 20 characters)");
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      logStep("Booking not found", { error: bookingError?.message });
      throw new Error("Booking not found");
    }

    // Verify escrow is in releasable state
    if (!['held', 'disputed', 'ready_for_release', 'pending_manual_payout', 'release_pending_host_setup', 'forfeited_split_pending', 'forfeited_pending_release'].includes(booking.escrow_status || '')) {
      throw new Error(`Cannot release escrow in status: ${booking.escrow_status}`);
    }

    const currency = booking.escrow_currency || 'usd';
    const now = new Date().toISOString();
    
    // Get host's Stripe Connect account
    const { data: hostProfile, error: hostError } = await supabaseClient
      .from("profiles")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("id", booking.host_id)
      .single();

    logStep("Host profile", { 
      hasStripe: !!hostProfile?.stripe_account_id, 
      onboardingComplete: hostProfile?.stripe_onboarding_complete 
    });

    // Get dynamic platform fee rate from database
    const { data: feeRateData } = await supabaseClient
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_fee_rate')
      .single();
    
    const platformFeeRate = feeRateData?.value ? parseFloat(feeRateData.value) : 0.09; // Default 9%
    
    // Calculate amounts
    const depositAmount = booking.deposit_amount || 0;
    const remainingAmount = booking.remaining_payment_amount || 0;
    const totalEscrowAmount = depositAmount + remainingAmount;
    const platformCommission = Math.round(totalEscrowAmount * platformFeeRate);

    let transferResult = null;
    let refundResult = null;
    let updateData: any = {
      settled_at: now,
      escrow_released_at: now,
    };

    if (action === 'release') {
      // Full release to host (minus commission)
      const hostPayout = totalEscrowAmount - platformCommission;
      
      if (hostProfile?.stripe_account_id && hostProfile?.stripe_onboarding_complete) {
        // Check for existing transfer (idempotency)
        const existingTransfers = await stripe.transfers.list({
          transfer_group: `booking_${booking.id}`,
          limit: 1,
        });

        if (existingTransfers.data.length > 0) {
          logStep("Transfer already exists - idempotency protected", { 
            transferId: existingTransfers.data[0].id 
          });
          transferResult = existingTransfers.data[0];
        } else {
          logStep("Creating transfer to host", { amount: hostPayout });
          
          transferResult = await stripe.transfers.create({
            amount: Math.round(hostPayout * 100), // Convert to cents
            currency: currency,
            destination: hostProfile.stripe_account_id,
            transfer_group: `booking_${booking.id}`,
            metadata: {
              booking_id: booking.id,
              host_id: booking.host_id,
              type: "admin_escrow_release",
              admin_id: user.id,
              reason: reason || "Admin approved release"
            },
          }, {
            idempotencyKey: `admin_release_${booking.id}_${user.id}`,
          });
          
          logStep("Transfer created", { transferId: transferResult.id });
        }
        
        updateData.escrow_status = 'released';
        updateData.stripe_transfer_id = transferResult.id;
        updateData.host_payout_amount = hostPayout;
        updateData.platform_commission = platformCommission;
        updateData.status = 'settled';
      } else {
        logStep("Host has no Stripe account - marking for manual payout");
        updateData.escrow_status = 'pending_manual_payout';
        updateData.host_payout_amount = hostPayout;
        updateData.platform_commission = platformCommission;
      }
    } else if (action === 'refund_guest') {
      // Full refund to guest
      if (booking.stripe_payment_intent_id) {
        // Check for existing refund (idempotency)
        const existingRefunds = await stripe.refunds.list({
          payment_intent: booking.stripe_payment_intent_id,
          limit: 10,
        });
        
        const totalExistingRefunds = existingRefunds.data
          .filter(r => r.status === 'succeeded' || r.status === 'pending')
          .reduce((sum, r) => sum + r.amount, 0);
        
        const remainingToRefund = Math.round(totalEscrowAmount * 100) - totalExistingRefunds;
        
        if (remainingToRefund > 0) {
          logStep("Creating refund to guest", { amount: remainingToRefund });
          
          refundResult = await stripe.refunds.create({
            payment_intent: booking.stripe_payment_intent_id,
            amount: remainingToRefund,
            reason: 'requested_by_customer',
            metadata: {
              booking_id: booking.id,
              admin_id: user.id,
              reason: reason || "Admin approved refund"
            }
          }, {
            idempotencyKey: `admin_refund_${booking.id}_${user.id}`,
          });
          
          logStep("Refund created", { refundId: refundResult.id });
        } else {
          logStep("Already fully refunded - idempotency protected");
        }
      }
      
      updateData.escrow_status = 'refunded';
      updateData.refund_amount = totalEscrowAmount;
      updateData.refund_reason = reason || 'Admin decision';
      updateData.refund_status = 'refunded';
      updateData.status = 'refunded';
      
    } else if (action === 'partial_release') {
      // Split between host and guest
      const hostPayoutAmount = hostAmount || 0;
      const guestRefund = guestRefundAmount || 0;
      
      // Transfer to host
      if (hostPayoutAmount > 0 && hostProfile?.stripe_account_id && hostProfile?.stripe_onboarding_complete) {
        const actualHostPayout = hostPayoutAmount - Math.round(hostPayoutAmount * platformFeeRate);
        
        transferResult = await stripe.transfers.create({
          amount: Math.round(actualHostPayout * 100),
          currency: currency,
          destination: hostProfile.stripe_account_id,
          transfer_group: `booking_${booking.id}`,
          metadata: {
            booking_id: booking.id,
            type: "admin_partial_release",
            admin_id: user.id
          },
        });
        
        updateData.host_payout_amount = actualHostPayout;
        updateData.stripe_transfer_id = transferResult.id;
      }
      
      // Refund to guest
      if (guestRefund > 0 && booking.stripe_payment_intent_id) {
        refundResult = await stripe.refunds.create({
          payment_intent: booking.stripe_payment_intent_id,
          amount: Math.round(guestRefund * 100),
          metadata: {
            booking_id: booking.id,
            admin_id: user.id,
            type: "partial_refund"
          }
        });
        
        updateData.refund_amount = guestRefund;
        updateData.refund_status = 'partial_refund';
      }
      
      updateData.escrow_status = 'released';
      updateData.status = 'settled';
    }

    // Update booking
    const { error: updateError } = await supabaseClient
      .from("bookings")
      .update(updateData)
      .eq("id", bookingId);

    if (updateError) {
      logStep("Update error", { error: updateError.message });
      // Critical: payment was made but DB update failed
      console.error("CRITICAL: Payment processed but booking update failed", { 
        bookingId, 
        transferId: transferResult?.id,
        refundId: refundResult?.id
      });
    }

    // Issue strikes if requested
    if (strikeHost) {
      await supabaseClient
        .from("profiles")
        .update({
          host_strikes: (await supabaseClient.from("profiles").select("host_strikes").eq("id", booking.host_id).single()).data?.host_strikes + 1 || 1,
          last_strike_at: now,
          strike_reason: reason || 'Admin action'
        })
        .eq("id", booking.host_id);
      logStep("Host strike issued");
    }

    if (strikeGuest) {
      await supabaseClient
        .from("profiles")
        .update({
          guest_strikes: (await supabaseClient.from("profiles").select("guest_strikes").eq("id", booking.guest_id).single()).data?.guest_strikes + 1 || 1,
          last_strike_at: now,
          strike_reason: reason || 'Admin action'
        })
        .eq("id", booking.guest_id);
      logStep("Guest strike issued");
    }

    logStep("Escrow action completed", { action, transferId: transferResult?.id, refundId: refundResult?.id });

    return new Response(
      JSON.stringify({ 
        success: true,
        action,
        transferId: transferResult?.id,
        refundId: refundResult?.id,
        message: `Escrow ${action} completed successfully`
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