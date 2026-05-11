
import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, Home, User, MessageSquare, CheckCircle, XCircle, Star } from 'lucide-react';
import { format } from 'date-fns';
import VerifiedBadge from '@/components/VerifiedBadge';
import { useNavigate } from 'react-router-dom';

type BookingRequest = {
  id: string;
  property_id: string;
  property_title: string;
  guest_id: string;
  guest_name: string;
  guest_avatar?: string | null;
  guest_verified?: boolean;
  guest_rating?: number;
  guest_review_count?: number;
  check_in_date: string;
  check_out_date: string;
  total_price: number;
  request_message: string;
  status: string;
  created_at: string;
};

const ReservationRequests: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingToId, setRespondingToId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchBookingRequests();
    }
  }, [user]);

  const fetchBookingRequests = async () => {
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
          request_message,
          status,
          created_at,
          properties (
            title
          )
        `)
        .eq('host_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get unique guest profiles + verification + ratings
      const guestIds = [...new Set(bookingsData?.map(booking => booking.guest_id) || [])];
      const [{ data: profilesData }, { data: guestReviewData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, verification_status')
          .in('id', guestIds),
        supabase
          .from('guest_reviews')
          .select('guest_id, rating')
          .eq('status', 'approved')
          .in('guest_id', guestIds),
      ]);

      const guestMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      const ratingMap = new Map<string, { sum: number; count: number }>();
      (guestReviewData || []).forEach((r: any) => {
        const cur = ratingMap.get(r.guest_id) || { sum: 0, count: 0 };
        cur.sum += r.rating;
        cur.count += 1;
        ratingMap.set(r.guest_id, cur);
      });

      const formattedRequests: BookingRequest[] = bookingsData?.map(booking => {
        const guest = guestMap.get(booking.guest_id) as any;
        const rt = ratingMap.get(booking.guest_id);
        return {
          id: booking.id,
          property_id: booking.property_id,
          property_title: (booking.properties as any)?.title || 'Property',
          guest_id: booking.guest_id,
          guest_name: guest?.full_name || 'Unknown Guest',
          guest_avatar: guest?.avatar_url || null,
          guest_verified: guest?.verification_status === 'verified',
          guest_rating: rt && rt.count > 0 ? rt.sum / rt.count : undefined,
          guest_review_count: rt?.count || 0,
          check_in_date: booking.check_in_date,
          check_out_date: booking.check_out_date,
          total_price: booking.total_price,
          request_message: booking.request_message || '',
          status: booking.status,
          created_at: booking.created_at
        };
      }) || [];

      setRequests(formattedRequests);
    } catch (error) {
      console.error('Error fetching booking requests:', error);
      toast({
        title: "Error",
        description: t('rr.load_failed'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResponse = async (requestId: string, action: 'accept' | 'decline') => {
    if (!user) return;
    
    try {
      const request = requests.find(r => r.id === requestId);
      const status = action === 'accept' ? 'confirmed' : 'declined';
      
      const { error } = await supabase
        .from('bookings')
        .update({
          status,
          host_response: responseMessage.trim() || null,
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      // Send email notification to guest
      if (request) {
        try {
          await supabase.functions.invoke('send-notification-email', {
            body: {
              userId: request.guest_id,
              type: action === 'accept' ? 'booking_confirmed' : 'booking_declined',
              propertyTitle: request.property_title,
              amount: action === 'accept' ? Math.round(request.total_price * 0.2) : undefined,
              currency: 'TND'
            }
          });
          console.log(`Booking ${action} email sent to guest`);
        } catch (emailError) {
          console.error('Failed to send booking response email:', emailError);
        }
      }

      // Create or update conversation if accepted
      if (action === 'accept') {
        const request = requests.find(r => r.id === requestId);
        if (request) {
          // Check if conversation exists
          const { data: existingConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('property_id', request.property_id)
            .eq('host_id', user.id)
            .eq('guest_id', request.guest_id)
            .single();

          if (!existingConv) {
            // Create new conversation
            await supabase
              .from('conversations')
              .insert({
                property_id: request.property_id,
                host_id: user.id,
                guest_id: request.guest_id,
                booking_id: requestId
              });
          } else {
            // Update existing conversation with booking_id
            await supabase
              .from('conversations')
              .update({ booking_id: requestId })
              .eq('id', existingConv.id);
          }
        }
      }

      // Remove from requests list
      setRequests(prev => prev.filter(r => r.id !== requestId));
      setRespondingToId(null);
      setResponseMessage('');

      toast({
        title: action === 'accept' ? t('rr.accepted') : t('rr.declined'),
        description: t('rr.responded_desc', { action: action === 'accept' ? t('rr.accept').toLowerCase() : t('rr.decline').toLowerCase() })
      });

    } catch (error) {
      console.error('Error responding to request:', error);
      toast({
        title: "Error",
        description: t('rr.failed'),
        variant: "destructive"
      });
    }
  };

  if (!user) return null;

  const pendingCount = requests.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
            {t('rr.title')}
            {pendingCount > 0 && (
              <Badge variant="destructive" className="text-sm">
                {t('rr.pending', { count: pendingCount })}
              </Badge>
            )}
          </h2>
          <p className="text-muted-foreground">{t('rr.subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>{t('rr.loading')}</p>
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">{t('rr.empty_title')}</h3>
            <p className="text-muted-foreground">{t('rr.empty_desc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center text-lg">
                      <Home className="h-5 w-5 mr-2 shrink-0" />
                      <span className="truncate">{request.property_title}</span>
                    </CardTitle>
                    <button
                      type="button"
                      onClick={() => navigate(`/user/${request.guest_id}`)}
                      className="mt-2 flex items-center gap-2 flex-wrap text-sm hover:underline"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{request.guest_name}</span>
                      {request.guest_verified && <VerifiedBadge size="xs" showLabel={false} />}
                      {request.guest_review_count && request.guest_review_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {request.guest_rating?.toFixed(1)} · {request.guest_review_count} {request.guest_review_count !== 1 ? t('rr.reviews') : t('rr.review')}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('rr.new_guest')}</span>
                      )}
                    </button>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {format(new Date(request.created_at), 'MMM d, yyyy')}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium">{t('rr.checkin')}</Label>
                    <p className="text-sm">{format(new Date(request.check_in_date), 'MMM d, yyyy')}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">{t('rr.checkout')}</Label>
                    <p className="text-sm">{format(new Date(request.check_out_date), 'MMM d, yyyy')}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">{t('rr.total_price')}</Label>
                    <p className="text-sm font-semibold">{request.total_price} TND</p>
                  </div>
                </div>

                {request.request_message && (
                  <div>
                    <Label className="text-sm font-medium flex items-center">
                      <MessageSquare className="h-4 w-4 mr-1" />
                      {t('rr.guest_message')}
                    </Label>
                    <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                      {request.request_message}
                    </p>
                  </div>
                )}

                <Separator />

                {respondingToId === request.id ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="response">{t('rr.your_response')}</Label>
                      <Textarea
                        id="response"
                        placeholder={t('rr.response_ph')}
                        value={responseMessage}
                        onChange={(e) => setResponseMessage(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleRequestResponse(request.id, 'accept')}
                        className="flex items-center"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t('rr.accept')}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleRequestResponse(request.id, 'decline')}
                        className="flex items-center"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        {t('rr.decline')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRespondingToId(null);
                          setResponseMessage('');
                        }}
                      >
                        {t('rr.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={() => setRespondingToId(request.id)}>
                      {t('rr.respond')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReservationRequests;
