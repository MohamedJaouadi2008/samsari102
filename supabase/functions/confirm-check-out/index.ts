import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONFIRM-CHECK-OUT] ${step}${detailsStr}`);
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

    // Get user from auth header
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }
    logStep("User authenticated", { userId: user.id });

    const { 
      bookingId, 
      role, // 'host' or 'guest'
      propertyConditionOk, // both: confirm property in good condition
      damageReported, // host only: report damage
      damageDescription, // host only
      damagePhotos // host only
    } = await req.json();

    logStep("Request params", { bookingId, role, propertyConditionOk, damageReported });

    if (!bookingId || !role) {
      throw new Error("Missing required fields");
    }

    if (!['host', 'guest'].includes(role)) {
      throw new Error("Invalid role");
    }

    // Get booking and verify access
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      logStep("Booking not found", { error: bookingError?.message });
      throw new Error("Booking not found");
    }

    // Verify user is part of this booking
    if (role === 'host' && booking.host_id !== user.id) {
      throw new Error("Not authorized - not the host");
    }
    if (role === 'guest' && booking.guest_id !== user.id) {
      throw new Error("Not authorized - not the guest");
    }

    // STRICT STATE VALIDATION: Only allow checkout from checked_in state
    if (booking.status !== 'checked_in') {
      logStep("Invalid state for check-out", { currentStatus: booking.status });
      throw new Error(`Cannot confirm check-out in status: ${booking.status}. Must be 'checked_in'.`);
    }

    // Verify full payment is locked before allowing checkout
    if (!booking.full_payment_locked) {
      throw new Error("Cannot check out - full payment not locked. Guest must pay remaining amount first.");
    }

    // Prevent duplicate confirmation
    if (role === 'host' && booking.host_check_out_confirmed_at) {
      throw new Error("Host has already confirmed check-out");
    }
    if (role === 'guest' && booking.guest_check_out_confirmed_at) {
      throw new Error("Guest has already confirmed check-out");
    }

    // EVIDENCE REQUIREMENT: Host cannot report damage without photos
    if (role === 'host' && damageReported) {
      const photos = damagePhotos || [];
      if (!Array.isArray(photos) || photos.length === 0) {
        throw new Error("Damage report requires photo evidence. Please upload at least one photo.");
      }
      if (!damageDescription || damageDescription.trim().length < 10) {
        throw new Error("Damage description must be at least 10 characters");
      }
      // Validate photo size - max 10 photos, each URL max 2000 chars
      if (photos.length > 10) {
        throw new Error("Maximum 10 damage photos allowed");
      }
      for (const photoUrl of photos) {
        if (typeof photoUrl !== 'string' || photoUrl.length > 2000) {
          throw new Error("Invalid photo URL format");
        }
      }
    }

    const now = new Date().toISOString();
    const updateData: any = {};

    if (role === 'host') {
      updateData.host_check_out_confirmed_at = now;
      
      if (damageReported) {
        updateData.host_reported_damage = true;
        updateData.host_damage_description = damageDescription || null;
        updateData.host_damage_photos = damagePhotos || [];
        logStep("Host reported damage", { damageDescription });
      } else {
        updateData.host_reported_damage = false;
        logStep("Host confirmed no damage");
      }
    } else if (role === 'guest') {
      updateData.guest_check_out_confirmed_at = now;
      updateData.guest_condition_confirmed = propertyConditionOk === true;
      logStep("Guest confirmed checkout", { propertyConditionOk });
    }

    // Update booking
    const { error: updateError } = await supabaseClient
      .from("bookings")
      .update(updateData)
      .eq("id", bookingId);

    if (updateError) {
      logStep("Update error", { error: updateError.message });
      throw new Error("Failed to update booking");
    }

    // Check if both parties have confirmed
    const updatedBooking = {
      ...booking,
      ...updateData
    };

    const hostConfirmed = updatedBooking.host_check_out_confirmed_at || booking.host_check_out_confirmed_at;
    const guestConfirmed = updatedBooking.guest_check_out_confirmed_at || booking.guest_check_out_confirmed_at;
    const bothConfirmed = hostConfirmed && guestConfirmed;

    logStep("Confirmation status", { hostConfirmed: !!hostConfirmed, guestConfirmed: !!guestConfirmed, bothConfirmed });

    let fundsReleased = false;
    let disputeMode = false;

    if (bothConfirmed) {
      // Check for damage reports or condition mismatch
      const hostReportedDamage = updatedBooking.host_reported_damage || booking.host_reported_damage;
      const guestConfirmedOk = updatedBooking.guest_condition_confirmed && !hostReportedDamage;

      if (hostReportedDamage) {
        // Host reported damage - enter dispute mode
        logStep("Host reported damage - entering dispute mode");
        await supabaseClient
          .from("bookings")
          .update({ 
            status: 'disputed',
            dispute_opened_at: now,
            dispute_filed_by: 'host',
            escrow_status: 'disputed'
          })
          .eq("id", bookingId);
        
        disputeMode = true;
      } else if (guestConfirmedOk) {
        // Both confirmed OK - release funds automatically
        logStep("Both confirmed OK - funds can be released");
        
        // Calculate dispute deadline: 48 hours from now
        const disputeDeadline = new Date();
        disputeDeadline.setHours(disputeDeadline.getHours() + 48);

        await supabaseClient
          .from("bookings")
          .update({ 
            status: 'settlement_pending',
            actual_check_out: now,
            settlement_due_at: disputeDeadline.toISOString(),
            dispute_deadline: disputeDeadline.toISOString(),
            escrow_status: 'ready_for_release'
          })
          .eq("id", bookingId);

        logStep("Set dispute deadline", { deadline: disputeDeadline.toISOString() });
        fundsReleased = false; // Will be released by cron job after dispute window
      } else {
        // Default case - regular checkout with dispute window
        const disputeDeadline = new Date();
        disputeDeadline.setHours(disputeDeadline.getHours() + 48);

        await supabaseClient
          .from("bookings")
          .update({ 
            status: 'settlement_pending',
            actual_check_out: now,
            settlement_due_at: disputeDeadline.toISOString(),
            dispute_deadline: disputeDeadline.toISOString()
          })
          .eq("id", bookingId);
        
        logStep("Set dispute deadline (default)", { deadline: disputeDeadline.toISOString() });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        bothConfirmed,
        fundsReleased,
        disputeMode,
        message: bothConfirmed 
          ? (disputeMode ? "Damage reported - funds frozen pending review" : "Checkout confirmed - funds will be released after processing")
          : `${role === 'host' ? 'Host' : 'Guest'} checkout confirmation recorded`
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