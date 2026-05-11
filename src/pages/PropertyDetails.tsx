import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, Users, Bed, Bath, ArrowLeft,
  CheckCircle, Wifi, Car, Coffee, Tv, AirVent, Waves, Shield,
  AlarmSmoke, FireExtinguisher, Heart, Loader2, Pencil
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PropertyImageGallery from "@/components/property/PropertyImageGallery";
import PropertyReviews from "@/components/property/PropertyReviews";
import PropertyBookingCard from "@/components/property/PropertyBookingCard";
import PropertySharingMeta from "@/components/property/PropertySharingMeta";
import SharePropertyButton from "@/components/property/SharePropertyButton";
import SavePropertyButton from "@/components/property/SavePropertyButton";
import HostProfileCard from "@/components/property/HostProfileCard";
import AdminPropertyEditor from "@/components/admin/AdminPropertyEditor";
import { usePropertyTranslation } from "@/hooks/usePropertyTranslation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { applyPublicPropertyFilter } from "@/lib/propertyVisibility";
import VerifiedBadge from "@/components/VerifiedBadge";

type Property = Tables<"properties">;

const PropertyDetails = () => {
  const { id, shortCode } = useParams<{ id?: string; shortCode?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [propertyStatus, setPropertyStatus] = useState<string>("Loading...");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { translatedContent, isTranslating } = usePropertyTranslation(property);
  const { language, t } = useLanguage();

  useEffect(() => {
    if (id || shortCode) {
      fetchProperty();
    }
  }, [id, shortCode]);

  // Track auth readiness for view tracking
  const [authReady, setAuthReady] = useState(false);
  
  useEffect(() => {
    // Wait for auth to settle before tracking
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setAuthReady(true);
    });
    // Also set ready after a timeout for anonymous users
    const timeout = setTimeout(() => setAuthReady(true), 1500);
    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (property) {
      checkPropertyStatus();
    }
  }, [property]);
  
  // Separate effect for view tracking that waits for auth
  useEffect(() => {
    if (property && authReady) {
      trackPropertyView();
    }
  }, [property, authReady]);

  // Track visit duration on page exit
  useEffect(() => {
    if (!property) return;
    
    const viewStartTime = Date.now();
    const viewIdKey = `view_id_${property.id}`;
    
    const updateViewDuration = async () => {
      const viewId = sessionStorage.getItem(viewIdKey);
      if (!viewId) return;
      
      const durationSeconds = Math.floor((Date.now() - viewStartTime) / 1000);
      const isBounce = durationSeconds < 15; // Bounce if less than 15 seconds (quality view threshold)
      
      try {
        await supabase.from('property_views').update({
          duration_seconds: durationSeconds,
          is_bounce: isBounce,
          exit_at: new Date().toISOString(),
        }).eq('id', viewId);
      } catch (error) {
        console.error('Error updating view duration:', error);
      }
    };

    // Use visibilitychange for more reliable tracking (works on mobile too)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateViewDuration();
      }
    };

    // Fallback for desktop browsers
    const handleBeforeUnload = () => {
      updateViewDuration();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also update on component unmount (navigation within the app)
      updateViewDuration();
    };
  }, [property]);

  const getReferrerType = (referrer: string): string => {
    if (!referrer) return 'direct';
    
    const currentHost = window.location.host;
    try {
      const referrerUrl = new URL(referrer);
      if (referrerUrl.host === currentHost) {
        // Internal referrer - check the path
        if (referrerUrl.pathname === '/' || referrerUrl.pathname === '') {
          return 'homepage';
        } else if (referrerUrl.pathname.includes('/search')) {
          return 'search';
        } else {
          return 'internal';
        }
      } else {
        // External referrer
        if (referrerUrl.host.includes('facebook') || referrerUrl.host.includes('fb.')) {
          return 'facebook';
        } else if (referrerUrl.host.includes('instagram')) {
          return 'instagram';
        } else if (referrerUrl.host.includes('twitter') || referrerUrl.host.includes('x.com')) {
          return 'twitter';
        } else if (referrerUrl.host.includes('whatsapp')) {
          return 'whatsapp';
        } else if (referrerUrl.host.includes('google')) {
          return 'google';
        } else {
          return 'external';
        }
      }
    } catch {
      return 'direct';
    }
  };

  const trackPropertyView = async () => {
    if (!property) return;
    
    // Get current auth session to ensure we have the right user
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id || null;
    
    // Skip tracking if the viewer is the host
    if (currentUserId && currentUserId === property.host_id) {
      console.log('Skipping view tracking: viewer is the host');
      return;
    }
    
    // Generate or get session ID from sessionStorage
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      sessionStorage.setItem('session_id', sessionId);
    }
    
    // Check if we already tracked this property in this session
    const viewedKey = `viewed_${property.id}`;
    const viewIdKey = `view_id_${property.id}`;
    if (sessionStorage.getItem(viewedKey)) {
      console.log('View already tracked for this property in this session');
      return;
    }
    
    const referrerType = getReferrerType(document.referrer);
    
    try {
      console.log('Tracking property view:', { 
        propertyId: property.id, 
        sessionId, 
        referrerType, 
        viewerId: currentUserId,
        referrer: document.referrer 
      });
      
      const insertData: any = {
        property_id: property.id,
        session_id: sessionId,
        referrer: document.referrer || null,
        referrer_type: referrerType,
        user_agent: navigator.userAgent || null,
      };
      
      // Only set viewer_id if authenticated
      if (currentUserId) {
        insertData.viewer_id = currentUserId;
      }
      
      const { data, error } = await supabase.from('property_views')
        .insert(insertData)
        .select('id')
        .single();
      
      if (error) {
        console.error('Error inserting property view:', error.message, error.details, error.hint);
        return;
      }
      
      if (data) {
        console.log('Property view tracked successfully:', data.id);
        sessionStorage.setItem(viewIdKey, data.id);
      }
      
      sessionStorage.setItem(viewedKey, 'true');
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  const fetchProperty = async () => {
    setLoading(true);
    try {
      let query = applyPublicPropertyFilter(
        supabase.from("properties").select("*")
      );
      
      // Query by short_code or id
      if (shortCode) {
        query = query.eq("short_code", shortCode);
      } else if (id) {
        query = query.eq("id", id);
      }
      
      const { data, error } = await query.single();

      if (error) {
        console.error("Error fetching property:", error);
        toast({
          title: "Error",
          description: "Property not found",
          variant: "destructive"
        });
        navigate("/search");
        return;
      }

      setProperty(data);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to load property",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkPropertyStatus = async () => {
    if (!property) return;
    
    try {
      // Check for active or upcoming bookings
      const { data, error } = await supabase
        .from("bookings")
        .select("id, property_id, check_in_date, check_out_date, status")
        .eq("property_id", property.id)
        .gte("check_out_date", new Date().toISOString().split('T')[0]);

      if (error) {
        console.error("Error checking bookings:", error);
        setPropertyStatus("Available");
        return;
      }

      if (!data || data.length === 0) {
        setPropertyStatus("Available");
        return;
      }
      
      // Check if there's a current booking (check-in date <= today <= check-out date)
      const today = new Date().toISOString().split('T')[0];
      const currentBooking = data.find(booking => 
        booking.check_in_date <= today && booking.check_out_date >= today
      );
      
      if (currentBooking) {
        setPropertyStatus("Occupied");
        return;
      }
      
      setPropertyStatus("Reserved");
    } catch (error) {
      console.error("Error checking property status:", error);
      setPropertyStatus("Available");
    }
  };

  // shareProperty function removed - now using SharePropertyButton component

  const getPropertyImages = (photos: any) => {
    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return ["/placeholder.svg"];
    }
    // Fix: Type check and safely access the url property
    return photos.map((photo: any) => {
      return (photo && typeof photo === 'object' && photo.url) ? photo.url : "/placeholder.svg";
    });
  };

  const getAmenityIcon = (amenity: string) => {
    switch (amenity.toLowerCase()) {
      case 'wifi': return <Wifi className="h-4 w-4" />;
      case 'parking': return <Car className="h-4 w-4" />;
      case 'kitchen': return <Coffee className="h-4 w-4" />;
      case 'tv': return <Tv className="h-4 w-4" />;
      case 'air conditioning': return <AirVent className="h-4 w-4" />;
      case 'pool': return <Waves className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  // Get safety features with icons
  const getSafetyFeatureIcon = (feature: string) => {
    switch (feature) {
      case 'smoke_detector': return <AlarmSmoke className="h-4 w-4" />;
      case 'carbon_monoxide_detector': return <AlarmSmoke className="h-4 w-4" />;
      case 'first_aid_kit': return <Heart className="h-4 w-4" />;
      case 'fire_extinguisher': return <FireExtinguisher className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'reserved': return 'bg-yellow-100 text-yellow-800';
      case 'occupied': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>{t('property.loading')}</p>
          </div>
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
          <div className="text-center">
            <p className="text-muted-foreground">{t('property.not_found')}</p>
            <Button onClick={() => navigate("/search")} className="mt-4">
              {t('property.back_to_search')}
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const images = getPropertyImages(property.photos);
  const amenities = Array.isArray(property.amenities) ? property.amenities : [];
  const safetyFeatures = Array.isArray(property.safety_features) ? property.safety_features : [];

  return (
    <div className="min-h-screen">
      <Header />
      
      {/* Property sharing metadata */}
      {property && <PropertySharingMeta property={property} />}
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold">
                {translatedContent?.title || property.title}
              </h1>
              {(property as any).is_verified && (
                <VerifiedBadge size="md" tooltip="This property has been verified by Samsari" />
              )}
              {isTranslating && (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              <SavePropertyButton propertyId={property.id} />
              <SharePropertyButton 
                propertyId={property.id}
                shortCode={property.short_code}
                title={property.title}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground mb-6">
            <MapPin className="h-4 w-4" />
            <span>{property.city}, {property.governorate}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Images and Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <PropertyImageGallery images={images} title={property.title} />

            {/* Host Profile Card */}
            <HostProfileCard hostId={property.host_id} propertyTitle={property.title} />

            {/* Property Info */}
            <Card>
              <CardHeader>
                <CardTitle>{t('property.details')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{property.max_guests} guests</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bed className="h-4 w-4" />
                    <span>{property.bedrooms} bedrooms</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bath className="h-4 w-4" />
                    <span>{property.bathrooms} bathrooms</span>
                  </div>
                </div>
                
                <Badge variant="outline">{property.property_type}</Badge>
                
                <p className="text-muted-foreground">{translatedContent?.description || property.description}</p>

                {/* Display minimum stay */}
                {property.minimum_stay && property.minimum_stay > 1 && (
                  <div className="bg-muted p-3 rounded-md text-sm">
                    <p className="font-medium">Minimum stay: {property.minimum_stay} nights</p>
                  </div>
                )}

                {/* Check-in/out times */}
                {(property.check_in_time || property.check_out_time) && (
                  <div className="flex flex-wrap gap-6 text-sm">
                    {property.check_in_time && (
                      <div>
                        <p className="font-medium">Check-in time</p>
                        <p className="text-muted-foreground">{property.check_in_time}</p>
                      </div>
                    )}
                    {property.check_out_time && (
                      <div>
                        <p className="font-medium">Check-out time</p>
                        <p className="text-muted-foreground">{property.check_out_time}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sleeping Arrangements */}
            {property.bed_types && Array.isArray(property.bed_types) && property.bed_types.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('property.sleeping')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {property.bed_types.map((bedConfig: any, index: number) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="flex items-center mb-2">
                          <Bed className="h-5 w-5 mr-2 text-muted-foreground" />
                          <span className="font-medium">Bedroom {index + 1}</span>
                        </div>
                        <p className="text-sm">
                          {bedConfig.beds} {bedConfig.type} bed{bedConfig.beds !== 1 ? 's' : ''}
                        </p>
                      </div>
                    ))}
                    
                    {property.extra_beds > 0 && (
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center mb-2">
                          <Bed className="h-5 w-5 mr-2 text-muted-foreground" />
                          <span className="font-medium">Extra beds</span>
                        </div>
                        <p className="text-sm">
                          {property.extra_beds} extra bed{property.extra_beds !== 1 ? 's' : ''} available
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Safety Features */}
            {safetyFeatures.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('property.safety_features')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {safetyFeatures.map((feature: string, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        {getSafetyFeatureIcon(feature)}
                        <span className="text-sm">
                          {feature.split('_').map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Amenities */}
            {amenities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('property.amenities')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {amenities.map((amenity: string, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        {getAmenityIcon(amenity)}
                        <span className="text-sm">{amenity}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* House Rules */}
            {(property.house_rules || translatedContent?.house_rules) && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('property.house_rules')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-line">{translatedContent?.house_rules || property.house_rules}</p>
                </CardContent>
              </Card>
            )}

            {/* Cancellation Policy */}
            {property.cancellation_policy && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('property.cancellation_policy')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className="mb-2">{property.cancellation_policy}</Badge>
                  <p className="text-sm text-muted-foreground">
                    {property.cancellation_policy === 'Flexible' && 
                      'Full refund if cancelled at least 24 hours before check-in. Partial refund thereafter.'}
                    {property.cancellation_policy === 'Moderate' && 
                      'Full refund if cancelled 5 days before check-in. Partial refund thereafter.'}
                    {property.cancellation_policy === 'Strict' && 
                      'Full refund if cancelled 14 days before check-in. No refund thereafter.'}
                    {property.cancellation_policy === 'Super Strict' && 
                      'No refunds for cancellations. We recommend travel insurance for this property.'}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Reviews Section */}
            <PropertyReviews propertyId={property.id} />
          </div>

          {/* Booking Card */}
          <div className="lg:col-span-1">
            <PropertyBookingCard property={property} />
          </div>
        </div>
      </main>

      <Footer />
      
      {/* Admin Property Editor Dialog */}
      {isAdmin && property && (
        <AdminPropertyEditor
          property={property}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          onPropertyUpdated={fetchProperty}
        />
      )}
    </div>
  );
};

export default PropertyDetails;
