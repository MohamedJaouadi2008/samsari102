
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { useBlockedDates } from '@/hooks/useBlockedDates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Users, MessageSquare, AlertCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface PropertyBookingCardProps {
  property: {
    id: string;
    price_per_night: number;
    minimum_stay?: number;
    host_id: string;
  };
}

const PropertyBookingCard: React.FC<PropertyBookingCardProps> = ({ property }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [guests, setGuests] = useState(1);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { formatPrice } = useCurrency();
  const { isDateBlocked, blockedDates } = useBlockedDates(property.id);

  const isHost = user?.id === property.host_id;
  const nights = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0;
  const totalPrice = nights * property.price_per_night;
  const minimumStay = property.minimum_stay || 1;

  const handleReserve = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (isHost) {
      toast({
        title: "Cannot book own property",
        description: "You cannot make a reservation for your own property",
        variant: "destructive"
      });
      return;
    }

    if (!checkIn || !checkOut) {
      toast({
        title: "Missing dates",
        description: "Please select check-in and check-out dates",
        variant: "destructive"
      });
      return;
    }

    if (nights < minimumStay) {
      toast({
        title: "Minimum stay requirement",
        description: `This property requires a minimum stay of ${minimumStay} night${minimumStay > 1 ? 's' : ''}`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Store booking details in localStorage for booking confirmation page
      const bookingDetails = {
        propertyId: property.id,
        checkIn: format(checkIn, 'yyyy-MM-dd'),
        checkOut: format(checkOut, 'yyyy-MM-dd'),
        guests,
        nights,
        totalPrice,
        message: message.trim(),
        pricePerNight: property.price_per_night
      };

      localStorage.setItem('bookingDetails', JSON.stringify(bookingDetails));

      // Navigate to booking confirmation page
      navigate(`/booking/${property.id}`);

    } catch (error) {
      console.error('Navigation error:', error);
      toast({
        title: "Error",
        description: "There was an error. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContactHost = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (isHost) {
      toast({
        title: "Cannot message yourself",
        description: "This is your own property",
        variant: "destructive"
      });
      return;
    }

    try {
      // Check if conversation exists
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('property_id', property.id)
        .eq('host_id', property.host_id)
        .eq('guest_id', user.id)
        .single();

      if (!existingConv) {
        // Create new conversation
        await supabase
          .from('conversations')
          .insert({
            property_id: property.id,
            host_id: property.host_id,
            guest_id: user.id
          });
      }

      navigate('/profile?tab=inbox');
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive"
      });
    }
  };

  if (isHost) {
    return (
      <Card className="sticky top-6">
        <CardHeader>
          <CardTitle>Your Property</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              This is your property listing
            </p>
            <Button 
              variant="outline" 
              onClick={() => navigate('/profile?tab=properties')}
              className="w-full"
            >
              Manage Property
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>{formatPrice(property.price_per_night)}</span>
          <span className="text-sm font-normal text-muted-foreground">per night</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="checkin">Check-in</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="checkin"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !checkIn && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {checkIn ? format(checkIn, "MMM dd") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkIn}
                  onSelect={setCheckIn}
                  disabled={(date) => date < new Date() || isDateBlocked(date)}
                  modifiers={{ booked: blockedDates }}
                  modifiersStyles={{ booked: { textDecoration: 'line-through', opacity: 0.5 } }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label htmlFor="checkout">Check-out</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="checkout"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !checkOut && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {checkOut ? format(checkOut, "MMM dd") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkOut}
                  onSelect={setCheckOut}
                  disabled={(date) => !checkIn || date <= checkIn || isDateBlocked(date)}
                  modifiers={{ booked: blockedDates }}
                  modifiersStyles={{ booked: { textDecoration: 'line-through', opacity: 0.5 } }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {checkIn && checkOut && nights > 0 && (() => {
          const hasConflict = (() => {
            const current = new Date(checkIn);
            while (current < checkOut) {
              if (isDateBlocked(current)) return true;
              current.setDate(current.getDate() + 1);
            }
            return false;
          })();
          return hasConflict ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>This property is already booked for some of your selected dates. Please choose different dates.</span>
            </div>
          ) : null;
        })()}

        <div>
          <Label htmlFor="guests">Guests</Label>
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Input
              id="guests"
              type="number"
              min="1"
              value={guests}
              onChange={(e) => setGuests(Math.max(1, parseInt(e.target.value) || 1))}
              className="flex-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="message">Message to Host (Optional)</Label>
          <Textarea
            id="message"
            placeholder="Tell the host about your trip..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
          />
        </div>

        {checkIn && checkOut && nights > 0 && (
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <div className="flex justify-between">
              <span>{formatPrice(property.price_per_night)} × {nights} night{nights > 1 ? 's' : ''}</span>
              <span>{formatPrice(totalPrice)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Service fee (5%)</span>
              <span>{formatPrice(Math.round(totalPrice * 0.05))}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Total Due</span>
              <span>{formatPrice(totalPrice + Math.round(totalPrice * 0.05))}</span>
            </div>
            {nights < minimumStay && (
              <p className="text-sm text-destructive">
                Minimum stay: {minimumStay} night{minimumStay > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Button 
            onClick={handleReserve} 
            disabled={loading || !checkIn || !checkOut || nights < minimumStay}
            className="w-full"
          >
            {loading ? "Processing..." : "Reserve"}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleContactHost}
            className="w-full flex items-center"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Contact Host
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          You won't be charged yet. The host needs to approve your request.
        </p>
      </CardContent>
    </Card>
  );
};

export default PropertyBookingCard;
