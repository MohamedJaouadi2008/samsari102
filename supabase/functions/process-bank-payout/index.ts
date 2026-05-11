import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[BANK-PAYOUT] ${step}${detailsStr}`);
};

// ============================================================================
// PLUGGABLE PROVIDER INTERFACE
// When you integrate a real provider (Flouci, Konnect, etc.), implement this:
// ============================================================================
interface PayoutResult {
  success: boolean;
  reference: string | null;
  provider: string;
  error: string | null;
}

interface BankDetails {
  accountHolder: string;
  bankName: string;
  rib: string;
}

// PLACEHOLDER: Replace with actual provider API call
async function sendBankPayout(
  amount: number,
  currency: string,
  bankDetails: BankDetails,
  bookingId: string
): Promise<PayoutResult> {
  // ============================================================================
  // TODO: Integrate your payment provider here
  // 
  // Example for Flouci:
  //   const FLOUCI_API_KEY = Deno.env.get("FLOUCI_API_KEY");
  //   const response = await fetch("https://api.flouci.com/v1/payouts", {
  //     method: "POST",
  //     headers: { "Authorization": `Bearer ${FLOUCI_API_KEY}`, "Content-Type": "application/json" },
  //     body: JSON.stringify({
  //       amount: amount * 1000, // Flouci uses millimes
  //       rib: bankDetails.rib,
  //       beneficiary: bankDetails.accountHolder,
  //       reference: `samsari_${bookingId}`,
  //     })
  //   });
  //   const data = await response.json();
  //   return { success: response.ok, reference: data.id, provider: "flouci", error: data.error || null };
  //
  // Example for Konnect:
  //   const KONNECT_API_KEY = Deno.env.get("KONNECT_API_KEY");
  //   const response = await fetch("https://api.konnect.network/api/v2/disbursements", { ... });
  // ============================================================================

  logStep("PROVIDER NOT CONFIGURED - payout queued for manual processing", {
    amount, currency, bookingId,
    rib: bankDetails.rib ? `${bankDetails.rib.slice(0, 4)}****${bankDetails.rib.slice(-4)}` : 'N/A'
  });

  return {
    success: false,
    reference: `manual_${bookingId}_${Date.now()}`,
    provider: "manual",
    error: "No automated payout provider configured. Payout queued for manual processing."
  };
}

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

    // === AUTHORIZATION GUARD ===
    // Accept either:
    //   1) x-cron-secret header matching CRON_SECRET (system/cron caller), OR
    //   2) Authenticated admin/moderator JWT
    const cronSecretHeader = req.headers.get("x-cron-secret");
    const expectedCronSecret = Deno.env.get("CRON_SECRET");
    let authorized = false;
    let triggeredByUserId: string | null = null;

    if (expectedCronSecret && cronSecretHeader && cronSecretHeader === expectedCronSecret) {
      authorized = true;
      logStep("Authorized via cron secret");
    } else {
      const authHeader = req.headers.get("authorization") ?? "";
      const token = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7)
        : null;
      if (token) {
        const { data: userData, error: userErr } = await supabaseClient.auth.getUser(token);
        if (!userErr && userData?.user) {
          const { data: isAdminData } = await supabaseClient.rpc("is_admin_or_moderator");
          if (isAdminData === true) {
            authorized = true;
            triggeredByUserId = userData.user.id;
            logStep("Authorized via admin JWT", { userId: triggeredByUserId });
          }
        }
      }
    }

    if (!authorized) {
      logStep("UNAUTHORIZED payout attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { bookingId, amount, currency = 'TND', triggeredBy = 'system' } = await req.json();

    // Strict input validation
    if (typeof bookingId !== "string" || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
      return new Response(
        JSON.stringify({ error: "Invalid bookingId" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
      return new Response(
        JSON.stringify({ error: "Invalid currency" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    logStep("Processing payout", { bookingId, amount, currency });

    // Get booking
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .select("id, host_id, status, escrow_status, bank_payout_status")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found");
    }

    // Prevent duplicate payouts
    if (booking.bank_payout_status === 'completed') {
      logStep("Payout already completed - idempotency check");
      return new Response(
        JSON.stringify({ success: true, message: "Payout already completed", duplicate: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get host's bank details
    const { data: hostProfile, error: hostError } = await supabaseClient
      .from("profiles")
      .select("full_name, bank_account_holder, bank_name, bank_rib, payout_method")
      .eq("id", booking.host_id)
      .single();

    if (hostError || !hostProfile) {
      throw new Error("Host profile not found");
    }

    if (hostProfile.payout_method !== 'bank_transfer') {
      throw new Error("Host payout method is not bank transfer");
    }

    if (!hostProfile.bank_rib) {
      throw new Error("Host has no bank RIB/IBAN configured");
    }

    const bankDetails: BankDetails = {
      accountHolder: hostProfile.bank_account_holder || hostProfile.full_name || 'Unknown',
      bankName: hostProfile.bank_name || 'Unknown',
      rib: hostProfile.bank_rib,
    };

    logStep("Host bank details found", { 
      holder: bankDetails.accountHolder,
      bank: bankDetails.bankName,
      rib: `${bankDetails.rib.slice(0, 4)}****`
    });

    // Mark as processing
    await supabaseClient
      .from("bookings")
      .update({
        bank_payout_status: 'processing',
        bank_payout_amount: amount,
        bank_payout_currency: currency,
        bank_payout_initiated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    // Attempt payout via provider
    const result = await sendBankPayout(amount, currency, bankDetails, bookingId);

    logStep("Payout result", result);

    // Update booking with result
    const updateData: Record<string, unknown> = {
      bank_payout_status: result.success ? 'completed' : 'pending_manual',
      bank_payout_reference: result.reference,
      bank_payout_provider: result.provider,
    };

    if (result.success) {
      updateData.bank_payout_completed_at = new Date().toISOString();
    } else {
      updateData.bank_payout_error = result.error;
    }

    await supabaseClient
      .from("bookings")
      .update(updateData)
      .eq("id", bookingId);

    // Log to audit trail
    await supabaseClient.from("escrow_audit_log").insert({
      booking_id: bookingId,
      action_type: result.success ? 'bank_payout_completed' : 'bank_payout_queued',
      action_reason: result.success 
        ? `Bank payout of ${amount} ${currency} sent via ${result.provider}` 
        : `Bank payout queued for manual processing: ${result.error}`,
      triggered_by: triggeredBy,
      amount_affected: Math.round(amount * 100),
      metadata: {
        provider: result.provider,
        reference: result.reference,
        currency,
        bank_name: bankDetails.bankName,
        rib_masked: `${bankDetails.rib.slice(0, 4)}****${bankDetails.rib.slice(-4)}`,
      }
    });

    // Notify admins if manual processing needed
    if (!result.success) {
      const { data: admins } = await supabaseClient
        .from("admin_roles")
        .select("user_id");

      if (admins && admins.length > 0) {
        const notifications = admins.filter(a => a.user_id).map(admin => ({
          user_id: admin.user_id!,
          type: 'bank_payout_manual',
          title: 'Bank Payout Requires Manual Processing',
          message: `Payout of ${amount} ${currency} to ${bankDetails.accountHolder} (${bankDetails.bankName}) needs manual bank transfer. RIB: ${bankDetails.rib}`,
          booking_id: bookingId,
          link: '/admin',
        }));

        await supabaseClient.from("notifications").insert(notifications);
      }
    }

    // Notify host
    await supabaseClient.from("notifications").insert({
      user_id: booking.host_id,
      type: result.success ? 'payout_sent' : 'payout_processing',
      title: result.success ? 'Payout Sent' : 'Payout Being Processed',
      message: result.success 
        ? `Your payout of ${amount} ${currency} has been sent to your bank account (${bankDetails.bankName}).`
        : `Your payout of ${amount} ${currency} is being processed and will be sent to your bank account shortly.`,
      booking_id: bookingId,
      link: '/profile?tab=requests',
    });

    return new Response(
      JSON.stringify({
        success: result.success,
        status: result.success ? 'completed' : 'pending_manual',
        reference: result.reference,
        provider: result.provider,
        message: result.success 
          ? `Payout of ${amount} ${currency} sent successfully`
          : `Payout queued for manual processing. Admins notified.`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
