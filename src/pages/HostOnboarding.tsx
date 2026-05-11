import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PropertyBasics from "@/components/host/PropertyBasics";
import PropertyDetails from "@/components/host/PropertyDetails";
import PropertyPhotos from "@/components/host/PropertyPhotos";
import PropertyPricing from "@/components/host/PropertyPricing";
import PropertyReview from "@/components/host/PropertyReview";
import SafetyFeaturesForm from "@/components/host/SafetyFeaturesForm";
import HostWelcomeMessage from "@/components/host/HostWelcomeMessage";
import { propertyBasicsSchema, propertyDetailsSchema } from "@/lib/validation";
import { useLanguage } from "@/contexts/LanguageContext";

const HostOnboarding = () => {
  const navigate = useNavigate();
  const { propertyId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);

  // Initial property data with defaults
  const [propertyData, setPropertyData] = useState({
    title: "",
    description: "",
    property_type: "",
    governorate: "",
    city: "",
    address: "",
    bedrooms: 1,
    bathrooms: 1,
    max_guests: 4,
    price_per_night: 0,
    currency: "TND",
    amenities: [],
    photos: [],
    safety_features: [],
    sleeping_arrangements: [],
    bed_types: [],
    extra_beds: 0,
    minimum_stay: 1,
    cancellation_policy: "Moderate",
    check_in_time: "10:00",
    check_out_time: "12:00",
    house_rules: "",
    coordinates: null,
    google_maps_url: "",
    welcome_message: "",
    arrival_instructions: "",
    wifi_name: "",
    wifi_password: "",
    parking_info: "",
    lockbox_code: ""
  });

  useEffect(() => {
    // Wait for auth to finish loading before redirecting
    if (authLoading) return;
    
    if (!user) {
      navigate("/auth");
      return;
    }

    // If propertyId exists, we're editing an existing property
    if (propertyId) {
      setIsEditing(true);
      fetchPropertyData();
    }
  }, [user, navigate, propertyId, authLoading]);

  const fetchPropertyData = async () => {
    if (!propertyId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .eq("host_id", user!.id)
        .single();

      if (error) throw error;
      
      if (data) {
        setPropertyData({
          title: data.title || "",
          description: data.description || "",
          property_type: data.property_type || "",
          governorate: data.governorate || "",
          city: data.city || "",
          address: data.address || "",
          bedrooms: data.bedrooms || 1,
          bathrooms: data.bathrooms || 1,
          max_guests: data.max_guests || 4,
          price_per_night: data.price_per_night || 0,
          currency: data.currency || "TND",
          amenities: Array.isArray(data.amenities) ? data.amenities : [],
          photos: Array.isArray(data.photos) ? data.photos : [],
          safety_features: Array.isArray(data.safety_features) ? data.safety_features : [],
          sleeping_arrangements: Array.isArray(data.sleeping_arrangements) ? data.sleeping_arrangements : [],
          bed_types: Array.isArray(data.bed_types) ? data.bed_types : [],
          extra_beds: data.extra_beds || 0,
          minimum_stay: data.minimum_stay || 1,
          cancellation_policy: data.cancellation_policy || "Moderate",
          check_in_time: data.check_in_time || "10:00",
          check_out_time: data.check_out_time || "12:00",
          house_rules: data.house_rules || "",
          coordinates: data.coordinates || null,
          google_maps_url: data.google_maps_url || "",
          welcome_message: data.welcome_message || "",
          arrival_instructions: (data as any).arrival_instructions || "",
          wifi_name: (data as any).wifi_name || "",
          wifi_password: (data as any).wifi_password || "",
          parking_info: (data as any).parking_info || "",
          lockbox_code: (data as any).lockbox_code || ""
        });
      }
    } catch (error: any) {
      console.error("Error fetching property:", error);
      toast({
        title: t('common.error') || "Error",
        description: t('host_onb.error_load'),
        variant: "destructive"
      });
      navigate("/profile?tab=properties");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: t('host_onb.step_basics'), component: PropertyBasics },
    { number: 2, title: t('host_onb.step_details'), component: PropertyDetails },
    { number: 3, title: t('host_onb.step_photos'), component: PropertyPhotos },
    { number: 4, title: t('host_onb.step_safety'), component: SafetyFeaturesForm },
    { number: 5, title: t('host_onb.step_pricing'), component: PropertyPricing },
    { number: 6, title: t('host_onb.step_welcome'), component: HostWelcomeMessage },
    { number: 7, title: t('host_onb.step_review'), component: PropertyReview }
  ];

  const updatePropertyData = (updates: any) => {
    setPropertyData(prev => ({ ...prev, ...updates }));
    // Clear any existing errors for updated fields
    const updatedFields = Object.keys(updates);
    setErrors(prev => {
      const newErrors = { ...prev };
      updatedFields.forEach(field => {
        delete newErrors[field];
      });
      return newErrors;
    });
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!propertyData.title?.trim()) newErrors.title = t('host_onb.err_title_req');
        if (!propertyData.property_type) newErrors.property_type = t('host_onb.err_type_req');
        if (!propertyData.governorate) newErrors.governorate = t('host_onb.err_gov_req');
        if (!propertyData.city) newErrors.city = t('host_onb.err_city_req');
        break;

      case 2:
        if (!propertyData.bedrooms || propertyData.bedrooms < 1) newErrors.bedrooms = t('host_onb.err_bedrooms_req');
        if (!propertyData.bathrooms || propertyData.bathrooms < 1) newErrors.bathrooms = t('host_onb.err_bathrooms_req');
        if (!propertyData.max_guests || propertyData.max_guests < 1) newErrors.maxGuests = t('host_onb.err_max_guests_req');
        break;

      case 3:
        if (!propertyData.photos || propertyData.photos.length === 0) newErrors.photos = t('host_onb.err_photos_req');
        break;

      case 4:
        break;

      case 5:
        if (!propertyData.price_per_night || propertyData.price_per_night <= 0) newErrors.price_per_night = t('host_onb.err_price_req');
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const saveProperty = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    setLoading(true);
    try {
      // Validate property basics
      const basicsValidation = propertyBasicsSchema.safeParse({
        title: propertyData.title,
        description: propertyData.description,
        property_type: propertyData.property_type,
        governorate: propertyData.governorate,
        city: propertyData.city,
        address: propertyData.address,
        house_rules: propertyData.house_rules,
        price_per_night: propertyData.price_per_night,
        minimum_stay: propertyData.minimum_stay
      });

      if (!basicsValidation.success) {
        toast({
          title: t('host_onb.validation_error'),
          description: basicsValidation.error.errors[0].message,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Validate property details
      const detailsValidation = propertyDetailsSchema.safeParse({
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        max_guests: propertyData.max_guests,
        extra_beds: propertyData.extra_beds
      });

      if (!detailsValidation.success) {
        toast({
          title: t('host_onb.validation_error'),
          description: detailsValidation.error.errors[0].message,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const propertyPayload = {
        title: propertyData.title,
        description: propertyData.description,
        property_type: propertyData.property_type,
        governorate: propertyData.governorate,
        city: propertyData.city,
        address: propertyData.address,
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        max_guests: propertyData.max_guests,
        price_per_night: propertyData.price_per_night,
        currency: propertyData.currency,
        amenities: propertyData.amenities,
        photos: propertyData.photos,
        safety_features: propertyData.safety_features,
        sleeping_arrangements: propertyData.sleeping_arrangements,
        bed_types: propertyData.bed_types,
        extra_beds: propertyData.extra_beds,
        minimum_stay: propertyData.minimum_stay,
        cancellation_policy: propertyData.cancellation_policy,
        check_in_time: propertyData.check_in_time,
        check_out_time: propertyData.check_out_time,
        house_rules: propertyData.house_rules,
        coordinates: propertyData.coordinates,
        google_maps_url: propertyData.google_maps_url,
        welcome_message: propertyData.welcome_message,
        arrival_instructions: (propertyData as any).arrival_instructions || null,
        wifi_name: (propertyData as any).wifi_name || null,
        wifi_password: (propertyData as any).wifi_password || null,
        parking_info: (propertyData as any).parking_info || null,
        lockbox_code: (propertyData as any).lockbox_code || null,
        host_id: user!.id,
        is_public: true,
        status: 'published',
        booking_enabled: true
      };

      if (isEditing && propertyId) {
        // Update existing property
        const { error } = await supabase
          .from("properties")
          .update(propertyPayload)
          .eq("id", propertyId)
          .eq("host_id", user!.id);

        if (error) throw error;

        toast({
          title: "Success!",
          description: t('host_onb.success_updated')
        });
      } else {
        // Create new property
        const { data, error } = await supabase
          .from("properties")
          .insert([propertyPayload])
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Success!",
          description: t('host_onb.success_published')
        });
      }

      navigate("/profile?tab=properties");
    } catch (error: any) {
      console.error("Error saving property:", error);
      toast({
        title: "Error",
        description: error.message || t('host_onb.error_save'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const CurrentStepComponent = steps[currentStep - 1].component;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (loading && isEditing) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center">{t('host_onb.loading_data')}</div>
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
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate("/profile?tab=properties")}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('host_onb.back_to_properties')}
            </Button>
            
            <h1 className="text-3xl font-bold mb-4">
              {isEditing ? t('host_onb.edit_title') : t('host_onb.list_title')}
            </h1>
            <Progress value={(currentStep / steps.length) * 100} className="mb-6" />
            
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{t('host_onb.step_label', { current: currentStep, total: steps.length })}</span>
              <span>{steps[currentStep - 1].title}</span>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{steps[currentStep - 1].title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CurrentStepComponent
                data={propertyData}
                onUpdate={updatePropertyData}
                errors={errors}
              />
            </CardContent>
          </Card>

          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('host_onb.previous')}
            </Button>

            {currentStep === steps.length ? (
              <Button onClick={saveProperty} disabled={loading}>
                {loading ? (
                  isEditing ? t('host_onb.updating') : t('host_onb.publishing')
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {isEditing ? t('host_onb.update') : t('host_onb.publish')}
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={nextStep}>
                {t('host_onb.next')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default HostOnboarding;
