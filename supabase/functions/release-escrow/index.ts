import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RELEASE-ESCROW] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // === A01 AUTHORIZATION GUARD ===
    // This function is server-only. Block direct client calls.
    // Accept either: (1) cron secret, or (2) authenticated admin JWT.
    const cronSecretHeader = req.headers.get("x-cron-secret");
    const expectedCronSecret = Deno.env.get("CRON_SECRET");
    let authorized = false;

    if (expectedCronSecret && cronSecretHeader && cronSecretHeader === expectedCronSecret) {
      authorized = true;
      logStep("Authorized via cron secret");
    } else {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7)
        : null;
      if (token) {
        const tmpClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          { auth: { persistSession: false } }
        );
        const { data: userData } = await tmpClient.auth.getUser(token);
        if (userData?.user) {
          const { data: adminRole } = await tmpClient
            .from("admin_roles")
            .select("id")
            .eq("user_id", userData.user.id)
            .maybeSingle();
          if (adminRole) {
            authorized = true;
            logStep("Authorized via admin JWT", { userId: userData.user.id });
          }
        }
      }
    }

    if (!authorized) {
      logStep("UNAUTHORIZED escrow release attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { bookingId, adminOverride } = await req.json();

    if (!bookingId) {
      throw new Error("Booking ID required");
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .select(`
        id,
        host_id,
        status,
        escrow_status,
        deposit_amount,
        host_payout_amount,
        platform_commission,
        stripe_payment_intent_id,
        host_stripe_account_id,
        check_out_date
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      logStep("Booking not found", { error: bookingError?.message });
      throw new Error("Booking not found");
    }

    logStep("Booking found", { 
      id: booking.id, 
      status: booking.status,
      escrowStatus: booking.escrow_status,
      depositAmount: booking.deposit_amount
    });

    // STRICT STATE VALIDATION: Validate booking can have escrow released
    const validEscrowStates = ['held', 'ready_for_release'];
    if (!validEscrowStates.includes(booking.escrow_status || '') && !adminOverride) {
      logStep("Invalid escrow state", { currentStatus: booking.escrow_status });
      throw new Error(`Cannot release escrow in status: ${booking.escrow_status}. Valid states: ${validEscrowStates.join(', ')}`);
    }

    if (booking.escrow_status === "released") {
      throw new Error("Escrow already released - duplicate release prevented");
    }

    // DUAL CHECKOUT CONFIRMATION: Both parties must have confirmed checkout
    // This is retrieved from booking but we need to fetch the full booking
    const { data: fullBooking } = await supabaseClient
      .from("bookings")
      .select("host_check_out_confirmed_at, guest_check_out_confirmed_at, full_payment_locked, status")
      .eq("id", bookingId)
      .single();

    if (!adminOverride) {
      if (!fullBooking?.host_check_out_confirmed_at) {
        throw new Error("Host must confirm checkout before funds can be released");
      }
      if (!fullBooking?.guest_check_out_confirmed_at) {
        throw new Error("Guest must confirm checkout before funds can be released");
      }
      if (!fullBooking?.full_payment_locked) {
        throw new Error("Full payment must be locked before release");
      }
    }

    // Check if checkout date has passed (allow 24 hour buffer for disputes)
    const checkOutDate = new Date(booking.check_out_date);
    const releaseDate = new Date(checkOutDate);
    releaseDate.setHours(releaseDate.getHours() + 24); // 24 hour dispute window

    if (new Date() < releaseDate && !adminOverride) {
      const hoursRemaining = Math.ceil((releaseDate.getTime() - new Date().getTime()) / (1000 * 60 * 60));
      logStep("Too early to release", { checkOutDate: booking.check_out_date, releaseDate, hoursRemaining });
      throw new Error(`Escrow cannot be released yet. 24 hour dispute window still active (${hoursRemaining}h remaining).`);
    }

    // Get host's profile including payout method
    const { data: hostProfile, error: hostError } = await supabaseClient
      .from("profiles")
      .select("stripe_account_id, stripe_onboarding_complete, payout_method, bank_rib, bank_name, bank_account_holder, full_name")
      .eq("id", booking.host_id)
      .single();

    if (hostError || !hostProfile) {
      logStep("Host profile not found", { error: hostError?.message });
      throw new Error("Host profile not found");
    }

    const usesBankTransfer = hostProfile.payout_method === 'bank_transfer' && hostProfile.bank_rib;
    const usesStripe = hostProfile.stripe_account_id && hostProfile.stripe_onboarding_complete;

    if (!usesBankTransfer && !usesStripe) {
      logStep("Host has no payout method configured", { 
        payoutMethod: hostProfile.payout_method,
        hasStripe: !!hostProfile.stripe_account_id,
        hasBankRib: !!hostProfile.bank_rib
      });
      throw new Error("Host has no payout method configured. Cannot release funds.");
    }

    // Get dynamic platform fee rate from database
    const { data: feeRateData } = await supabaseClient
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_fee_rate')
      .single();
    
    const platformFeeRate = feeRateData?.value ? parseFloat(feeRateData.value) : 0.09; // Default 9%
    
    // Calculate payout amount (deposit - platform commission)
    const depositAmount = booking.deposit_amount || 0;
    const platformCommission = booking.platform_commission || Math.round(depositAmount * platformFeeRate);
    const hostPayout = depositAmount - platformCommission;

    if (hostPayout <= 0) {
      throw new Error("Invalid payout amount");
    }

    logStep("Calculating payout", { 
      depositAmount, 
      platformCommission, 
      hostPayout 
    });

    let transferId: string | null = null;
    let payoutMethod = 'stripe';

    if (usesStripe) {
      // ====== STRIPE CONNECT PAYOUT ======
      logStep("Using Stripe Connect payout");

      // Check for existing transfer (idempotency check)
      const existingTransfers = await stripe.transfers.list({
        transfer_group: `booking_${booking.id}`,
        limit: 1,
      });

      let transfer;
      if (existingTransfers.data.length > 0) {
        logStep("Transfer already exists - idempotency protected", { 
          transferId: existingTransfers.data[0].id 
        });
        transfer = existingTransfers.data[0];
      } else {
        logStep("Creating transfer to host", { 
          amount: hostPayout,
          destination: hostProfile.stripe_account_id 
        });

        transfer = await stripe.transfers.create({
          amount: hostPayout,
          currency: "usd",
          destination: hostProfile.stripe_account_id,
          transfer_group: `booking_${booking.id}`,
          metadata: {
            booking_id: booking.id,
            host_id: booking.host_id,
            type: "escrow_release",
          },
        }, {
          idempotencyKey: `transfer_${booking.id}_release`,
        });

        logStep("Transfer created", { transferId: transfer.id });
      }

      transferId = transfer.id;
      payoutMethod = 'stripe';

    } else if (usesBankTransfer) {
      // ====== BANK TRANSFER PAYOUT ======
      logStep("Using Bank Transfer payout", {
        bank: hostProfile.bank_name,
        rib: hostProfile.bank_rib ? `${hostProfile.bank_rib.slice(0, 4)}****` : 'N/A'
      });

      payoutMethod = 'bank_transfer';

      // Trigger bank payout function
      try {
        const payoutResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-bank-payout`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              bookingId: booking.id,
              amount: hostPayout / 100, // Convert cents to currency units
              currency: 'TND',
              triggeredBy: 'system',
            }),
          }
        );

        const payoutResult = await payoutResponse.json();
        logStep("Bank payout result", payoutResult);
        transferId = payoutResult.reference || null;
      } catch (payoutError) {
        logStep("Bank payout trigger failed - will need manual processing", { 
          error: (payoutError as Error).message 
        });
        // Don't fail the escrow release - just mark for manual payout
        transferId = `manual_pending_${booking.id}`;
      }
    }

    // Update booking with transfer info
    const { error: updateError } = await supabaseClient
      .from("bookings")
      .update({
        escrow_status: "released",
        escrow_released_at: new Date().toISOString(),
        stripe_transfer_id: transferId,
        host_payout_amount: hostPayout,
        platform_commission: platformCommission,
        settled_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    if (updateError) {
      logStep("Failed to update booking", { error: updateError.message });
      console.error("CRITICAL: Transfer created but booking update failed", { 
        transferId, 
        bookingId: booking.id 
      });
    }

    logStep("Escrow released successfully", { 
      transferId,
      payoutMethod,
      hostPayout,
      platformCommission
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        transferId,
        payoutMethod,
        hostPayout,
        platformCommission,
        message: payoutMethod === 'stripe' 
          ? "Escrow released to host via Stripe" 
          : "Escrow released - bank payout initiated"
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
