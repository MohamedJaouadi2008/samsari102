import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CreditCard, 
  ArrowLeft, 
  Shield, 
  CheckCircle, 
  Calendar,
  Home,
  AlertCircle,
  Lock
} from 'lucide-react';
import { format } from 'date-fns';

interface BookingDetails {
  id: string;
  property_id: string;
  property_title: string;
  property_photo: string | null;
  host_name: string;
  check_in_date: string;
  check_out_date: string;
  total_price: number;
  deposit_amount: number;
  guest_service_fee: number;
  status: string;
  payment_status: string;
}

const Payment: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const { formatPrice, getStripeCurrency, getStripeAmount } = useCurrency();
  const { t } = useLanguage();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (bookingId) {
      fetchBookingDetails();
    }
  }, [user, bookingId, authLoading]);

  const fetchBookingDetails = async () => {
    if (!bookingId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          property_id,
          host_id,
          check_in_date,
          check_out_date,
          total_price,
          deposit_amount,
          guest_service_fee,
          status,
          payment_status,
          properties (
            title,
            photos
          )
        `)
        .eq('id', bookingId)
        .eq('guest_id', user?.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          title: t('bcfm.error'),
          description: t('pay.toast.load_failed'),
          variant: "destructive"
        });
        navigate('/profile?tab=reservations');
        return;
      }

      const { data: hostProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', data.host_id)
        .maybeSingle();

      const photos = (data.properties as any)?.photos;
      const firstPhoto = Array.isArray(photos) && photos.length > 0 ? photos[0]?.url : null;
      
      // Full payment amount = total_price (deposit_amount should equal total_price now)
      const depositAmount = data.deposit_amount || data.total_price;
      const guestServiceFee = data.guest_service_fee || Math.round(data.total_price * 0.05);

      setBooking({
        id: data.id,
        property_id: data.property_id,
        property_title: (data.properties as any)?.title || 'Property',
        property_photo: firstPhoto,
        host_name: hostProfile?.full_name || 'Host',
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        total_price: data.total_price,
        deposit_amount: depositAmount,
        guest_service_fee: guestServiceFee,
        status: data.status || 'pending',
        payment_status: data.payment_status || 'pending'
      });

      if (data.payment_status === 'paid' || data.status === 'deposit_paid') {
        setPaymentComplete(true);
      }
    } catch (error) {
      console.error('Error fetching booking:', error);
      toast({
        title: t('pay.toast.error'),
        description: t('pay.toast.load_failed'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (sandbox = false) => {
    if (!booking || !user) return;

    if (booking.payment_status === 'paid') {
      toast({
        title: t('pay.toast.error'),
        description: t('pay.toast.already_paid'),
        variant: "destructive"
      });
      setPaymentComplete(true);
      return;
    }

    if (!['confirmed', 'awaiting_payment'].includes(booking.status)) {
      toast({
        title: t('pay.toast.cannot_process'),
        description: t('pay.toast.not_ready'),
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);

    try {
      // Total charge = property price + 5% service fee
      const totalCharge = booking.deposit_amount + booking.guest_service_fee;
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          bookingId: booking.id,
          amount: getStripeAmount(totalCharge),
          propertyTitle: booking.property_title,
          returnUrl: window.location.href,
          currency: getStripeCurrency(),
          sandbox,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create checkout session');
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }

    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: t('pay.toast.failed'),
        description: error.message || t('pay.toast.failed_desc'),
        variant: "destructive"
      });
      setProcessing(false);
    }
  };

  const verifyPayment = async (sessionId: string, sandbox = false) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { sessionId, sandbox },
      });

      if (error) throw new Error(error.message);

      if (data?.success) {
        setPaymentComplete(true);
        if (booking) {
          setBooking({
            ...booking,
            status: 'deposit_paid',
            payment_status: 'paid'
          });
        }
        toast({
          title: t('pay.toast.success_title'),
          description: t('pay.toast.success_desc')
        });
      } else {
        toast({
          title: t('pay.toast.verify_failed'),
          description: data?.error || t('pay.toast.verify_failed_desc'),
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      toast({
        title: t('pay.toast.verify_error'),
        description: error.message || t('pay.toast.verify_failed_desc'),
        variant: "destructive"
      });
    }
  };

  const verificationAttempted = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const sessionId = urlParams.get('session_id');
    const canceled = urlParams.get('canceled');
    const sandboxParam = urlParams.get('sandbox') === 'true';

    if (success || canceled) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (success === 'true' && sessionId && !verificationAttempted.current) {
      verificationAttempted.current = true;
      verifyPayment(sessionId, sandboxParam);
    } else if (canceled === 'true') {
      toast({
        title: t('pay.toast.cancelled'),
        description: t('pay.toast.cancelled_desc'),
        variant: "destructive"
      });
    }
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>{t('bcfm.loading')}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Booking Not Found</h2>
            <p className="text-muted-foreground mb-4">
              We couldn't find the booking you're looking for.
            </p>
            <Button onClick={() => navigate('/profile?tab=reservations')}>
              View My Reservations
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const totalCharge = booking.deposit_amount + booking.guest_service_fee;

  // Success state
  if (paymentComplete) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">{t('pay.toast.success_title')}</h2>
                <p className="text-muted-foreground mb-6">
                  {t('pay_rem.success_desc', { amount: formatPrice(totalCharge) })}
                </p>
                
                <div className="bg-muted p-4 rounded-lg mb-6 text-left">
                  <h3 className="font-medium mb-3">Booking Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Property</span>
                      <span className="font-medium">{booking.property_title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-in</span>
                      <span>{format(new Date(booking.check_in_date), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-out</span>
                      <span>{format(new Date(booking.check_out_date), 'MMM d, yyyy')}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Property Total</span>
                      <span>{formatPrice(booking.total_price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service Fee (5%)</span>
                      <span>{formatPrice(booking.guest_service_fee)}</span>
                    </div>
                    <div className="flex justify-between font-medium text-green-600">
                      <span>Total Paid</span>
                      <span>{formatPrice(totalCharge)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-center">
                  <Button onClick={() => navigate('/profile?tab=reservations')}>
                    View My Reservations
                  </Button>
                  <Button variant="outline" onClick={() => navigate(`/property/${booking.property_id}`)}>
                    View Property
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Already paid state
  if (booking.payment_status === 'paid' || booking.status === 'deposit_paid') {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Already Paid</h2>
                <p className="text-muted-foreground mb-6">
                  Your full payment has already been received. Your booking is secured!
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => navigate('/profile?tab=reservations')}>
                    View My Reservations
                  </Button>
                  <Button variant="outline" onClick={() => navigate(`/property/${booking.property_id}`)}>
                    View Property
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Not payable state
  if (!['confirmed', 'awaiting_payment'].includes(booking.status)) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/profile?tab=reservations')}
              className="mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('rr.title')}
            </Button>

            <Card>
              <CardContent className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Payment Not Available</h2>
                <p className="text-muted-foreground mb-4">
                  {booking.status === 'pending' 
                    ? 'Your booking is still pending approval from the host. You will be able to pay once the host confirms your booking.'
                    : `This booking is currently in "${booking.status}" status and cannot accept payment.`}
                </p>
                <Button onClick={() => navigate('/profile?tab=reservations')}>
                  View My Reservations
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/profile?tab=reservations')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('rr.title')}
          </Button>

          <div className="space-y-6">
            {/* Booking Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  {t('pay.summary')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {booking.property_photo ? (
                    <img 
                      src={booking.property_photo}
                      alt={booking.property_title}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                      <Home className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{booking.property_title}</h3>
                    <p className="text-sm text-muted-foreground">{t('pay.hosted_by')} {booking.host_name}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(booking.check_in_date), 'MMM d')} - {format(new Date(booking.check_out_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {t('pay.payment_details')}
                </CardTitle>
                <CardDescription>
                  {t('pay.payment_details_desc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('host_booking.property_total')}</span>
                    <span>{formatPrice(booking.total_price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('booking.service_fee')} (5%)</span>
                    <span>{formatPrice(booking.guest_service_fee)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg">
                    <span className="font-medium">{t('host_booking.total_due')}</span>
                    <span className="font-bold text-primary">{formatPrice(totalCharge)}</span>
                  </div>
                </div>

                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">{t('pay.escrow_title')}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('pay.escrow_desc')}
                      </p>
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => handlePayment(false)}
                  disabled={processing || booking.payment_status === 'paid'}
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t('pay.processing')}
                    </>
                  ) : booking.payment_status === 'paid' ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t('pay.toast.already_paid')}
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      {t('pay.pay_button', { amount: formatPrice(totalCharge) })}
                    </>
                  )}
                </Button>

                <Button 
                  className="w-full border-dashed border-2 border-yellow-500 bg-yellow-50 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-200 dark:hover:bg-yellow-950/50" 
                  size="lg"
                  variant="outline"
                  onClick={() => handlePayment(true)}
                  disabled={processing || booking.payment_status === 'paid'}
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
                      {t('pay.processing')}
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      {t('pay.sandbox_button', { amount: formatPrice(totalCharge) })}
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  {t('pay.terms_notice')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Payment;
