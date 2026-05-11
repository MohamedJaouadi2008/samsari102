import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONFIRM-CHECK-IN] ${step}${detailsStr}`);
};

const SUPABASE_URL = "https://gigzciepwjrwbljdnixh.supabase.co";

const sendDisputeEmails = async (
  supabaseClient: any,
  booking: any,
  issuesDescription: string,
  photoCount: number
) => {
  try {
    // Get property details
    const { data: property } = await supabaseClient
      .from('properties')
      .select('title')
      .eq('id', booking.property_id)
      .single();

    // Get host and guest info
    const { data: hostAuth } = await supabaseClient.auth.admin.getUserById(booking.host_id);
    const { data: guestAuth } = await supabaseClient.auth.admin.getUserById(booking.guest_id);

    const { data: hostProfile } = await supabaseClient
      .from('profiles')
      .select('full_name')
      .eq('id', booking.host_id)
      .single();

    const { data: guestProfile } = await supabaseClient
      .from('profiles')
      .select('full_name')
      .eq('id', booking.guest_id)
      .single();

    const propertyTitle = property?.title || 'your property';
    const hostEmail = hostAuth?.user?.email;
    const guestEmail = guestAuth?.user?.email;
    const hostName = hostProfile?.full_name || 'Host';
    const guestName = guestProfile?.full_name || 'Guest';

    // Send email to HOST via send-notification-email
    if (hostEmail) {
      const hostEmailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'checkin_dispute_host',
          recipientEmail: hostEmail,
          recipientName: hostName,
          propertyTitle: propertyTitle,
          guestName: guestName,
          reason: issuesDescription,
          message: `${photoCount} photo(s) attached as evidence`,
          bookingId: booking.id,
          link: `https://samsari.lovable.app/profile?tab=requests`
        })
      });
      logStep("Host dispute email sent", { email: hostEmail, ok: hostEmailResponse.ok });
    }

    // Send email to GUEST via send-notification-email
    if (guestEmail) {
      const guestEmailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'checkin_dispute_guest',
          recipientEmail: guestEmail,
          recipientName: guestName,
          propertyTitle: propertyTitle,
          reason: issuesDescription,
          message: `${photoCount} photo(s) submitted`,
          bookingId: booking.id,
          link: `https://samsari.lovable.app/profile?tab=reservations`
        })
      });
      logStep("Guest dispute confirmation email sent", { email: guestEmail, ok: guestEmailResponse.ok });
    }
  } catch (emailError) {
    logStep("Failed to send dispute emails", { error: emailError });
    // Don't throw - email failure shouldn't block the main flow
  }
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
      conditionOk, // guest only - property condition confirmed
      issuesFound, // guest only - issues at check-in
      issuesDescription, // guest only - description of issues
      issuesPhotos // guest only - array of photo URLs
    } = await req.json();

    logStep("Request params", { bookingId, role, conditionOk, issuesFound });

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

    // STRICT STATE VALIDATION: Only allow check-in from valid states
    const validCheckInStates = ['deposit_paid', 'awaiting_checkin', 'awaiting_remaining_payment'];
    if (!validCheckInStates.includes(booking.status)) {
      logStep("Invalid state for check-in", { currentStatus: booking.status, validStates: validCheckInStates });
      throw new Error(`Cannot confirm check-in in status: ${booking.status}. Valid states: ${validCheckInStates.join(', ')}`);
    }

    // Prevent duplicate confirmation
    if (role === 'host' && booking.host_check_in_confirmed_at) {
      throw new Error("Host has already confirmed check-in");
    }
    if (role === 'guest' && booking.guest_check_in_confirmed_at) {
      throw new Error("Guest has already confirmed check-in");
    }

    const now = new Date().toISOString();
    const updateData: any = {};

    if (role === 'host') {
      updateData.host_check_in_confirmed_at = now;
      logStep("Host confirmed arrival");
    } else if (role === 'guest') {
      updateData.guest_check_in_confirmed_at = now;
      updateData.check_in_condition_confirmed = conditionOk === true;
      
      if (issuesFound) {
        // Validate issues description
        if (!issuesDescription || issuesDescription.trim().length < 10) {
          throw new Error("Issues description must be at least 10 characters");
        }
        // Validate photos array if provided
        const photos = issuesPhotos || [];
        if (photos.length > 10) {
          throw new Error("Maximum 10 issue photos allowed");
        }
        for (const photoUrl of photos) {
          if (typeof photoUrl !== 'string' || photoUrl.length > 2000) {
            throw new Error("Invalid photo URL format");
          }
        }
        updateData.check_in_issues_reported = true;
        updateData.check_in_issues_description = issuesDescription || null;
        updateData.check_in_issues_photos = photos;
        logStep("Guest reported issues", { issuesDescription, photoCount: photos.length });
      } else {
        updateData.check_in_issues_reported = false;
        logStep("Guest confirmed no issues");
      }
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

    // Re-fetch booking to get updated state after our update
    const { data: updatedBooking, error: refetchError } = await supabaseClient
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();
    
    if (refetchError || !updatedBooking) {
      logStep("Failed to refetch booking", { error: refetchError?.message });
      throw new Error("Failed to verify booking update");
    }

    const hostConfirmed = !!updatedBooking.host_check_in_confirmed_at;
    const guestConfirmed = !!updatedBooking.guest_check_in_confirmed_at;
    const bothConfirmed = hostConfirmed && guestConfirmed;

    logStep("Confirmation status after refetch", { hostConfirmed, guestConfirmed, bothConfirmed });

    let requiresRemainingPayment = false;
    let checkInDispute = false;

    if (bothConfirmed) {
      // Check if guest reported issues
      const hasIssues = updatedBooking.check_in_issues_reported;
      
      if (hasIssues) {
        // Put booking into check-in dispute
        logStep("Guest reported issues - entering dispute mode");
        const { error: disputeError } = await supabaseClient
          .from("bookings")
          .update({ 
            status: 'checkin_dispute',
            dispute_opened_at: now,
            dispute_filed_by: 'guest'
          })
          .eq("id", bookingId);
        
        if (disputeError) {
          logStep("ERROR updating to checkin_dispute", { error: disputeError.message });
          throw new Error(`Failed to update to dispute status: ${disputeError.message}`);
        }
        
        checkInDispute = true;

        // Send email notifications to both parties
        await sendDisputeEmails(
          supabaseClient, 
          updatedBooking, 
          updatedBooking.check_in_issues_description || issuesDescription,
          (updatedBooking.check_in_issues_photos || []).length
        );
      } else {
        // Both confirmed and no issues - 100% already paid, go directly to checked_in
        logStep("Both confirmed, no issues - transitioning to checked_in");
        
        // Set dispute deadline: 24 hours from now
        const disputeDeadline = new Date();
        disputeDeadline.setHours(disputeDeadline.getHours() + 24);

        const { error: statusError } = await supabaseClient
          .from("bookings")
          .update({ 
            status: 'checked_in',
            actual_check_in: now,
            full_payment_locked: true,
            dispute_deadline: disputeDeadline.toISOString()
          })
          .eq("id", bookingId);

        if (statusError) {
          logStep("ERROR updating to checked_in", { error: statusError.message });
          throw new Error(`Failed to update to checked_in: ${statusError.message}`);
        }

        logStep("Successfully transitioned to checked_in with 24h dispute window");
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        bothConfirmed,
        requiresRemainingPayment,
        checkInDispute,
        message: bothConfirmed 
          ? (checkInDispute ? "Check-in issue reported - awaiting resolution" : "Both parties confirmed - remaining payment required")
          : `${role === 'host' ? 'Host' : 'Guest'} confirmation recorded`
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