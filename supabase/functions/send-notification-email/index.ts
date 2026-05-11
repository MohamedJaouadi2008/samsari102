import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * EMAIL NOTIFICATION SERVICE
 * 
 * Sends transactional emails via Gmail SMTP for all platform notifications.
 * Called by database triggers on notifications table and directly from other edge functions.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailRequest {
  type: string;
  recipientEmail?: string;
  userId?: string;
  recipientName?: string;
  title?: string;
  message?: string;
  link?: string;
  bookingId?: string;
  propertyTitle?: string;
  amount?: number;
  currency?: string;
  deadline?: string;
  reason?: string;
  // Additional fields for booking request emails
  guestName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  totalPrice?: number;
  numGuests?: number;
  guestMessage?: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[EMAIL] ${step}${detailsStr}`);
};

const APP_NAME = "Samsari";
const APP_URL = "https://samsari.lovable.app";

// Email template styles - Modern premium design
const getEmailStyles = () => `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.7;
  color: #1f2937;
  background-color: #f8fafc;
  -webkit-font-smoothing: antialiased;
}
.wrapper {
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 20px;
}
.email-container {
  background: #ffffff;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
}
.header {
  text-align: center;
  padding: 48px 40px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
  position: relative;
  overflow: hidden;
}
.header::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
}
.logo {
  font-size: 32px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 4px;
  margin: 0;
  text-transform: uppercase;
  position: relative;
}
.logo-accent {
  display: block;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 3px;
  color: rgba(255,255,255,0.7);
  margin-top: 8px;
  text-transform: uppercase;
}
.emoji-badge {
  display: inline-block;
  font-size: 48px;
  margin-bottom: 16px;
}
.content {
  padding: 48px 40px;
}
.greeting {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #0f172a;
}
.subgreeting {
  font-size: 15px;
  color: #64748b;
  margin-bottom: 32px;
}
.message {
  font-size: 16px;
  margin-bottom: 24px;
  color: #475569;
  line-height: 1.8;
}
.highlight-box {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
  border-radius: 16px;
  padding: 24px;
  margin: 28px 0;
}
.details-card {
  background: #f8fafc;
  border-radius: 16px;
  padding: 24px;
  margin: 28px 0;
  border: 1px solid #e2e8f0;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #e2e8f0;
}
.detail-row:last-child {
  border-bottom: none;
}
.detail-label {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
}
.detail-value {
  font-size: 15px;
  color: #0f172a;
  font-weight: 600;
  text-align: right;
}
.guest-message-box {
  background: #fefce8;
  border-left: 4px solid #eab308;
  border-radius: 0 12px 12px 0;
  padding: 20px;
  margin-top: 20px;
}
.guest-message-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #a16207;
  font-weight: 600;
  margin-bottom: 8px;
}
.guest-message-text {
  font-size: 15px;
  color: #713f12;
  font-style: italic;
  line-height: 1.6;
}
.cta-container {
  text-align: center;
  padding: 32px 0;
}
.cta-button {
  display: inline-block;
  padding: 18px 48px;
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  color: #ffffff !important;
  text-decoration: none;
  border-radius: 100px;
  font-weight: 600;
  font-size: 16px;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 14px 0 rgba(14, 165, 233, 0.4);
  transition: all 0.3s ease;
}
.cta-button:hover {
  box-shadow: 0 6px 20px 0 rgba(14, 165, 233, 0.5);
  transform: translateY(-2px);
}
.cta-secondary {
  display: block;
  margin-top: 16px;
  font-size: 13px;
  color: #64748b;
}
.alert {
  border-radius: 12px;
  padding: 20px 24px;
  margin: 24px 0;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.alert-icon {
  font-size: 24px;
  flex-shrink: 0;
}
.alert-content {
  flex: 1;
}
.alert-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}
.alert-text {
  font-size: 14px;
  line-height: 1.5;
}
.alert.info {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #fcd34d;
}
.alert.info .alert-title { color: #92400e; }
.alert.info .alert-text { color: #a16207; }
.alert.warning {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border: 1px solid #fca5a5;
}
.alert.warning .alert-title { color: #991b1b; }
.alert.warning .alert-text { color: #b91c1c; }
.alert.success {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  border: 1px solid #6ee7b7;
}
.alert.success .alert-title { color: #065f46; }
.alert.success .alert-text { color: #047857; }
.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
  margin: 32px 0;
}
.footer {
  background: #f8fafc;
  padding: 40px;
  text-align: center;
  border-top: 1px solid #e2e8f0;
}
.footer-logo {
  font-size: 18px;
  font-weight: 700;
  color: #334155;
  letter-spacing: 2px;
  margin-bottom: 12px;
}
.footer-tagline {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 24px;
}
.footer-links {
  margin-bottom: 24px;
}
.footer-link {
  color: #0ea5e9;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  margin: 0 12px;
}
.footer-meta {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.6;
}
.social-icons {
  margin: 20px 0;
}
.social-icon {
  display: inline-block;
  width: 36px;
  height: 36px;
  background: #e2e8f0;
  border-radius: 50%;
  margin: 0 6px;
  line-height: 36px;
  font-size: 14px;
  color: #475569;
  text-decoration: none;
}
ul.feature-list {
  list-style: none;
  margin: 20px 0;
  padding: 0;
}
ul.feature-list li {
  padding: 12px 0;
  padding-left: 32px;
  position: relative;
  color: #475569;
  font-size: 15px;
  border-bottom: 1px solid #f1f5f9;
}
ul.feature-list li:last-child {
  border-bottom: none;
}
ul.feature-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #10b981;
  font-weight: bold;
}
`;

// Generate email HTML based on notification type
function generateEmailHTML(request: EmailRequest): { subject: string; html: string } {
  const { type, recipientName, title, message, link, propertyTitle, amount, currency, deadline, reason } = request;
  const name = recipientName || "there";
  
  let subject = "";
  let bodyContent = "";
  let ctaText = "";
  let ctaLink = APP_URL;
  let emoji = "📬";
  
  switch (type) {
    case "welcome":
      subject = `Welcome to ${APP_NAME}! 🎉`;
      emoji = "🏠";
      bodyContent = `
        <p class="message">Welcome to ${APP_NAME} — Tunisia's most trusted vacation rental platform. We're thrilled to have you join our community!</p>
        <div class="highlight-box">
          <p style="font-size: 16px; font-weight: 600; color: #0369a1; margin-bottom: 12px;">Here's what you can do:</p>
          <ul class="feature-list">
            <li>Browse verified properties across Tunisia</li>
            <li>Book with confidence using our secure escrow system</li>
            <li>Become a host and list your own property</li>
          </ul>
        </div>
      `;
      ctaText = "Start Exploring";
      ctaLink = APP_URL;
      break;
      
    case "new_booking_request":
      const guestNameDisplay = request.guestName || "A guest";
      subject = `New Booking Request! 🏠 ${propertyTitle || "Your Property"}`;
      emoji = "📩";
      bodyContent = `
        <p class="message"><strong>${guestNameDisplay}</strong> wants to book your property! Here are the details:</p>
        <div class="details-card">
          <div class="detail-row">
            <span class="detail-label">Property</span>
            <span class="detail-value">${propertyTitle || "Your property"}</span>
          </div>
          ${request.checkInDate ? `<div class="detail-row"><span class="detail-label">Check-in</span><span class="detail-value">${request.checkInDate}</span></div>` : ""}
          ${request.checkOutDate ? `<div class="detail-row"><span class="detail-label">Check-out</span><span class="detail-value">${request.checkOutDate}</span></div>` : ""}
          ${request.numGuests ? `<div class="detail-row"><span class="detail-label">Guests</span><span class="detail-value">${request.numGuests} ${request.numGuests === 1 ? 'guest' : 'guests'}</span></div>` : ""}
          ${request.totalPrice ? `<div class="detail-row"><span class="detail-label">Total Amount</span><span class="detail-value" style="color: #0ea5e9; font-size: 18px;">${request.totalPrice} TND</span></div>` : ""}
        </div>
        ${request.guestMessage ? `
        <div class="guest-message-box">
          <p class="guest-message-label">Message from ${guestNameDisplay}</p>
          <p class="guest-message-text">"${request.guestMessage}"</p>
        </div>` : ""}
        <div class="alert info">
          <span class="alert-icon">⏰</span>
          <div class="alert-content">
            <p class="alert-title">Action Required</p>
            <p class="alert-text">Please review and respond within 24 hours to keep your response rate high.</p>
          </div>
        </div>
      `;
      ctaText = "View Request";
      ctaLink = `${APP_URL}/profile?tab=requests`;
      break;
      
    case "booking_confirmed":
      subject = "🎉 Booking Confirmed!";
      emoji = "✅";
      bodyContent = `
        <p class="message">Great news! Your booking has been <strong>confirmed</strong> by the host.</p>
        <div class="details-card">
          <div class="detail-row">
            <span class="detail-label">Property</span>
            <span class="detail-value">${propertyTitle || "Your booking"}</span>
          </div>
          ${amount ? `<div class="detail-row"><span class="detail-label">Deposit to Pay</span><span class="detail-value" style="color: #0ea5e9; font-size: 18px;">${currency || "TND"} ${amount}</span></div>` : ""}
        </div>
        <p class="message">Please complete your deposit payment to secure your reservation. Your funds will be held safely in escrow.</p>
      `;
      ctaText = "Pay Deposit Now";
      ctaLink = link || `${APP_URL}/profile?tab=reservations`;
      break;
      
    case "booking_declined":
      subject = "Booking Request Update";
      emoji = "📋";
      bodyContent = `
        <p class="message">Unfortunately, your booking request for <strong>${propertyTitle || "the property"}</strong> was not accepted by the host.</p>
        <div class="alert info">
          <span class="alert-icon">💡</span>
          <div class="alert-content">
            <p class="alert-title">Don't worry!</p>
            <p class="alert-text">There are plenty of other amazing properties available. Let's find your perfect stay!</p>
          </div>
        </div>
      `;
      ctaText = "Browse Properties";
      ctaLink = APP_URL;
      break;
      
    case "payment_required":
      subject = "⏰ Payment Required - Complete Your Booking";
      emoji = "💳";
      bodyContent = `
        <p class="message">Please complete your deposit payment to secure your booking.</p>
        <div class="details-card">
          <div class="detail-row">
            <span class="detail-label">Property</span>
            <span class="detail-value">${propertyTitle || "Your booking"}</span>
          </div>
          ${amount ? `<div class="detail-row"><span class="detail-label">Amount Due</span><span class="detail-value" style="color: #0ea5e9; font-size: 18px;">${currency || "TND"} ${amount}</span></div>` : ""}
        </div>
        <div class="alert warning">
          <span class="alert-icon">⚠️</span>
          <div class="alert-content">
            <p class="alert-title">Time Sensitive</p>
            <p class="alert-text">Complete payment within 24 hours to keep your reservation.</p>
          </div>
        </div>
      `;
      ctaText = "Pay Now";
      ctaLink = link || `${APP_URL}/profile?tab=reservations`;
      break;
      
    case "deposit_received":
      subject = "✅ Deposit Confirmed - You're All Set!";
      emoji = "🔒";
      bodyContent = `
        <p class="message">Your deposit has been received and your booking is <strong>secured</strong>!</p>
        <div class="alert success">
          <span class="alert-icon">🔐</span>
          <div class="alert-content">
            <p class="alert-title">Funds Protected</p>
            <p class="alert-text">Your payment is held securely in escrow until after your stay is complete.</p>
          </div>
        </div>
        <p class="message">Get ready for your upcoming stay at <strong>${propertyTitle || "your booked property"}</strong>!</p>
      `;
      ctaText = "View Booking Details";
      ctaLink = link || `${APP_URL}/profile?tab=reservations`;
      break;
      
    case "remaining_payment_required":
      subject = "🚨 Action Required: Pay Remaining Balance";
      emoji = "💰";
      bodyContent = `
        <p class="message">Check-in has been confirmed! Please pay the remaining balance to complete your booking.</p>
        <div class="details-card">
          <div class="detail-row">
            <span class="detail-label">Property</span>
            <span class="detail-value">${propertyTitle || "Your booking"}</span>
          </div>
          ${amount ? `<div class="detail-row"><span class="detail-label">Remaining Amount</span><span class="detail-value" style="color: #dc2626; font-size: 20px; font-weight: 700;">${currency || "TND"} ${amount}</span></div>` : ""}
          ${deadline ? `<div class="detail-row"><span class="detail-label">Deadline</span><span class="detail-value" style="color: #dc2626;">${deadline}</span></div>` : ""}
        </div>
        <div class="alert warning">
          <span class="alert-icon">⚡</span>
          <div class="alert-content">
            <p class="alert-title">Urgent - Time Sensitive</p>
            <p class="alert-text">Please complete payment within 30 minutes to avoid automatic cancellation.</p>
          </div>
        </div>
      `;
      ctaText = "Pay Now";
      ctaLink = link || `${APP_URL}/profile?tab=reservations`;
      break;
      
    case "booking_cancelled":
      subject = "Booking Cancelled";
      emoji = "❌";
      bodyContent = `
        <p class="message">Your booking for <strong>${propertyTitle || "the property"}</strong> has been cancelled.</p>
        ${reason ? `<div class="details-card"><div class="detail-row"><span class="detail-label">Reason</span><span class="detail-value">${reason}</span></div></div>` : ""}
        ${amount ? `
        <div class="alert success">
          <span class="alert-icon">💸</span>
          <div class="alert-content">
            <p class="alert-title">Refund Processing</p>
            <p class="alert-text">A refund of <strong>${currency || "TND"} ${amount}</strong> will be processed within 5-10 business days.</p>
          </div>
        </div>` : ""}
      `;
      ctaText = "View Details";
      ctaLink = link || `${APP_URL}/profile?tab=reservations`;
      break;
      
    case "checked_in":
    case "checkin_confirmed":
      subject = "🏠 Welcome! Check-in Confirmed";
      emoji = "🗝️";
      bodyContent = `
        <p class="message">Welcome! Your check-in for <strong>${propertyTitle || "the property"}</strong> has been confirmed.</p>
        <div class="highlight-box">
          <p style="font-size: 18px; font-weight: 600; color: #0369a1; text-align: center;">Enjoy your stay! 🌟</p>
        </div>
        <div class="alert info">
          <span class="alert-icon">📸</span>
          <div class="alert-content">
            <p class="alert-title">Quick Reminder</p>
            <p class="alert-text">If you encounter any issues with the property, please report them within the first few hours of your stay with photos.</p>
          </div>
        </div>
      `;
      ctaText = "View Booking";
      ctaLink = link || `${APP_URL}/profile?tab=reservations`;
      break;
      
    case "checked_out":
    case "booking_completed":
      subject = "👋 Thank You for Staying with Us!";
      emoji = "🌟";
      bodyContent = `
        <p class="message">Thank you for staying at <strong>${propertyTitle || "the property"}</strong>!</p>
        <p class="message">Your checkout has been recorded. We hope you had a wonderful experience.</p>
        <div class="alert success">
          <span class="alert-icon">✨</span>
          <div class="alert-content">
            <p class="alert-title">Booking Complete</p>
            <p class="alert-text">${amount ? `Your total payment of <strong>${currency || "TND"} ${amount}</strong> has been processed.` : "Your booking has been successfully completed."}</p>
          </div>
        </div>
        <p class="message">We'd love to hear about your experience — your review helps other travelers and the host!</p>
      `;
      ctaText = "Leave a Review ⭐";
      ctaLink = link || `${APP_URL}/profile?tab=reservations`;
      break;
      
    case "settlement_pending":
      subject = "💰 Settlement Processing";
      emoji = "⏳";
      bodyContent = `
        <p class="message">The payment for your booking at <strong>${propertyTitle || "the property"}</strong> is being processed.</p>
        <div class="details-card">
          ${amount ? `<div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value" style="color: #10b981; font-size: 18px;">${currency || "TND"} ${amount}</span></div>` : ""}
          ${deadline ? `<div class="detail-row"><span class="detail-label">Release Date</span><span class="detail-value">${deadline}</span></div>` : ""}
        </div>
        <p class="message">Funds will be released to your account after the 48-hour dispute window closes.</p>
      `;
      ctaText = "View Details";
      ctaLink = link || `${APP_URL}/profile?tab=requests`;
      break;
      
    case "dispute_opened":
      subject = "⚠️ Dispute Filed - Action Required";
      emoji = "⚖️";
      bodyContent = `
        <p class="message">A dispute has been filed for your booking at <strong>${propertyTitle || "the property"}</strong>.</p>
        ${reason ? `<div class="details-card"><div class="detail-row"><span class="detail-label">Reason</span><span class="detail-value">${reason}</span></div></div>` : ""}
        <div class="alert warning">
          <span class="alert-icon">👥</span>
          <div class="alert-content">
            <p class="alert-title">Under Review</p>
            <p class="alert-text">Our team will review the dispute and contact you if additional information is needed.</p>
          </div>
        </div>
      `;
      ctaText = "View Dispute";
      ctaLink = link || `${APP_URL}/profile?tab=reservations`;
      break;
      
    case "dispute_resolved":
      subject = "✅ Dispute Resolved";
      emoji = "⚖️";
      bodyContent = `
        <p class="message">The dispute for your booking at <strong>${propertyTitle || "the property"}</strong> has been resolved.</p>
        <div class="details-card">
          ${reason ? `<div class="detail-row"><span class="detail-label">Resolution</span><span class="detail-value">${reason}</span></div>` : ""}
          ${amount ? `<div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value" style="color: #10b981;">${currency || "TND"} ${amount}</span></div>` : ""}
        </div>
      `;
      ctaText = "View Details";
      ctaLink = link || `${APP_URL}/profile?tab=reservations`;
      break;
      
    case "payment_released":
      subject = "🎉 Funds Released to Your Account!";
      emoji = "💵";
      bodyContent = `
        <p class="message">Great news! The funds for your booking at <strong>${propertyTitle || "the property"}</strong> have been released!</p>
        <div class="details-card" style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-color: #6ee7b7;">
          ${amount ? `<div class="detail-row" style="border-color: #6ee7b7;"><span class="detail-label" style="color: #065f46;">Amount Released</span><span class="detail-value" style="color: #065f46; font-size: 24px;">${currency || "TND"} ${amount}</span></div>` : ""}
        </div>
        <p class="message">The transfer should appear in your connected bank account within 2-3 business days.</p>
      `;
      ctaText = "View Earnings";
      ctaLink = link || `${APP_URL}/profile?tab=requests`;
      break;
      
    case "warning_issued":
      subject = `⚠️ Warning from ${APP_NAME}`;
      emoji = "⚠️";
      bodyContent = `
        <p class="message">You have received a warning regarding your account.</p>
        <div class="alert warning">
          <span class="alert-icon">📋</span>
          <div class="alert-content">
            <p class="alert-title">Warning Details</p>
            <p class="alert-text">${reason || message || "Policy violation"}</p>
          </div>
        </div>
        <p class="message">Please review our community guidelines and terms of service. Repeated violations may result in strikes or account suspension.</p>
      `;
      ctaText = "View Guidelines";
      ctaLink = `${APP_URL}/safety`;
      break;
      
    case "strike_issued":
      subject = "🚨 Strike Issued - Account Alert";
      emoji = "🚨";
      bodyContent = `
        <p class="message">A strike has been issued against your account.</p>
        <div class="alert warning">
          <span class="alert-icon">⛔</span>
          <div class="alert-content">
            <p class="alert-title">Strike Details</p>
            <p class="alert-text">${reason || message || "Serious policy violation"}</p>
          </div>
        </div>
        <div class="details-card" style="background: #fef2f2; border-color: #fca5a5;">
          <p style="color: #991b1b; font-weight: 600; text-align: center;">⚠️ Accumulating 3 strikes will result in automatic account suspension.</p>
        </div>
        <p class="message">Please review our community guidelines immediately.</p>
      `;
      ctaText = "View Guidelines";
      ctaLink = `${APP_URL}/safety`;
      break;
      
    case "account_banned":
      subject = "Account Suspended";
      emoji = "🚫";
      bodyContent = `
        <p class="message">Your ${APP_NAME} account has been suspended.</p>
        <div class="alert warning">
          <span class="alert-icon">🚫</span>
          <div class="alert-content">
            <p class="alert-title">Reason</p>
            <p class="alert-text">${reason || message || "Terms of service violation"}</p>
          </div>
        </div>
        <p class="message">If you believe this was a mistake, you may submit an appeal through your account page.</p>
      `;
      ctaText = "Submit Appeal";
      ctaLink = `${APP_URL}/profile`;
      break;
      
    case "account_unbanned":
      subject = "🎉 Account Reinstated - Welcome Back!";
      emoji = "🎉";
      bodyContent = `
        <p class="message">Great news! Your ${APP_NAME} account has been reinstated.</p>
        <div class="alert success">
          <span class="alert-icon">✓</span>
          <div class="alert-content">
            <p class="alert-title">Your Appeal Was Approved</p>
            <p class="alert-text">${reason || message || "Your ban appeal has been reviewed and approved."}</p>
          </div>
        </div>
        <p class="message">Your account is now fully active. Please ensure you follow our community guidelines to avoid future issues.</p>
        <div class="details-card">
          <p style="font-size: 16px; font-weight: 600; color: #059669; margin-bottom: 12px;">What's restored:</p>
          <ul class="feature-list">
            <li>Full access to browse and book properties</li>
            <li>Ability to message hosts</li>
            <li>Access to your saved properties and bookings</li>
          </ul>
        </div>
      `;
      ctaText = "Return to Samsari";
      ctaLink = `${APP_URL}`;
      break;
      
    case "deadline_warning":
      subject = "⏰ Action Required - Deadline Approaching";
      emoji = "⏰";
      bodyContent = `
        <p class="message">${message || "You have an upcoming deadline that requires your attention."}</p>
        <div class="details-card">
          ${deadline ? `<div class="detail-row"><span class="detail-label">Deadline</span><span class="detail-value" style="color: #dc2626; font-weight: 700;">${deadline}</span></div>` : ""}
          ${propertyTitle ? `<div class="detail-row"><span class="detail-label">Property</span><span class="detail-value">${propertyTitle}</span></div>` : ""}
        </div>
        <div class="alert warning">
          <span class="alert-icon">⚡</span>
          <div class="alert-content">
            <p class="alert-title">Urgent</p>
            <p class="alert-text">Please take action as soon as possible to avoid automatic processing.</p>
          </div>
        </div>
      `;
      ctaText = "Take Action Now";
      ctaLink = link || `${APP_URL}/profile?tab=reservations`;
      break;
      
    case "checkin_dispute_host":
      subject = `⚠️ Check-In Dispute Filed - ${propertyTitle || "Your Property"}`;
      emoji = "⚠️";
      bodyContent = `
        <p class="message">A guest (<strong>${request.guestName || "Guest"}</strong>) has reported issues at check-in for <strong>${propertyTitle || "your property"}</strong>.</p>
        <div class="alert warning">
          <span class="alert-icon">📋</span>
          <div class="alert-content">
            <p class="alert-title">Issues Reported</p>
            <p class="alert-text">${reason || "Issues were reported at check-in."}</p>
          </div>
        </div>
        ${message ? `<p class="message" style="color: #6b7280; font-size: 14px;">${message}</p>` : ""}
        <div class="details-card">
          <p style="font-size: 16px; font-weight: 600; color: #0369a1; margin-bottom: 12px;">What happens next:</p>
          <ul class="feature-list">
            <li>Our support team will review this dispute within 24 hours</li>
            <li>Funds remain locked until the dispute is resolved</li>
            <li>You may be contacted to provide your perspective</li>
            <li>You can respond via your dashboard</li>
          </ul>
        </div>
        <div class="alert info">
          <span class="alert-icon">💡</span>
          <div class="alert-content">
            <p class="alert-title">Important</p>
            <p class="alert-text">Please do not attempt to resolve payment matters directly with the guest outside the platform.</p>
          </div>
        </div>
      `;
      ctaText = "View Booking Details";
      ctaLink = link || `${APP_URL}/profile?tab=requests`;
      break;
      
    case "checkin_dispute_guest":
      subject = `✅ Your Check-In Dispute Has Been Filed - ${propertyTitle || "Your Booking"}`;
      emoji = "📝";
      bodyContent = `
        <p class="message">Your check-in dispute for <strong>${propertyTitle || "your booking"}</strong> has been filed successfully.</p>
        <div class="alert success">
          <span class="alert-icon">✓</span>
          <div class="alert-content">
            <p class="alert-title">Your Report</p>
            <p class="alert-text">${reason || "Your issues have been recorded."}</p>
          </div>
        </div>
        ${message ? `<p class="message" style="color: #6b7280; font-size: 14px;">${message}</p>` : ""}
        <div class="details-card">
          <p style="font-size: 16px; font-weight: 600; color: #0369a1; margin-bottom: 12px;">What happens next:</p>
          <ul class="feature-list">
            <li>Our support team will review your dispute within <strong>24 hours</strong></li>
            <li>All funds remain securely locked until resolution</li>
            <li>You can continue your stay while we investigate</li>
            <li>We may contact you for additional information</li>
          </ul>
        </div>
        <div class="alert info">
          <span class="alert-icon">💡</span>
          <div class="alert-content">
            <p class="alert-title">Tips</p>
            <p class="alert-text">Take additional photos/videos if you discover more issues. Keep all communication on the platform. Do not make private payment arrangements with the host.</p>
          </div>
        </div>
      `;
      ctaText = "View Your Reservation";
      ctaLink = link || `${APP_URL}/profile?tab=reservations`;
      break;
      
    default:
      // Generic notification
      subject = title || `Notification from ${APP_NAME}`;
      emoji = "📬";
      bodyContent = `
        <p class="message">${message || "You have a new notification."}</p>
      `;
      ctaText = "View Details";
      ctaLink = link || APP_URL;
  }
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
  <style>${getEmailStyles()}</style>
</head>
<body>
  <div class="wrapper">
    <div class="email-container">
      <div class="header">
        <div class="emoji-badge">${emoji}</div>
        <h1 class="logo">${APP_NAME}</h1>
        <span class="logo-accent">Secure Vacation Rentals</span>
      </div>
      <div class="content">
        <p class="greeting">Hi ${name}!</p>
        <p class="subgreeting">${getGreetingSubtext(type)}</p>
        ${bodyContent}
        <div class="cta-container">
          <a href="${ctaLink}" class="cta-button">${ctaText}</a>
          <span class="cta-secondary">or copy this link: ${ctaLink}</span>
        </div>
      </div>
      <div class="footer">
        <p class="footer-logo">${APP_NAME.toUpperCase()}</p>
        <p class="footer-tagline">Tunisia's Trusted Vacation Rental Platform</p>
        <div class="footer-links">
          <a href="${APP_URL}" class="footer-link">Browse Properties</a>
          <a href="${APP_URL}/safety" class="footer-link">Safety Center</a>
          <a href="${APP_URL}/help" class="footer-link">Help</a>
        </div>
        <p class="footer-meta">
          This email was sent to ${request.recipientEmail}<br>
          © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
  
  return { subject, html };
}

// Helper function for greeting subtext
function getGreetingSubtext(type: string): string {
  const subtexts: { [key: string]: string } = {
    welcome: "Your adventure begins now!",
    new_booking_request: "You've got a new booking request!",
    booking_confirmed: "Your trip is one step closer!",
    booking_declined: "We have an update on your request.",
    payment_required: "Just one more step to secure your booking.",
    deposit_received: "Your reservation is secured!",
    remaining_payment_required: "Almost there! Complete your payment.",
    booking_cancelled: "We have an update about your booking.",
    checked_in: "Have an amazing stay!",
    checked_out: "We hope you had a great time!",
    settlement_pending: "Your earnings are on the way!",
    dispute_opened: "We're here to help resolve this.",
    dispute_resolved: "Good news about your dispute!",
    payment_released: "Time to celebrate!",
    warning_issued: "Important notice about your account.",
    strike_issued: "Important account notification.",
    account_banned: "Important account notification.",
    deadline_warning: "Time-sensitive action required.",
    checkin_dispute_host: "A guest has reported issues at check-in.",
    checkin_dispute_guest: "Your dispute has been received.",
  };
  return subtexts[type] || "Here's an update for you.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: EmailRequest = await req.json();
    
    logStep("Email request received", { type: request.type, recipient: request.recipientEmail, userId: request.userId });
    
    // Resolve email from userId if not provided directly
    let recipientEmail = request.recipientEmail;
    let recipientName = request.recipientName;
    
    if (!recipientEmail && request.userId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );
      
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(request.userId);
      if (userError || !userData?.user?.email) {
        logStep("Failed to get user email", { userId: request.userId, error: userError?.message });
        return new Response(
          JSON.stringify({ success: false, error: "Could not find user email" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      recipientEmail = userData.user.email;
      
      if (!recipientName) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", request.userId)
          .single();
        recipientName = profile?.full_name || "there";
      }
    }
    
    if (!recipientEmail || !request.type) {
      throw new Error("Missing required fields: recipientEmail (or userId) and type");
    }
    
    const resolvedRequest = { ...request, recipientEmail, recipientName };
    
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");
    
    if (!gmailUser || !gmailPassword) {
      logStep("Gmail credentials not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    const { subject, html } = generateEmailHTML(resolvedRequest);
    
    logStep("Sending email", { to: recipientEmail, subject });
    
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailPassword,
        },
      },
    });
    
    await client.send({
      from: `${APP_NAME} <${gmailUser}>`,
      to: recipientEmail,
      subject: subject,
      html: html,
    });
    
    await client.close();
    
    logStep("Email sent successfully", { to: recipientEmail, type: request.type });
    
    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: any) {
    console.error("[EMAIL] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
