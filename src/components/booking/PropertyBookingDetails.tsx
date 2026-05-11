
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Users, CalendarDays, CreditCard } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLanguage } from "@/contexts/LanguageContext";

type Property = Tables<"properties">;

interface BookingDetails {
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  totalPrice: number;
  pricePerNight?: number;
}

interface PropertyBookingDetailsProps {
  property: Property;
  bookingDetails: BookingDetails;
}

const PropertyBookingDetails = ({ property, bookingDetails }: PropertyBookingDetailsProps) => {
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const pricePerNight = bookingDetails.pricePerNight || property.price_per_night;
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {property.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{property.city}, {property.governorate}, Tunisia</span>
            </div>
            
            <Badge variant="outline">{property.property_type}</Badge>
            
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{bookingDetails.guests} {t('booking.guests')}</span>
              </div>
              <div className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                <span>{bookingDetails.nights} {t('property.nights_label')}</span>
              </div>
            </div>

            {bookingDetails.checkIn && bookingDetails.checkOut && (
              <div className="bg-muted p-3 rounded">
                <p className="text-sm font-medium">{t('host_booking.dates')}</p>
                <p className="text-sm">
                  {new Date(bookingDetails.checkIn).toLocaleDateString()} to {new Date(bookingDetails.checkOut).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('host_booking.cost_breakdown')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>{formatPrice(pricePerNight)} × {bookingDetails.nights} {t('property.nights_label')}</span>
              <span>{formatPrice(bookingDetails.totalPrice)}</span>
            </div>
            
            <Separator />
            
            <div className="flex justify-between font-medium">
              <span>{t('booking.total')}</span>
              <span>{formatPrice(bookingDetails.totalPrice)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('property.cancellation_policy')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className="mb-2">
            {property.cancellation_policy || "Moderate"}
          </Badge>
          <p className="text-sm text-muted-foreground">
            {property.cancellation_policy === 'Flexible' && 
              t('property.cancellation_flexible')}
            {property.cancellation_policy === 'Moderate' && 
              t('property.cancellation_moderate')}
            {property.cancellation_policy === 'Strict' && 
              t('property.cancellation_strict')}
            {property.cancellation_policy === 'Super Strict' && 
              t('property.cancellation_super_strict')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PropertyBookingDetails;
