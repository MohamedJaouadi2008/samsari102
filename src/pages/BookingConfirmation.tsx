
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HostInteraction from "@/components/booking/HostInteraction";
import PropertyBookingDetails from "@/components/booking/PropertyBookingDetails";
import ReservationDeposit from "@/components/booking/ReservationDeposit";
import { Tables } from "@/integrations/supabase/types";
import { bookingSchema } from "@/lib/validation";

type Property = Tables<"properties">;

const BookingConfirmation = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("+216 ");
  const [guestMessage, setGuestMessage] = useState("");
  const [bookingDetails, setBookingDetails] = useState({
    checkIn: "",
    checkOut: "",
    guests: 1,
    nights: 0,
    totalPrice: 0,
    pricePerNight: 0,
    message: ""
  });

  // Auto-fill phone number from user profile
  useEffect(() => {
    const fetchUserPhone = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .single();
      
      if (data?.phone) {
        // Ensure phone has the +216 prefix format
        const phone = data.phone;
        if (/^\+216\s?\d{8}$/.test(phone)) {
          // Already in correct format, normalize spacing
          setPhoneNumber(phone.replace(/^\+216\s?/, '+216 '));
        } else if (/^\d{8}$/.test(phone)) {
          // Just digits, add prefix
          setPhoneNumber(`+216 ${phone}`);
        } else {
          setPhoneNumber(phone);
        }
      }
    };
    fetchUserPhone();
  }, [user]);

  useEffect(() => {
    // Wait for auth to finish loading before redirecting
    if (authLoading) return;
    
    if (!user) {
      navigate("/auth");
      return;
    }
    
    if (id) {
      fetchProperty();
      loadBookingDetails();
    }
  }, [id, user, navigate, authLoading]);

  const fetchProperty = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setProperty(data);
    } catch (error) {
      console.error("Error fetching property:", error);
      toast({
        title: t('bcfm.error'),
        description: t('bcfm.property_not_found'),
        variant: "destructive"
      });
      navigate("/search");
    } finally {
      setLoading(false);
    }
  };

  const loadBookingDetails = () => {
    const stored = localStorage.getItem('bookingDetails');
    if (!stored) return;

    try {
      const details = JSON.parse(stored);

      // Validate parsed payload is a non-null object
      if (!details || typeof details !== 'object' || Array.isArray(details)) {
        console.error('Invalid booking details format');
        localStorage.removeItem('bookingDetails');
        return;
      }

      // Validate required fields exist with expected primitive types
      const isValidString = (v: unknown) => typeof v === 'string' && v.length > 0;
      const isValidNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

      if (
        !isValidString(details.checkIn) ||
        !isValidString(details.checkOut) ||
        !isValidNumber(details.guests) ||
        !isValidNumber(details.nights) ||
        !isValidNumber(details.totalPrice) ||
        !isValidNumber(details.pricePerNight)
      ) {
        console.error('Booking details missing required fields or invalid types');
        localStorage.removeItem('bookingDetails');
        return;
      }

      setBookingDetails({
        checkIn: details.checkIn,
        checkOut: details.checkOut,
        guests: details.guests,
        nights: details.nights,
        totalPrice: details.totalPrice,
        pricePerNight: details.pricePerNight,
        message: typeof details.message === 'string' ? details.message : '',
      });

      if (typeof details.message === 'string' && details.message) {
        setGuestMessage(details.message);
      }
    } catch (error) {
      console.error('Failed to parse booking details:', error);
      localStorage.removeItem('bookingDetails');
    }
  };

  const sendMessageToHost = async (conversationId: string, messageContent: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user!.id,
          content: messageContent
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSubmitBooking = async () => {
    if (!property || !user) return;

    // Check email verification
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser?.email_confirmed_at) {
      toast({
        title: t('bcfm.email_required'),
        description: t('bcfm.email_required_desc'),
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      // Validate input
      const validated = bookingSchema.parse({
        phoneNumber,
        guestMessage
      });
      
      // Check for overlapping bookings (double-booking prevention)
      const { data: existingBookings, error: checkError } = await supabase
        .from('bookings')
        .select('id, check_in_date, check_out_date, status')
        .eq('property_id', property.id)
        .in('status', ['pending', 'confirmed', 'awaiting_payment', 'deposit_paid', 'payment_authorized', 'payment_held', 'checked_in'])
        .lt('check_in_date', bookingDetails.checkOut)
        .gt('check_out_date', bookingDetails.checkIn);
      
      if (checkError) {
        console.error('Error checking for overlapping bookings:', checkError);
      } else if (existingBookings && existingBookings.length > 0) {
        toast({
          title: t('bcfm.dates_unavailable'),
          description: t('bcfm.dates_unavailable_desc'),
          variant: "destructive"
        });
        setSubmitting(false);
        return;
      }
      
      // Full payment: 100% of property price + 5% guest service fee
      const guestServiceFee = Math.round(bookingDetails.totalPrice * 0.05);
      const depositAmount = bookingDetails.totalPrice; // Full amount (not including service fee - that's added at checkout)
      
      const bookingData = {
        property_id: property.id,
        host_id: property.host_id,
        guest_id: user.id,
        check_in_date: bookingDetails.checkIn,
        check_out_date: bookingDetails.checkOut,
        total_price: bookingDetails.totalPrice,
        deposit_amount: depositAmount,
        guest_service_fee: guestServiceFee,
        num_guests: bookingDetails.guests,
        request_message: validated.guestMessage?.trim() || null,
        status: 'pending'
      };

      const { data: newBooking, error } = await supabase
        .from("bookings")
        .insert([bookingData])
        .select()
        .single();

      if (error) throw error;

      // Send email notification to host
      try {
        await supabase.functions.invoke('send-notification-email', {
          body: {
            userId: property.host_id,
            type: 'new_booking_request',
            propertyTitle: property.title,
            guestName: user.email?.split('@')[0] || 'Guest',
            checkInDate: new Date(bookingDetails.checkIn).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }),
            checkOutDate: new Date(bookingDetails.checkOut).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }),
            totalPrice: bookingDetails.totalPrice,
            numGuests: bookingDetails.guests,
            guestMessage: validated.guestMessage?.trim() || null
          }
        });
        console.log('Booking request email sent to host');
      } catch (emailError) {
        console.error('Failed to send booking request email:', emailError);
        // Don't fail the booking if email fails
      }

      // Create or get conversation with host
      let conversationId: string;
      
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('property_id', property.id)
        .eq('host_id', property.host_id)
        .eq('guest_id', user.id)
        .single();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            property_id: property.id,
            host_id: property.host_id,
            guest_id: user.id
          })
          .select('id')
          .single();

        if (convError) throw convError;
        conversationId = newConv.id;
      }

      // Send message to host with booking details and guest message
      let messageContent = `New booking request!\n\n`;
      
      if (validated.guestMessage?.trim()) {
        messageContent += `Guest message: ${validated.guestMessage.trim()}\n\n`;
      }
      
      messageContent += `Phone number: ${validated.phoneNumber}\n`;
      messageContent += `Reservation dates: ${new Date(bookingDetails.checkIn).toLocaleDateString()} to ${new Date(bookingDetails.checkOut).toLocaleDateString()}\n`;
      messageContent += `Guests: ${bookingDetails.guests}\n`;
      messageContent += `Nights: ${bookingDetails.nights}\n`;
      messageContent += `Total price: ${bookingDetails.totalPrice} TND`;

      await sendMessageToHost(conversationId, messageContent);

      localStorage.removeItem('bookingDetails');

      toast({
        title: t('bcfm.submitted'),
        description: t('bcfm.submitted_desc')
      });

      navigate("/profile?tab=inbox");
    } catch (error: any) {
      console.error("Error submitting booking:", error);
      toast({
        title: t('bcfm.error'),
        description: error.errors?.[0]?.message || error.message || t('bcfm.failed'),
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">{t('bcfm.loading')}</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">{t('bcfm.property_not_found')}</div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Host Interaction */}
          <div>
            <HostInteraction
              property={property}
              phoneNumber={phoneNumber}
              setPhoneNumber={setPhoneNumber}
              guestMessage={guestMessage}
              setGuestMessage={setGuestMessage}
              onSubmitBooking={handleSubmitBooking}
              submitting={submitting}
            />
          </div>

          {/* Right Side - Property Details & Pricing */}
          <div>
            <PropertyBookingDetails
              property={property}
              bookingDetails={bookingDetails}
            />
            <div className="mt-6">
              <ReservationDeposit totalPrice={bookingDetails.totalPrice} />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BookingConfirmation;
