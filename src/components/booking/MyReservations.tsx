import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  Home, 
  CreditCard, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  ArrowRight,
  MessageSquare,
  AlertTriangle,
  Lock,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { format, differenceInHours, differenceInMinutes, differenceInDays } from 'date-fns';
import CancellationDialog from './CancellationDialog';
import DisputeDialog from './DisputeDialog';
import CheckInConfirmation from './CheckInConfirmation';
import CheckOutConfirmation from './CheckOutConfirmation';
import TripItineraryDialog from './TripItineraryDialog';
import PostStayReviewNudge from './PostStayReviewNudge';
import { CalendarDays } from 'lucide-react';

interface Reservation {
  id: string;
  property_id: string;
  property_title: string;
  property_photo: string | null;
  property_check_in_time: string | null;
  property_check_out_time: string | null;
  property_address: string | null;
  property_city: string | null;
  property_governorate: string | null;
  property_google_maps_url: string | null;
  property_coordinates: any | null;
  host_id: string;
  host_name: string;
  check_in_date: string;
  check_out_date: string;
  total_price: number;
  deposit_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  host_response: string | null;
  actual_check_out: string | null;
  settlement_due_at: string | null;
  host_check_in_confirmed_at: string | null;
  guest_check_in_confirmed_at: string | null;
  host_check_out_confirmed_at: string | null;
  guest_check_out_confirmed_at: string | null;
  remaining_payment_amount: number | null;
  remaining_payment_status: string | null;
  full_payment_locked: boolean;
  escrow_status: string | null;
  refund_amount: number | null;
  refund_status: string | null;
  responded_at: string | null;
}

// Simplified status display for MVP - users see clear, simple statuses
const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<any> }> = {
  pending: { label: 'Pending Approval', variant: 'secondary', icon: Clock },
  confirmed: { label: 'Approved - Pay Now', variant: 'default', icon: CheckCircle },
  awaiting_payment: { label: 'Approved - Pay Now', variant: 'default', icon: CheckCircle },
  deposit_paid: { label: 'Paid - Awaiting Check-in', variant: 'default', icon: CheckCircle },
  payment_authorized: { label: 'Paid - Awaiting Check-in', variant: 'default', icon: CheckCircle },
  payment_held: { label: 'Paid - Awaiting Check-in', variant: 'default', icon: CheckCircle },
  awaiting_checkin: { label: 'Ready for Check-in', variant: 'default', icon: Home },
  checked_in: { label: 'Checked In', variant: 'default', icon: Home },
  checked_out: { label: 'Completed', variant: 'secondary', icon: CheckCircle },
  settlement_pending: { label: 'Completed', variant: 'secondary', icon: CheckCircle },
  dispute_window: { label: 'Completed', variant: 'secondary', icon: CheckCircle },
  settled: { label: 'Completed', variant: 'default', icon: CheckCircle },
  checkin_dispute: { label: 'Issue Reported', variant: 'destructive', icon: AlertCircle },
  disputed: { label: 'Issue Reported', variant: 'destructive', icon: AlertCircle },
  refunded: { label: 'Refunded', variant: 'secondary', icon: CreditCard },
  declined: { label: 'Declined', variant: 'destructive', icon: XCircle },
  cancelled_by_guest: { label: 'Cancelled', variant: 'destructive', icon: XCircle },
  cancelled_by_host: { label: 'Cancelled by Host', variant: 'destructive', icon: XCircle },
  cancelled_by_system: { label: 'Auto-Cancelled', variant: 'destructive', icon: XCircle },
  auto_cancelled: { label: 'Auto-Cancelled', variant: 'destructive', icon: XCircle },
  payment_failed: { label: 'Payment Failed', variant: 'destructive', icon: AlertCircle },
};

const MyReservations: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [itineraryOpen, setItineraryOpen] = useState(false);
  const [itineraryBookingId, setItineraryBookingId] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) {
      fetchReservations();

      // Subscribe to real-time booking updates
      const channel = supabase
        .channel('my-reservations-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookings',
            filter: `guest_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Booking update received:', payload);
            fetchReservations();
            
            // Show toast for status changes
            if (payload.eventType === 'UPDATE' && payload.new && payload.old) {
              const oldStatus = (payload.old as any).status;
              const newStatus = (payload.new as any).status;
              if (oldStatus !== newStatus) {
                const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;
                toast({
                  title: "Booking Updated",
                  description: `Your booking status changed to: ${statusLabel}`
                });
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchReservations = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select(`
          id,
          property_id,
          host_id,
          check_in_date,
          check_out_date,
          total_price,
          deposit_amount,
          status,
          payment_status,
          created_at,
          host_response,
          actual_check_out,
          settlement_due_at,
          host_check_in_confirmed_at,
          guest_check_in_confirmed_at,
          host_check_out_confirmed_at,
          guest_check_out_confirmed_at,
          remaining_payment_amount,
          remaining_payment_status,
          full_payment_locked,
          escrow_status,
          refund_amount,
          refund_status,
          responded_at,
          properties (
            title,
            photos,
            check_in_time,
            check_out_time,
            address,
            city,
            governorate,
            google_maps_url,
            coordinates
          )
        `)
        .eq('guest_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get host profiles
      const hostIds = [...new Set(bookingsData?.map(b => b.host_id) || [])];
      const { data: hostProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', hostIds);

      const hostMap = new Map(hostProfiles?.map(p => [p.id, p]) || []);

      const formattedReservations: Reservation[] = bookingsData?.map(booking => {
        const host = hostMap.get(booking.host_id);
        const photos = (booking.properties as any)?.photos;
        const firstPhoto = Array.isArray(photos) && photos.length > 0 ? photos[0]?.url : null;
        
        return {
          id: booking.id,
          property_id: booking.property_id,
          property_title: (booking.properties as any)?.title || 'Property',
          property_photo: firstPhoto,
          property_check_in_time: (booking.properties as any)?.check_in_time || null,
          property_check_out_time: (booking.properties as any)?.check_out_time || null,
          property_address: (booking.properties as any)?.address || null,
          property_city: (booking.properties as any)?.city || null,
          property_governorate: (booking.properties as any)?.governorate || null,
          property_google_maps_url: (booking.properties as any)?.google_maps_url || null,
          property_coordinates: (booking.properties as any)?.coordinates || null,
          host_id: booking.host_id,
          host_name: host?.full_name || 'Host',
          check_in_date: booking.check_in_date,
          check_out_date: booking.check_out_date,
          total_price: booking.total_price,
          deposit_amount: booking.deposit_amount || booking.total_price,
          status: booking.status || 'pending',
          payment_status: booking.payment_status || 'pending',
          created_at: booking.created_at,
          host_response: booking.host_response,
          actual_check_out: booking.actual_check_out,
          settlement_due_at: booking.settlement_due_at,
          host_check_in_confirmed_at: booking.host_check_in_confirmed_at,
          guest_check_in_confirmed_at: booking.guest_check_in_confirmed_at,
          host_check_out_confirmed_at: booking.host_check_out_confirmed_at,
          guest_check_out_confirmed_at: booking.guest_check_out_confirmed_at,
          remaining_payment_amount: booking.remaining_payment_amount,
          remaining_payment_status: booking.remaining_payment_status,
          full_payment_locked: booking.full_payment_locked || false,
          escrow_status: booking.escrow_status,
          refund_amount: booking.refund_amount,
          refund_status: booking.refund_status,
          responded_at: booking.responded_at || null
        };
      }) || [];

      setReservations(formattedReservations);

      // Fetch reviews left by this user for these bookings
      const bookingIds = formattedReservations.map(r => r.id);
      if (bookingIds.length > 0) {
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('booking_id')
          .eq('user_id', user.id)
          .in('booking_id', bookingIds);
        setReviewedBookingIds(new Set((reviewsData || []).map(r => r.booking_id)));
      }
    } catch (error) {
      console.error('Error fetching reservations:', error);
      toast({
        title: "Error",
        description: "Failed to load your reservations",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getNextAction = (reservation: Reservation): { text: string; action: () => void; variant?: "default" | "secondary" | "outline" }[] => {
    // Single source of truth: payment_status === 'paid' means deposit is paid
    const isDepositPaid = reservation.payment_status === 'paid';
    const actions: { text: string; action: () => void; variant?: "default" | "secondary" | "outline" }[] = [];

    switch (reservation.status) {
      case 'confirmed':
      case 'awaiting_payment':
        if (isDepositPaid) {
          actions.push({
            text: 'View Details',
            action: () => navigate(`/property/${reservation.property_id}`),
            variant: 'secondary'
          });
        } else {
          actions.push({
            text: 'Pay Now',
            action: () => navigate(`/payment/${reservation.id}`),
            variant: 'default'
          });
          actions.push({
            text: 'Message Host',
            action: () => navigate(`/profile?tab=inbox`),
            variant: 'outline'
          });
        }
        break;
      case 'deposit_paid':
      case 'payment_authorized':
      case 'payment_held':
      case 'awaiting_checkin':
        actions.push({
          text: 'View Details',
          action: () => navigate(`/property/${reservation.property_id}`),
          variant: 'secondary'
        });
        break;
      case 'checked_in':
        actions.push({
          text: 'View Stay Details',
          action: () => navigate(`/property/${reservation.property_id}`),
          variant: 'secondary'
        });
        break;
      case 'checked_out':
      case 'settlement_pending':
      case 'dispute_window':
      case 'settled':
        if (reviewedBookingIds.has(reservation.id)) {
          actions.push({
            text: 'View Review',
            action: () => navigate(`/property/${reservation.property_id}#reviews`),
            variant: 'secondary'
          });
        } else {
          actions.push({
            text: 'Leave Review',
            action: () => navigate(`/property/${reservation.property_id}#reviews`),
            variant: 'secondary'
          });
        }
        break;
      case 'pending':
        actions.push({
          text: 'View Property',
          action: () => navigate(`/property/${reservation.property_id}`),
          variant: 'outline'
        });
        break;
    }
    return actions;
  };

  const getDisputeWindowRemaining = (reservation: Reservation): { hours: number; minutes: number } | null => {
    // NEW: Dispute window is 24h from check-in, only when checked_in
    if (reservation.status !== 'checked_in') {
      return null;
    }
    
    // Use host_check_in_confirmed_at as the start of the 24h dispute window
    if (!reservation.host_check_in_confirmed_at) return null;
    
    const disputeDeadline = new Date(new Date(reservation.host_check_in_confirmed_at).getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    if (disputeDeadline <= now) return null;
    
    const totalMinutes = differenceInMinutes(disputeDeadline, now);
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60
    };
  };

  const canFileDispute = (reservation: Reservation): boolean => {
    const remaining = getDisputeWindowRemaining(reservation);
    return remaining !== null && (remaining.hours > 0 || remaining.minutes > 0);
  };

  // Calculate countdown to check-in time
  const getCheckInCountdown = (reservation: Reservation): { days: number; hours: number; minutes: number } | null => {
    const checkInDate = new Date(reservation.check_in_date);
    
    if (reservation.property_check_in_time) {
      const timeParts = reservation.property_check_in_time.split(':');
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10) || 0;
      checkInDate.setHours(hours, minutes, 0, 0);
    } else {
      checkInDate.setHours(14, 0, 0, 0);
    }
    
    const now = currentTime;
    const diff = checkInDate.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes };
  };

  // Calculate countdown to check-out time
  const getCheckOutCountdown = (reservation: Reservation): { days: number; hours: number; minutes: number } | null => {
    const checkOutDate = new Date(reservation.check_out_date);
    
    if (reservation.property_check_out_time) {
      const timeParts = reservation.property_check_out_time.split(':');
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10) || 0;
      checkOutDate.setHours(hours, minutes, 0, 0);
    } else {
      checkOutDate.setHours(11, 0, 0, 0); // Default 11 AM
    }
    
    const now = currentTime;
    const diff = checkOutDate.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes };
  };

  // Calculate deposit payment deadline countdown (24h from host confirmation)
  const getDepositDeadlineCountdown = (reservation: Reservation): { hours: number; minutes: number } | null => {
    if (!reservation.responded_at) return null;
    if (reservation.payment_status === 'paid') return null;
    if (!['confirmed', 'awaiting_payment'].includes(reservation.status)) return null;

    const deadline = new Date(new Date(reservation.responded_at).getTime() + 24 * 60 * 60 * 1000);
    const now = currentTime;
    const diff = deadline.getTime() - now.getTime();

    if (diff <= 0) return { hours: 0, minutes: 0 };

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes };
  };

  const handleOpenCancelDialog = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setCancelDialogOpen(true);
  };

  const handleOpenDisputeDialog = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setDisputeDialogOpen(true);
  };
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">{t('guest_booking.my_reservations')}</h2>
        <p className="text-muted-foreground">
          {t('guest_booking.manage_desc')}
        </p>
      </div>

      <PostStayReviewNudge />

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>{t('guest_booking.loading')}</p>
        </div>
      ) : reservations.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">{t('guest_booking.no_reservations')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('guest_booking.no_reservations_desc')}
            </p>
            <Button onClick={() => navigate('/search')}>
              {t('guest_booking.browse_properties')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reservations.map((reservation) => {
            const statusConfig = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            const nextAction = getNextAction(reservation);
            const canCancel = ['pending', 'confirmed', 'awaiting_payment', 'deposit_paid', 'payment_authorized', 'payment_held'].includes(reservation.status);
            const disputeRemaining = getDisputeWindowRemaining(reservation);
            const showDisputeButton = canFileDispute(reservation);

            // GUEST CHECK-IN/CHECKOUT CONFIRMATION LOGIC
            const showGuestCheckIn = ['deposit_paid', 'awaiting_checkin'].includes(reservation.status);
            const showGuestCheckOut = reservation.status === 'checked_in';

            return (
              <Card key={reservation.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-start gap-4">
                      {reservation.property_photo ? (
                        <img 
                          src={reservation.property_photo} 
                          alt={reservation.property_title}
                          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                          <Home className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-lg">
                          {reservation.property_title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {t('guest_booking.hosted_by')} {reservation.host_name}
                        </p>
                        <Badge
                          variant={statusConfig.variant}
                          className="mt-2 flex items-center gap-1 w-fit"
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                        {['confirmed','awaiting_payment','deposit_paid','payment_authorized','payment_held','awaiting_checkin','awaiting_remaining_payment','checked_in'].includes(reservation.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => { setItineraryBookingId(reservation.id); setItineraryOpen(true); }}
                          >
                            <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
                            View itinerary
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">{formatPrice(reservation.total_price)}</p>
                      <p className="text-sm text-muted-foreground">
                        + {formatPrice(Math.round(reservation.total_price * 0.05))} {t('booking.service_fee').toLowerCase()}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('booking.checkin')}</p>
                      <p className="font-medium">{format(new Date(reservation.check_in_date), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('booking.checkout')}</p>
                      <p className="font-medium">{format(new Date(reservation.check_out_date), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('host_booking.booked_on')}</p>
                      <p className="font-medium">{format(new Date(reservation.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('host_booking.payment')}</p>
                      <p className="font-medium capitalize">{reservation.payment_status}</p>
                    </div>
                  </div>

                  {/* Dispute window countdown - 24h from check-in */}
                  {disputeRemaining && (
                    <div className={`p-3 rounded-lg flex items-center gap-2 ${
                      disputeRemaining.hours < 6 
                        ? 'bg-destructive/10 text-destructive' 
                        : 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300'
                    }`}>
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {t('guest_booking.report_damage')}: {disputeRemaining.hours}h {disputeRemaining.minutes}m
                      </span>
                    </div>
                  )}

                  {/* Deposit payment deadline countdown */}
                  {(() => {
                    const depositCountdown = getDepositDeadlineCountdown(reservation);
                    if (!depositCountdown) return null;
                    const isUrgent = depositCountdown.hours < 6;
                    return (
                      <div className={`p-4 rounded-lg ${
                        isUrgent 
                          ? 'bg-destructive/10 border border-destructive/30' 
                          : 'bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${isUrgent ? 'bg-destructive/20' : 'bg-orange-100 dark:bg-orange-900'}`}>
                            <Clock className={`h-5 w-5 ${isUrgent ? 'text-destructive' : 'text-orange-600 dark:text-orange-400'}`} />
                          </div>
                          <div className="flex-1">
                            <p className={`font-medium text-sm ${isUrgent ? 'text-destructive' : 'text-orange-800 dark:text-orange-200'}`}>
                              {depositCountdown.hours === 0 && depositCountdown.minutes === 0
                                ? t('guest_booking.deposit_expired')
                                : `${t('guest_booking.pay_deposit_within')}: ${depositCountdown.hours}h ${depositCountdown.minutes}m`
                              }
                            </p>
                            <p className={`text-xs mt-0.5 ${isUrgent ? 'text-destructive/80' : 'text-orange-600 dark:text-orange-400'}`}>
                              {t('guest_booking.auto_cancel_warning')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {reservation.host_response && (
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm font-medium flex items-center gap-1 mb-1">
                        <MessageSquare className="h-4 w-4" />
                        {t('guest_booking.host_response')}
                      </p>
                      <p className="text-sm text-muted-foreground">{reservation.host_response}</p>
                    </div>
                  )}

                  {/* GUEST CHECK-IN CONFIRMATION WITH COUNTDOWN */}
                  {showGuestCheckIn && (() => {
                    const checkInCountdown = getCheckInCountdown(reservation);
                    
                    return (
                      <>
                        {checkInCountdown && (
                          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                            <CardContent className="pt-4">
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
                            </CardContent>
                          </Card>
                        )}
                        <div className="pt-2">
                          <CheckInConfirmation
                            bookingId={reservation.id}
                            role="guest"
                            hostConfirmed={!!reservation.host_check_in_confirmed_at}
                            guestConfirmed={!!reservation.guest_check_in_confirmed_at}
                            onConfirmed={fetchReservations}
                            checkInCountdown={checkInCountdown}
                          />
                        </div>
                      </>
                    );
                  })()}

                  {/* PAY REMAINING section removed — full payment is now upfront */}

                  {/* GUEST CHECK-OUT CONFIRMATION */}
                  {showGuestCheckOut && (() => {
                    const checkOutCountdown = getCheckOutCountdown(reservation);
                    
                    return (
                      <>
                        {checkOutCountdown && (
                          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                            <CardContent className="pt-4">
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
                            </CardContent>
                          </Card>
                        )}
                        <div className="pt-2">
                          <CheckOutConfirmation
                            bookingId={reservation.id}
                            role="guest"
                            hostConfirmed={!!reservation.host_check_out_confirmed_at}
                            guestConfirmed={!!reservation.guest_check_out_confirmed_at}
                            onConfirmed={fetchReservations}
                            checkOutCountdown={checkOutCountdown}
                          />
                        </div>
                      </>
                    );
                  })()}

                  {/* ESCROW INFO BOX */}
                  {reservation.escrow_status === 'held' && !reservation.status?.startsWith('cancelled') && (
                    <div className="p-3 rounded-lg flex items-start gap-2 bg-green-50 dark:bg-green-950/30">
                      <Lock className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-600" />
                      <div className="text-sm">
                        <p className="font-medium text-green-800 dark:text-green-200">{t('guest_booking.escrow_secured')}</p>
                        <p className="text-green-700 dark:text-green-300">
                          {formatPrice(reservation.total_price)} {t('guest_booking.escrow_secured_desc')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* PROPERTY LOCATION - Show after deposit is paid */}
                  {reservation.payment_status === 'paid' && (reservation.property_address || reservation.property_google_maps_url || reservation.property_coordinates) && (
                    <div className="p-3 rounded-lg flex items-start gap-2 bg-accent/50 border border-border">
                      <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
                      <div className="text-sm flex-1">
                        <p className="font-medium text-foreground">{t('guest_booking.property_location')}</p>
                        {reservation.property_address && (
                          <p className="text-muted-foreground">
                            {reservation.property_address}, {reservation.property_city}, {reservation.property_governorate}
                          </p>
                        )}
                        {!reservation.property_address && reservation.property_city && (
                          <p className="text-muted-foreground">
                            {reservation.property_city}, {reservation.property_governorate}
                          </p>
                        )}
                        {reservation.property_google_maps_url && (
                          <button 
                            type="button"
                            onClick={() => window.open(reservation.property_google_maps_url, '_blank', 'noopener,noreferrer')}
                            className="inline-flex items-center gap-1 text-primary hover:underline mt-1 text-sm cursor-pointer bg-transparent border-none p-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {t('guest_booking.open_maps')}
                          </button>
                        )}
                        {!reservation.property_google_maps_url && reservation.property_coordinates && (
                          <button 
                            type="button"
                            onClick={() => window.open(`https://maps.google.com/?q=${(reservation.property_coordinates as any).lat},${(reservation.property_coordinates as any).lng}`, '_blank', 'noopener,noreferrer')}
                            className="inline-flex items-center gap-1 text-primary hover:underline mt-1 text-sm cursor-pointer bg-transparent border-none p-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {t('guest_booking.open_maps')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* REFUND INFO - Show when booking is cancelled and refunded */}
                  {reservation.escrow_status === 'refunded' && reservation.refund_amount > 0 && (
                    <div className="p-3 rounded-lg flex items-start gap-2 bg-green-50 dark:bg-green-950/30">
                      <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-600" />
                      <div className="text-sm">
                        <p className="font-medium text-green-800 dark:text-green-200">{t('guest_booking.refund_processed')}</p>
                        <p className="text-green-700 dark:text-green-300">
                          {formatPrice(reservation.refund_amount)} {t('guest_booking.refund_desc')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action buttons based on status */}
                  {(nextAction.length > 0 || canCancel || showDisputeButton) && (
                    <>
                      <Separator />
                      <div className="flex gap-2 flex-wrap">
                        {nextAction.map((action, idx) => (
                          <Button 
                            key={idx}
                            onClick={action.action}
                            variant={action.variant}
                            className="flex items-center gap-2"
                          >
                            {action.text}
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        ))}
                        {showDisputeButton && (
                          <Button 
                            variant="destructive"
                            onClick={() => handleOpenDisputeDialog(reservation)}
                            className="flex items-center gap-2"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            {t('guest_booking.file_dispute')}
                          </Button>
                        )}
                        {canCancel && (
                          <Button 
                            variant="outline"
                            onClick={() => handleOpenCancelDialog(reservation)}
                          >
                            {t('host_booking.cancel_booking')}
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cancellation Dialog */}
      <CancellationDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        bookingId={selectedReservation?.id || ''}
        cancelledBy="guest"
        onCancelled={() => {
          fetchReservations();
          setSelectedReservation(null);
        }}
      />

      {/* Dispute Dialog */}
      <DisputeDialog
        open={disputeDialogOpen}
        onOpenChange={setDisputeDialogOpen}
        bookingId={selectedReservation?.id || ''}
        bookingStatus={selectedReservation?.status}
        propertyTitle={selectedReservation?.property_title || ''}
        onDisputeFiled={() => {
          fetchReservations();
          setSelectedReservation(null);
        }}
      />

      {/* Trip Itinerary Dialog */}
      {itineraryBookingId && (
        <TripItineraryDialog
          open={itineraryOpen}
          onOpenChange={(o) => { setItineraryOpen(o); if (!o) setItineraryBookingId(null); }}
          bookingId={itineraryBookingId}
        />
      )}
    </div>
  );
};

export default MyReservations;
