import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  Lock,
  Users
} from 'lucide-react';
import { format } from 'date-fns';

const PayRemaining: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { formatPrice, getStripeCurrency } = useCurrency();
  const { t } = useLanguage();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

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
          remaining_payment_amount,
          remaining_payment_status,
          status,
          host_check_in_confirmed_at,
          guest_check_in_confirmed_at,
          full_payment_locked,
          properties (title, photos)
        `)
        .eq('id', bookingId)
        .eq('guest_id', user?.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          title: "Booking Not Found",
          description: "Could not find this booking",
          variant: "destructive"
        });
        navigate('/profile?tab=reservations');
        return;
      }

      setBooking(data);

      // Check if already paid
      if (data.remaining_payment_status === 'paid' || data.full_payment_locked) {
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

  const handlePayRemaining = async () => {
    if (!booking || !user) return;

    // GUARD: Already paid
    if (booking.remaining_payment_status === 'paid' || booking.full_payment_locked) {
      toast({
        title: "Already Paid",
        description: "The remaining amount has already been paid",
        variant: "destructive"
      });
      setPaymentComplete(true);
      return;
    }

    // GUARD: Must be in correct status
    if (booking.status !== 'awaiting_remaining_payment') {
      toast({
        title: "Cannot Process Payment",
        description: `Booking is in "${booking.status}" status. Expected: awaiting_remaining_payment`,
        variant: "destructive"
      });
      return;
    }

    // GUARD: Both must have confirmed check-in
    if (!booking.host_check_in_confirmed_at || !booking.guest_check_in_confirmed_at) {
      toast({
        title: t('pay_rem.toast.checkin_not_confirmed'),
        description: t('pay_rem.toast.checkin_not_confirmed_desc'),
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('pay-remaining', {
        body: {
          bookingId: booking.id,
          returnUrl: window.location.href,
          currency: getStripeCurrency(),
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

  // Handle Stripe redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const sessionId = urlParams.get('session_id');
    const type = urlParams.get('type');
    const canceled = urlParams.get('canceled');

    if (success || canceled) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (success === 'true' && sessionId && type === 'remaining') {
      // Verify and update booking
      verifyRemainingPayment(sessionId);
    } else if (canceled === 'true') {
      toast({
        title: t('pay.toast.cancelled'),
        description: t('pay.toast.cancelled_desc'),
        variant: "destructive"
      });
    }
  }, [booking]);

  const verifyRemainingPayment = async (sessionId: string) => {
    try {
      // Update booking status to checked_in and lock full payment
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'checked_in',
          remaining_payment_status: 'paid',
          remaining_payment_paid_at: new Date().toISOString(),
          full_payment_locked: true,
          full_payment_locked_at: new Date().toISOString(),
          actual_check_in: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (error) throw error;

      setPaymentComplete(true);
      toast({
        title: t('pay.toast.success_title'),
        description: t('pay_rem.toast.success')
      });
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      toast({
        title: t('pay.toast.verify_error'),
        description: t('pay.toast.verify_failed_desc'),
        variant: "destructive"
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !booking) return null;

  const remainingAmount = booking.remaining_payment_amount || (booking.total_price - (booking.deposit_amount || 0));
  const propertyTitle = booking.properties?.title || 'Property';

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
                <h2 className="text-2xl font-bold mb-2">{t('pay_rem.success_title')}</h2>
                <p className="text-muted-foreground mb-6">
                  {t('pay_rem.success_desc', { amount: formatPrice(booking.total_price) })}
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => navigate('/profile?tab=reservations')}>
                    {t('rr.title')}
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

  // Cannot pay - wrong status
  if (booking.status !== 'awaiting_remaining_payment') {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Payment Not Available</h2>
                <p className="text-muted-foreground mb-4">
                  {t('pay_rem.not_available_desc', { status: booking.status })}
                </p>
                <Button onClick={() => navigate('/profile?tab=reservations')}>
                  {t('rr.title')}
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  {t('pay_rem.title')}
                </CardTitle>
                <CardDescription>
                  {t('pay_rem.desc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Confirmation status */}
                <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg">
                  <p className="font-medium text-green-800 dark:text-green-200 mb-2">
                    {t('pay_rem.both_confirmed')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>{t('pay_rem.host_confirmed')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>{t('pay_rem.you_confirmed')}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Payment breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('pay_rem.total_booking')}</span>
                    <span>{formatPrice(booking.total_price)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('pay_rem.deposit_paid')}</span>
                    <span className="text-green-600">-{formatPrice(booking.deposit_amount || 0)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>{t('pay_rem.remaining_amount')}</span>
                    <span>{formatPrice(remainingAmount)}</span>
                  </div>
                </div>

                {/* Escrow info */}
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-800 dark:text-blue-200">{t('pay_rem.escrow_title')}</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      {t('pay_rem.escrow_desc')}
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={handlePayRemaining}
                  disabled={processing}
                  className="w-full"
                  size="lg"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t('pay.processing')}
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      {t('pay.pay_button', { amount: formatPrice(remainingAmount) })}
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  {t('pay_rem.stripe_notice')}
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

export default PayRemaining;
