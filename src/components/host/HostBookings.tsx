import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  Home, 
  User, 
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users
} from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import HostBookingActions from '@/components/booking/HostBookingActions';
import HostGuestReview from '@/components/booking/HostGuestReview';

interface HostBooking {
  id: string;
  property_id: string;
  property_title: string;
  property_photo: string | null;
  property_check_in_time: string | null;
  property_check_out_time: string | null;
  guest_id: string;
  guest_name: string;
  check_in_date: string;
  check_out_date: string;
  total_price: number;
  deposit_amount: number;
  num_guests: number;
  status: string;
  payment_status: string;
  created_at: string;
  request_message: string | null;
  actual_check_in: string | null;
  actual_check_out: string | null;
  settlement_due_at: string | null;
  host_payout_amount: number | null;
  platform_commission: number | null;
  // Escrow fields
  escrow_status: string | null;
  host_check_in_confirmed_at: string | null;
  guest_check_in_confirmed_at: string | null;
  host_check_out_confirmed_at: string | null;
  guest_check_out_confirmed_at: string | null;
  remaining_payment_status: string | null;
  full_payment_locked: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<any> }> = {
  pending: { label: 'Pending', variant: 'secondary', icon: Clock },
  confirmed: { label: 'Confirmed', variant: 'default', icon: CheckCircle },
  awaiting_payment: { label: 'Awaiting Payment', variant: 'default', icon: CreditCard },
  deposit_paid: { label: 'Deposit Paid', variant: 'default', icon: CheckCircle },
  awaiting_checkin: { label: 'Awaiting Check-in', variant: 'default', icon: Clock },
  awaiting_remaining_payment: { label: 'Awaiting Remaining Payment', variant: 'default', icon: CreditCard },
  checkin_dispute: { label: 'Check-in Dispute', variant: 'destructive', icon: AlertCircle },
  payment_authorized: { label: 'Payment Authorized', variant: 'default', icon: CheckCircle },
  payment_held: { label: 'Payment Held', variant: 'default', icon: CheckCircle },
  checked_in: { label: 'Checked In', variant: 'default', icon: Home },
  checked_out: { label: 'Checked Out', variant: 'secondary', icon: CheckCircle },
  settlement_pending: { label: 'Settlement Pending', variant: 'secondary', icon: Clock },
  dispute_window: { label: 'Dispute Window', variant: 'outline', icon: AlertCircle },
  settled: { label: 'Settled', variant: 'default', icon: CheckCircle },
  disputed: { label: 'Disputed', variant: 'destructive', icon: AlertCircle },
  refunded: { label: 'Refunded', variant: 'secondary', icon: CreditCard },
  declined: { label: 'Declined', variant: 'destructive', icon: XCircle },
  cancelled_by_guest: { label: 'Cancelled by Guest', variant: 'destructive', icon: XCircle },
  cancelled_by_host: { label: 'Cancelled', variant: 'destructive', icon: XCircle },
};

const HostBookings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'active' | 'past' | 'all'>('all');
  const [selectedBooking, setSelectedBooking] = useState<HostBooking | null>(null);

  useEffect(() => {
    if (user) {
      fetchBookings();

      // Subscribe to real-time booking updates
      const channel = supabase
        .channel('host-bookings-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookings',
            filter: `host_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Host booking update received:', payload);
            fetchBookings();
            
            // Show toast for status changes
            if (payload.eventType === 'UPDATE' && payload.new && payload.old) {
              const oldStatus = (payload.old as any).status;
              const newStatus = (payload.new as any).status;
              if (oldStatus !== newStatus) {
                const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;
                toast({
                  title: t('host_booking.update_received'),
                  description: t('host_booking.status_changed', { status: statusLabel })
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

  const fetchBookings = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select(`
          id,
          property_id,
          guest_id,
          check_in_date,
          check_out_date,
          total_price,
          deposit_amount,
          num_guests,
          status,
          payment_status,
          created_at,
          request_message,
          actual_check_in,
          actual_check_out,
          settlement_due_at,
          host_payout_amount,
          platform_commission,
          escrow_status,
          host_check_in_confirmed_at,
          guest_check_in_confirmed_at,
          host_check_out_confirmed_at,
          guest_check_out_confirmed_at,
          remaining_payment_status,
          full_payment_locked,
          properties (
            title,
            photos,
            check_in_time,
            check_out_time
          )
        `)
        .eq('host_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get guest profiles
      const guestIds = [...new Set(bookingsData?.map(b => b.guest_id) || [])];
      const { data: guestProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', guestIds);

      const guestMap = new Map(guestProfiles?.map(p => [p.id, p]) || []);

      const formattedBookings: HostBooking[] = bookingsData?.map(booking => {
        const guest = guestMap.get(booking.guest_id);
        const photos = (booking.properties as any)?.photos;
        const firstPhoto = Array.isArray(photos) && photos.length > 0 ? photos[0]?.url : null;
        
        return {
          id: booking.id,
          property_id: booking.property_id,
          property_title: (booking.properties as any)?.title || 'Property',
          property_photo: firstPhoto,
          property_check_in_time: (booking.properties as any)?.check_in_time || null,
          property_check_out_time: (booking.properties as any)?.check_out_time || null,
          guest_id: booking.guest_id,
          guest_name: guest?.full_name || 'Guest',
          check_in_date: booking.check_in_date,
          check_out_date: booking.check_out_date,
          total_price: booking.total_price,
          deposit_amount: booking.deposit_amount || Math.round(booking.total_price * 0.2),
          num_guests: booking.num_guests || 1,
          status: booking.status || 'pending',
          payment_status: booking.payment_status || 'pending',
          created_at: booking.created_at,
          request_message: booking.request_message,
          actual_check_in: booking.actual_check_in,
          actual_check_out: booking.actual_check_out,
          settlement_due_at: booking.settlement_due_at,
          host_payout_amount: booking.host_payout_amount,
          platform_commission: booking.platform_commission,
          // Escrow fields
          escrow_status: booking.escrow_status,
          host_check_in_confirmed_at: booking.host_check_in_confirmed_at,
          guest_check_in_confirmed_at: booking.guest_check_in_confirmed_at,
          host_check_out_confirmed_at: booking.host_check_out_confirmed_at,
          guest_check_out_confirmed_at: booking.guest_check_out_confirmed_at,
          remaining_payment_status: booking.remaining_payment_status,
          full_payment_locked: booking.full_payment_locked || false
        };
      }) || [];

      setBookings(formattedBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: t('prof.error'),
        description: t('host_booking.load_fail'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getFilteredBookings = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return bookings.filter(booking => {
      const checkIn = new Date(booking.check_in_date);
      const checkOut = new Date(booking.check_out_date);
      
      switch (filter) {
        case 'upcoming':
          return checkIn >= today && !['cancelled_by_guest', 'cancelled_by_host', 'declined'].includes(booking.status);
        case 'active':
          return booking.status === 'checked_in';
        case 'past':
          return checkOut < today || ['settled', 'cancelled_by_guest', 'cancelled_by_host', 'declined', 'refunded'].includes(booking.status);
        default:
          return true;
      }
    });
  };

  const getDisputeWindowRemaining = (booking: HostBooking): string | null => {
    if (!['checked_out', 'settlement_pending', 'dispute_window'].includes(booking.status)) {
      return null;
    }
    
    let disputeDeadline: Date;
    if (booking.settlement_due_at) {
      disputeDeadline = new Date(booking.settlement_due_at);
    } else if (booking.actual_check_out) {
      disputeDeadline = new Date(new Date(booking.actual_check_out).getTime() + 48 * 60 * 60 * 1000);
    } else {
      return null;
    }
    
    const now = new Date();
    if (disputeDeadline <= now) return null;
    
    const totalMinutes = differenceInMinutes(disputeDeadline, now);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return t('host_booking.h_remaining', { h: hours, m: minutes });
  };

  const filteredBookings = getFilteredBookings();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">{t('host_booking.all_bookings')}</h2>
        <p className="text-muted-foreground">
          {t('host_booking.manage_desc')}
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">{t('host_booking.all')} ({bookings.length})</TabsTrigger>
          <TabsTrigger value="upcoming">{t('host_booking.upcoming')}</TabsTrigger>
          <TabsTrigger value="active">{t('host_booking.active')}</TabsTrigger>
          <TabsTrigger value="past">{t('host_booking.past')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>{t('host_booking.loading')}</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">{t('host_booking.no_bookings')}</h3>
            <p className="text-muted-foreground">
              {filter === 'all' 
                ? t('host_booking.no_bookings_yet')
                : `${t('host_booking.no')} ${filter} ${t('host_booking.bookings_suffix')}`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredBookings.map((booking) => {
            const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            const disputeRemaining = getDisputeWindowRemaining(booking);

            return (
              <Card key={booking.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-start gap-4">
                      {booking.property_photo ? (
                        <img 
                          src={booking.property_photo} 
                          alt={booking.property_title}
                          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                          <Home className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-lg">
                          {booking.property_title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <User className="h-3 w-3" />
                          {booking.guest_name}
                          <span className="mx-1">•</span>
                          <Users className="h-3 w-3" />
                          {booking.num_guests > 1 
                            ? t('host_booking.guests_count', { count: booking.num_guests })
                            : t('host_booking.guest_count', { count: booking.num_guests })}
                        </p>
                        <Badge 
                          variant={statusConfig.variant}
                          className="mt-2 flex items-center gap-1 w-fit"
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">{formatPrice(booking.total_price)}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('host_booking.deposit_label')}: {formatPrice(booking.deposit_amount)}
                      </p>
                      {booking.status === 'settled' && booking.host_payout_amount && (
                        <p className="text-sm text-green-600 font-medium mt-1">
                          {t('host_booking.payout_label')}: {formatPrice(booking.host_payout_amount)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('booking.checkin')}</p>
                      <p className="font-medium">{format(new Date(booking.check_in_date), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('booking.checkout')}</p>
                      <p className="font-medium">{format(new Date(booking.check_out_date), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('host_booking.booked_on')}</p>
                      <p className="font-medium">{format(new Date(booking.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('host_booking.payment')}</p>
                      <p className="font-medium capitalize">{booking.payment_status}</p>
                    </div>
                  </div>

                  {/* Dispute window countdown */}
                  {disputeRemaining && (
                    <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-lg flex items-center gap-2 text-orange-700 dark:text-orange-300">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {t('host_booking.settlement_in', { time: disputeRemaining })}
                      </span>
                    </div>
                  )}

                  {/* Payout summary for settled bookings */}
                  {booking.status === 'settled' && booking.host_payout_amount && (
                    <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">{t('host_booking.payout_summary')}</p>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-green-700 dark:text-green-300">{t('booking.total')}</p>
                          <p className="font-medium">{formatPrice(booking.total_price)}</p>
                        </div>
                        <div>
                          <p className="text-green-700 dark:text-green-300">{t('host_booking.platform_fee')}</p>
                          <p className="font-medium">{formatPrice(booking.platform_commission || 0)}</p>
                        </div>
                        <div>
                          <p className="text-green-700 dark:text-green-300">{t('host_booking.net_payout')}</p>
                          <p className="font-medium text-green-600">{formatPrice(booking.host_payout_amount)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {booking.request_message && (
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm font-medium mb-1">{t('host_booking.guest_message')}</p>
                      <p className="text-sm text-muted-foreground">{booking.request_message}</p>
                    </div>
                  )}

                  <Separator />

                  {/* Host booking actions */}
                  <HostBookingActions
                    booking={{
                      id: booking.id,
                      status: booking.status,
                      check_in_date: booking.check_in_date,
                      check_out_date: booking.check_out_date,
                      actual_check_in: booking.actual_check_in,
                      actual_check_out: booking.actual_check_out,
                      guest_name: booking.guest_name,
                      property_title: booking.property_title,
                      total_price: booking.total_price,
                      deposit_amount: booking.deposit_amount,
                      // Pass escrow fields
                      escrow_status: booking.escrow_status || undefined,
                      host_check_in_confirmed_at: booking.host_check_in_confirmed_at,
                      guest_check_in_confirmed_at: booking.guest_check_in_confirmed_at,
                      host_check_out_confirmed_at: booking.host_check_out_confirmed_at,
                      guest_check_out_confirmed_at: booking.guest_check_out_confirmed_at,
                      remaining_payment_status: booking.remaining_payment_status || undefined,
                      full_payment_locked: booking.full_payment_locked,
                      property_check_in_time: booking.property_check_in_time,
                      property_check_out_time: booking.property_check_out_time,
                      payment_status: booking.payment_status
                    }}
                    onUpdate={fetchBookings}
                  />

                  {/* Host can review the guest after checkout */}
                  {['checked_out', 'settlement_pending', 'dispute_window', 'settled'].includes(booking.status) && booking.actual_check_out && (
                    <HostGuestReview
                      bookingId={booking.id}
                      guestId={booking.guest_id}
                      guestName={booking.guest_name}
                      propertyId={booking.property_id}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HostBookings;
