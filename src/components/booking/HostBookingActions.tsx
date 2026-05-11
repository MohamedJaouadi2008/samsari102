import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  LogIn, 
  LogOut, 
  XCircle, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Lock,
  DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import CancellationDialog from './CancellationDialog';
import CheckInConfirmation from './CheckInConfirmation';
import CheckOutConfirmation from './CheckOutConfirmation';

interface Booking {
  id: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  actual_check_in: string | null;
  actual_check_out: string | null;
  guest_name: string;
  property_title: string;
  total_price: number;
  deposit_amount: number;
  escrow_status?: string;
  host_check_in_confirmed_at?: string | null;
  guest_check_in_confirmed_at?: string | null;
  host_check_out_confirmed_at?: string | null;
  guest_check_out_confirmed_at?: string | null;
  remaining_payment_status?: string;
  full_payment_locked?: boolean;
  property_check_in_time?: string | null;
  property_check_out_time?: string | null;
  payment_status?: string;
}

interface HostBookingActionsProps {
  booking: Booking;
  onUpdate: () => void;
}

const HostBookingActions: React.FC<HostBookingActionsProps> = ({ booking, onUpdate }) => {
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const [loading, setLoading] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const canCancel = ['pending', 'confirmed', 'awaiting_payment', 'deposit_paid', 'payment_authorized', 'payment_held'].includes(booking.status);

  // Fetch guest ID for email notifications
  const sendGuestNotification = async (type: string, additionalData: Record<string, any> = {}) => {
    try {
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('guest_id, properties(title)')
        .eq('id', booking.id)
        .single();
      
      if (bookingData) {
        await supabase.functions.invoke('send-notification-email', {
          body: {
            userId: bookingData.guest_id,
            type,
            propertyTitle: (bookingData.properties as any)?.title || booking.property_title,
            ...additionalData
          }
        });
      }
    } catch (error) {
      console.error('Failed to send notification email:', error);
    }
  };

  // Manual override handlers for MVP testing (bypasses Stripe)
  const handleMarkDepositReceived = async () => {
    setLoading('deposit');
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'deposit_paid',
          payment_status: 'paid',
          escrow_status: 'held'
        })
        .eq('id', booking.id);

      if (error) throw error;

      // Send deposit confirmation email
      await sendGuestNotification('deposit_received', {
        amount: booking.deposit_amount,
        currency: 'TND'
      });

      toast({
        title: "Deposit Marked as Received",
        description: "The booking is now confirmed with deposit paid."
      });
      onUpdate();
    } catch (error) {
      console.error('Error marking deposit:', error);
      toast({
        title: "Error",
        description: "Failed to update booking status",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const handleMarkCheckedIn = async () => {
    setLoading('checkin');
    try {
      // Full payment already made - go directly to checked_in
      // Set dispute deadline to 24h from now
      const disputeDeadline = new Date();
      disputeDeadline.setHours(disputeDeadline.getHours() + 24);

      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'checked_in',
          host_check_in_confirmed_at: new Date().toISOString(),
          guest_check_in_confirmed_at: new Date().toISOString(),
          actual_check_in: new Date().toISOString(),
          full_payment_locked: true,
          dispute_deadline: disputeDeadline.toISOString()
        })
        .eq('id', booking.id);

      if (error) throw error;

      toast({
        title: "Check-in Confirmed",
        description: "Guest is now checked in. They have 24 hours to report any property issues."
      });
      onUpdate();
    } catch (error) {
      console.error('Error marking check-in:', error);
      toast({
        title: "Error",
        description: "Failed to update booking status",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const handleMarkCompleted = async () => {
    setLoading('complete');
    try {
      const now = new Date().toISOString();
      
      // Step 1: checked_in → checked_out (triggers handle_booking_status_timestamps which auto-transitions to settlement_pending)
      const { error: checkoutError } = await supabase
        .from('bookings')
        .update({
          status: 'checked_out',
          actual_check_out: now,
          host_check_out_confirmed_at: now,
          guest_check_out_confirmed_at: now,
        })
        .eq('id', booking.id);

      if (checkoutError) throw checkoutError;

      // Step 2: settlement_pending → settled
      const { error: settleError } = await supabase
        .from('bookings')
        .update({
          status: 'settled',
          escrow_status: 'released',
          escrow_released_at: now,
          settled_at: now
        })
        .eq('id', booking.id);

      if (settleError) throw settleError;

      await sendGuestNotification('booking_completed', {
        amount: booking.total_price,
        currency: 'TND'
      });

      toast({
        title: "Booking Completed",
        description: "The booking has been marked as complete."
      });
      onUpdate();
    } catch (error) {
      console.error('Error marking complete:', error);
      toast({
        title: "Error",
        description: "Failed to update booking status",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  // Calculate check-in countdown
  const getCheckInCountdown = (): { days: number; hours: number; minutes: number } | null => {
    const checkInDate = new Date(booking.check_in_date);
    
    if (booking.property_check_in_time) {
      const timeParts = booking.property_check_in_time.split(':');
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10) || 0;
      checkInDate.setHours(hours, minutes, 0, 0);
    } else {
      checkInDate.setHours(14, 0, 0, 0); // Default 2 PM
    }
    
    const diff = checkInDate.getTime() - currentTime.getTime();
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes };
  };

  // Calculate check-out countdown
  const getCheckOutCountdown = (): { days: number; hours: number; minutes: number } | null => {
    const checkOutDate = new Date(booking.check_out_date);
    
    if (booking.property_check_out_time) {
      const timeParts = booking.property_check_out_time.split(':');
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10) || 0;
      checkOutDate.setHours(hours, minutes, 0, 0);
    } else {
      checkOutDate.setHours(11, 0, 0, 0); // Default 11 AM
    }
    
    const diff = checkOutDate.getTime() - currentTime.getTime();
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes };
  };

  // Show manual override buttons based on status
  const showMarkDepositReceived = false; // Deposit is handled automatically via Stripe
  const showMarkCheckedIn = booking.status === 'deposit_paid';
  const showMarkCompleted = booking.status === 'checked_in';

  // Show check-in only for deposit_paid or awaiting_checkin (no more awaiting_remaining_payment)
  const showCheckInConfirmation = ['deposit_paid', 'awaiting_checkin'].includes(booking.status);
  // Show checkout when checked_in (full_payment_locked is always true now since 100% paid upfront)
  const showCheckOutConfirmation = booking.status === 'checked_in';
  const showEscrowInfo = booking.escrow_status && booking.escrow_status !== 'pending';

  const checkInCountdown = showCheckInConfirmation ? getCheckInCountdown() : null;
  const checkOutCountdown = showCheckOutConfirmation ? getCheckOutCountdown() : null;

  const isToday = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getEscrowStatusBadge = (status: string) => {
    switch (status) {
      case 'held':
        return <Badge variant="default" className="bg-blue-600"><Lock className="w-3 h-3 mr-1" />Funds Held</Badge>;
      case 'disputed':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Disputed</Badge>;
      case 'ready_for_release':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Ready for Release</Badge>;
      case 'released':
        return <Badge variant="outline"><DollarSign className="w-3 h-3 mr-1" />Released</Badge>;
      default:
        return null;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>{t('host_booking.actions')}</span>
            <div className="flex gap-2">
              <Badge variant="outline">{booking.status.replace(/_/g, ' ')}</Badge>
              {booking.escrow_status && getEscrowStatusBadge(booking.escrow_status)}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Check-in/Check-out dates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('host_booking.checkin_date')}</span>
              <span className={isToday(booking.check_in_date) ? 'font-medium text-primary' : ''}>
                {format(new Date(booking.check_in_date), 'MMM d, yyyy')}
                {isToday(booking.check_in_date) && ` (${t('host_booking.today')})`}
              </span>
            </div>
            {booking.actual_check_in && (
              <div className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-3 w-3" />
                {t('host_booking.checked_in')}: {format(new Date(booking.actual_check_in), 'MMM d, h:mm a')}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('host_booking.checkout_date')}</span>
              <span className={isToday(booking.check_out_date) ? 'font-medium text-primary' : ''}>
                {format(new Date(booking.check_out_date), 'MMM d, yyyy')}
                {isToday(booking.check_out_date) && ` (${t('host_booking.today')})`}
              </span>
            </div>
            {booking.actual_check_out && (
              <div className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-3 w-3" />
                {t('host_booking.checked_out')}: {format(new Date(booking.actual_check_out), 'MMM d, h:mm a')}
              </div>
            )}
          </div>

          <Separator />

          {/* Escrow info */}
          {showEscrowInfo && (
            <div className="bg-muted p-3 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lock className="h-4 w-4" />
                {t('host_booking.escrow_status')}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('host_booking.full_payment')}:</span>
                  <span className="ml-1 font-medium">{formatPrice(booking.total_price)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('host_booking.status')}:</span>
                  <span className="ml-1 font-medium text-green-600">{t('host_booking.secured')} ✓</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('host_booking.escrow_held_desc')}
              </p>
            </div>
          )}

          {/* Check-in countdown timer */}
          {showCheckInConfirmation && checkInCountdown && (
            <div className="border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-blue-800 dark:text-blue-200">Check-in opens in:</p>
                  <div className="flex gap-3 mt-1">
                    {checkInCountdown.days > 0 && (
                      <div className="text-center">
                        <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">{checkInCountdown.days}</span>
                        <p className="text-xs text-blue-600 dark:text-blue-400">days</p>
                      </div>
                    )}
                    <div className="text-center">
                      <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">{checkInCountdown.hours}</span>
                      <p className="text-xs text-blue-600 dark:text-blue-400">hours</p>
                    </div>
                    <div className="text-center">
                      <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">{checkInCountdown.minutes}</span>
                      <p className="text-xs text-blue-600 dark:text-blue-400">mins</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Check-in confirmation (new dual confirmation flow) */}
          {showCheckInConfirmation && (
            <CheckInConfirmation
              bookingId={booking.id}
              role="host"
              hostConfirmed={!!booking.host_check_in_confirmed_at}
              guestConfirmed={!!booking.guest_check_in_confirmed_at}
              onConfirmed={onUpdate}
              checkInCountdown={checkInCountdown}
            />
          )}

          {/* Check-out countdown timer */}
          {showCheckOutConfirmation && checkOutCountdown && (
            <div className="border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-blue-800 dark:text-blue-200">Check-out opens in:</p>
                  <div className="flex gap-3 mt-1">
                    {checkOutCountdown.days > 0 && (
                      <div className="text-center">
                        <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">{checkOutCountdown.days}</span>
                        <p className="text-xs text-blue-600 dark:text-blue-400">days</p>
                      </div>
                    )}
                    <div className="text-center">
                      <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">{checkOutCountdown.hours}</span>
                      <p className="text-xs text-blue-600 dark:text-blue-400">hours</p>
                    </div>
                    <div className="text-center">
                      <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">{checkOutCountdown.minutes}</span>
                      <p className="text-xs text-blue-600 dark:text-blue-400">mins</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Check-out confirmation (new dual confirmation flow) */}
          {showCheckOutConfirmation && (
            <CheckOutConfirmation
              bookingId={booking.id}
              role="host"
              hostConfirmed={!!booking.host_check_out_confirmed_at}
              guestConfirmed={!!booking.guest_check_out_confirmed_at}
              onConfirmed={onUpdate}
              checkOutCountdown={checkOutCountdown}
            />
          )}

          {/* MVP Manual Override Buttons */}
          <Separator />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase">{t('host_booking.manual_actions')}</p>
            
            {showMarkDepositReceived && (
              <Button
                onClick={handleMarkDepositReceived}
                disabled={loading === 'deposit'}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {loading === 'deposit' ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                {t('host_booking.mark_deposit')}
              </Button>
            )}

            {showMarkCheckedIn && (
              <Button
                onClick={handleMarkCheckedIn}
                disabled={loading === 'checkin'}
                className="w-full"
              >
                {loading === 'checkin' ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4 mr-2" />
                )}
                {t('host_booking.mark_checkin')}
              </Button>
            )}

            {showMarkCompleted && (
              <Button
                onClick={handleMarkCompleted}
                disabled={loading === 'complete'}
                className="w-full"
                variant="secondary"
              >
                {loading === 'complete' ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                {t('host_booking.mark_complete')}
              </Button>
            )}
          </div>

          {/* Cancel button */}
          {canCancel && (
            <Button 
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => setShowCancelDialog(true)}
            >
              <XCircle className="h-4 w-4 mr-2" />
              {t('host_booking.cancel_booking')}
            </Button>
          )}

          {/* Settlement info */}
          {['settlement_pending', 'dispute_window', 'checked_out'].includes(booking.status) && (
            <div className="bg-yellow-50 dark:bg-yellow-950/30 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">{t('host_booking.settlement_pending')}</p>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    {t('host_booking.settlement_desc')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {booking.status === 'disputed' && (
            <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-red-800 dark:text-red-200">{t('host_booking.dispute_filed')}</p>
                  <p className="text-red-700 dark:text-red-300">
                    {t('host_booking.dispute_desc')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CancellationDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        bookingId={booking.id}
        cancelledBy="host"
        onCancelled={onUpdate}
      />
    </>
  );
};

export default HostBookingActions;