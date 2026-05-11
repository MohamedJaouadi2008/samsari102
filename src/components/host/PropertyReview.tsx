import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Bed, Bath, DollarSign } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PropertyReviewProps {
  data: any;
  onUpdate: (data: any) => void;
}

const PropertyReview = ({ data }: PropertyReviewProps) => {
  const { t } = useLanguage();
  const currencies = [
    { code: "TND", symbol: "د.ت" },
    { code: "USD", symbol: "$" },
    { code: "EUR", symbol: "€" },
    { code: "GBP", symbol: "£" }
  ];

  const selectedCurrency = currencies.find(c => c.code === (data.currency || "TND"));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">{t('prev.review_title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('prev.review_desc')}
        </p>
      </div>

      {/* Property Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{data.title || t('prev.property_title_ph')}</span>
            <Badge variant="secondary">{data.property_type}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center text-muted-foreground mb-2">
                <MapPin className="h-4 w-4 mr-2" />
                <span>{data.city}, {data.governorate}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {data.description || t('prev.no_description')}
              </p>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  <span>{data.max_guests || 1} {t('prev.guests')}</span>
                </div>
                <div className="flex items-center">
                  <Bed className="h-4 w-4 mr-1" />
                  <span>{data.bedrooms || 1} {t('prev.bedrooms')}</span>
                </div>
                <div className="flex items-center">
                  <Bath className="h-4 w-4 mr-1" />
                  <span>{data.bathrooms || 1} {t('prev.bathrooms')}</span>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center mb-4">
                <DollarSign className="h-4 w-4 mr-2" />
                <span className="text-2xl font-bold">
                  {selectedCurrency?.symbol}{data.price_per_night || "0"}
                </span>
                <span className="text-muted-foreground ml-1">{t('prev.per_night')}</span>
              </div>
              {data.amenities && data.amenities.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">{t('prev.amenities')}</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.amenities.map((amenity: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Photos Preview */}
      {data.photos && data.photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('prev.photos_count', { count: data.photos.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {data.photos.slice(0, 5).map((photo: any, index: number) => (
                <div key={index} className="aspect-square relative">
                  <img
                    src={photo.preview}
                    alt={`Property photo ${index + 1}`}
                    className="w-full h-full object-cover rounded"
                  />
                  {index === 0 && (
                    <div className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-xs px-1 py-0.5 rounded">
                      {t('prev.main')}
                    </div>
                  )}
                </div>
              ))}
              {data.photos.length > 5 && (
                <div className="aspect-square bg-muted rounded flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">
                    {t('prev.more', { count: data.photos.length - 5 })}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle>{t('prev.location')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {data.address || t('prev.no_address')}<br />
            {data.city}, {data.governorate}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PropertyReview;
