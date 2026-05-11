
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useLanguage } from "@/contexts/LanguageContext";
import { Eye, EyeOff, Edit, Trash2, Plus, Calendar, ExternalLink, Wand2, BarChart3, ChevronDown, Megaphone, CalendarSync as CalendarSyncIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import CalendarSync from "@/components/host/CalendarSync";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tables } from "@/integrations/supabase/types";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Property = Tables<"properties">;

const DEMO_TEMPLATES = [
  {
    key: "la-marsa",
    label: "La Marsa Flat",
    template: {
      title: "Modern Flat | Fast WI-FI | Near Airport and Clinic",
      description: `🌴 Welcome to your cozy retreat at Marsa 🌴

Just 10 minutes from Tunis-Carthage Airport — perfect for early flights or late arrivals!
✨ We provide towels and a travel-size toiletry kit for your convenience.

🏠 What you'll find:
- Fully equipped kitchen
- High-speed Wi-Fi (great for work or streaming)
- Smart TV
- Secure parking on-site

🛏️ One bedroom with a super comfy double bed — sleeps 2 guests perfectly.
🚿 Brand-new private bathroom.

🚗 The neighborhood is calm, family-friendly, and super close to:
- Cafés & restaurants
- Pharmacy and clinic
- Supermarket`,
      property_type: "house",
      governorate: "Tunis",
      city: "La Marsa",
      address: "Rue Ibn Khaldoun, La Marsa",
      bedrooms: 1,
      bathrooms: 1,
      max_guests: 4,
      price_per_night: 120,
      minimum_stay: 3,
      check_in_time: "10:00",
      check_out_time: "12:00",
      cancellation_policy: "flexible",
      visitor_policy: "morning_only",
      currency: "TND",
      house_rules: "no smoking inside house alarm",
      photos: [
        { url: "https://pub-fbfee19a9f4f4874bb58350b017e120c.r2.dev/property-photos/f1d2d430-4942-4446-9633-f145708e4b79/1766763160094-kf1297l4qj9.avif", type: "exterior" },
        { url: "https://pub-fbfee19a9f4f4874bb58350b017e120c.r2.dev/property-photos/f1d2d430-4942-4446-9633-f145708e4b79/1766763164720-e05634um6m8.avif", type: "kitchen" },
        { url: "https://pub-fbfee19a9f4f4874bb58350b017e120c.r2.dev/property-photos/f1d2d430-4942-4446-9633-f145708e4b79/1766763171176-yd9j55exp6f.avif", type: "bathroom" },
        { url: "https://pub-fbfee19a9f4f4874bb58350b017e120c.r2.dev/property-photos/f1d2d430-4942-4446-9633-f145708e4b79/1766763177392-8z5nwdw7us.avif", type: "living_room" },
        { url: "https://pub-fbfee19a9f4f4874bb58350b017e120c.r2.dev/property-photos/f1d2d430-4942-4446-9633-f145708e4b79/1766763181208-50al4ekuh89.avif", type: "bedroom_1" }
      ],
      amenities: ["wifi", "kitchen", "tv", "parking", "air_conditioning"],
      safety_features: { first_aid_kit: true, emergency_exit_plan: true, fire_extinguisher: true, carbon_monoxide_detector: true },
      welcome_message: "👋 This is a demo listing created by the Samsari team to showcase the platform. For any questions, contact us at samsari.owner@gmail.com",
      is_public: true,
      status: "published"
    }
  },
  {
    key: "kairouan",
    label: "Kairouan Traditional",
    template: {
      title: "Dar Aghlabide | Maison Traditionnelle au Cœur de la Médina",
      description: `🕌 Bienvenue à Kairouan, ville sainte et joyau du patrimoine tunisien 🕌

Séjournez dans une authentique maison traditionnelle restaurée, au cœur de la médina historique de Kairouan.

🏠 Ce que vous trouverez:
- Architecture traditionnelle avec patio intérieur
- Salon mauresque avec banquettes et tapis artisanaux
- Cuisine équipée avec ustensiles traditionnels
- Wi-Fi haut débit
- Climatisation

🛏️ 2 chambres avec lits doubles confortables — idéal pour 4 personnes.
🚿 Salle de bain privée avec douche.

📍 À proximité:
- Grande Mosquée de Kairouan (5 min à pied)
- Souk de la Médina
- Bassins des Aghlabides
- Restaurants et cafés traditionnels`,
      property_type: "traditional",
      governorate: "Kairouan",
      city: "Kairouan",
      address: "Médina de Kairouan, Rue de la Grande Mosquée",
      bedrooms: 2,
      bathrooms: 1,
      max_guests: 4,
      price_per_night: 85,
      minimum_stay: 2,
      check_in_time: "14:00",
      check_out_time: "11:00",
      cancellation_policy: "moderate",
      visitor_policy: "morning_only",
      currency: "TND",
      house_rules: "Respecter le calme de la médina, pas de fêtes",
      photos: [
        { url: "/images/demo/kairouan-1.jpg", type: "living_room" },
        { url: "/images/demo/kairouan-2.jpg", type: "bedroom_1" },
        { url: "/images/demo/kairouan-3.jpg", type: "exterior" }
      ],
      amenities: ["wifi", "kitchen", "air_conditioning", "heating"],
      safety_features: { first_aid_kit: true, fire_extinguisher: true },
      welcome_message: "👋 This is a demo listing created by the Samsari team to showcase the platform. For any questions, contact us at samsari.owner@gmail.com",
      is_public: true,
      status: "published"
    }
  },
  {
    key: "sousse",
    label: "Sousse Seaside",
    template: {
      title: "Luxury Seaside Apartment | Ocean View | Pool & Beach Access",
      description: `🌊 Welcome to your dream getaway in Sousse 🌊

Wake up to stunning Mediterranean views from this modern seaside apartment in the heart of Sousse's tourist zone.

🏠 What you'll find:
- Spacious open-plan living with panoramic sea views
- Fully equipped modern kitchen
- Large balcony overlooking the sea
- High-speed Wi-Fi
- Smart TV with international channels
- Access to shared swimming pool

🛏️ 2 bedrooms — master with sea view, second with garden view. Sleeps up to 5 guests.
🚿 2 modern bathrooms.

🏖️ Steps away from:
- Sandy beach (2 min walk)
- Sousse Marina & Port El Kantaoui
- Restaurants, bars & nightlife
- Medina of Sousse (UNESCO World Heritage)`,
      property_type: "apartment",
      governorate: "Sousse",
      city: "Sousse",
      address: "Zone Touristique, Boulevard 14 Janvier, Sousse",
      bedrooms: 2,
      bathrooms: 2,
      max_guests: 5,
      price_per_night: 150,
      minimum_stay: 2,
      check_in_time: "15:00",
      check_out_time: "11:00",
      cancellation_policy: "flexible",
      visitor_policy: "morning_only",
      currency: "TND",
      house_rules: "No smoking indoors, pool hours 8am-10pm",
      photos: [
        { url: "/images/demo/sousse-1.jpg", type: "living_room" },
        { url: "/images/demo/sousse-2.jpg", type: "bedroom_1" },
        { url: "/images/demo/sousse-3.jpg", type: "exterior" }
      ],
      amenities: ["wifi", "kitchen", "tv", "parking", "air_conditioning", "pool", "beach_access"],
      safety_features: { first_aid_kit: true, emergency_exit_plan: true, fire_extinguisher: true },
      welcome_message: "👋 This is a demo listing created by the Samsari team to showcase the platform. For any questions, contact us at samsari.owner@gmail.com",
      is_public: true,
      status: "published"
    }
  }
];

interface MyPropertiesProps {
  onBecomeHost?: () => void;
  isBecomingHost?: boolean;
}

const MyProperties: React.FC<MyPropertiesProps> = ({ onBecomeHost, isBecomingHost }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [propertyStats, setPropertyStats] = useState<Record<string, { views: number, bookings: number }>>({});
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchProperties();
    }
  }, [user]);

  const fetchProperties = async () => {
    if (!user) return;
    
    setLoading(true);
    setLoadError(null);
    try {
      const { data: propertyData, error } = await supabase
        .from('properties')
        .select('*')
        .eq('host_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProperties(propertyData || []);

      if (propertyData && propertyData.length > 0) {
        await fetchPropertyStats(propertyData);
      }
    } catch (error: any) {
      console.error('Error fetching properties:', error);
      setLoadError(error?.message || t('mp.couldnt_load'));
      toast({
        title: t('mp.couldnt_load'),
        description: error?.message || t('mp.try_again'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPropertyStats = async (properties: Property[]) => {
    const statsMap: Record<string, { views: number, bookings: number }> = {};
    
    try {
      // Initialize stats for all properties
      properties.forEach(property => {
        statsMap[property.id] = { views: 0, bookings: 0 };
      });

      if (properties.length > 0) {
        // Get booking counts using count aggregation
        const { data: bookingCounts, error: bookingsError } = await supabase
          .from('bookings')
          .select('property_id')
          .in('property_id', properties.map(p => p.id));

        if (bookingsError) throw bookingsError;

        // Count bookings per property
        if (bookingCounts) {
          bookingCounts.forEach(booking => {
            if (statsMap[booking.property_id]) {
              statsMap[booking.property_id].bookings++;
            }
          });
        }
      }
      
      setPropertyStats(statsMap);
    } catch (error) {
      console.error('Error fetching property stats:', error);
    }
  };

  const toggleVisibility = async (property: Property) => {
    try {
      const { error } = await supabase
        .from('properties')
        .update({ is_public: !property.is_public })
        .eq('id', property.id);

      if (error) throw error;

      // Update local state
      setProperties(prevProperties => 
        prevProperties.map(p => 
          p.id === property.id ? { ...p, is_public: !p.is_public } : p
        )
      );

      toast({
        title: t('prof.success'),
        description: t('mp.visibility_updated', { state: !property.is_public ? t('mp.visibility_visible') : t('mp.visibility_hidden') })
      });
    } catch (error) {
      console.error('Error updating property visibility:', error);
      toast({
        title: t('prof.error'),
        description: t('mp.visibility_fail'),
        variant: "destructive"
      });
    }
  };

  const deleteProperty = async (propertyId: string) => {
    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);

      if (error) throw error;

      // Update local state
      setProperties(prevProperties => 
        prevProperties.filter(p => p.id !== propertyId)
      );

      toast({
        title: t('prof.success'),
        description: t('mp.deleted')
      });
    } catch (error) {
      console.error('Error deleting property:', error);
      toast({
        title: t('prof.error'),
        description: t('mp.delete_fail'),
        variant: "destructive"
      });
    }
  };

  const editProperty = (propertyId: string) => {
    navigate(`/host/edit-property/${propertyId}`);
  };

  const viewProperty = (property: Property) => {
    const shortCode = (property as any).short_code;
    navigate(shortCode ? `/p/${shortCode}` : `/property/${property.id}`);
  };

  const manageProperty = (propertyId: string) => {
    navigate(`/host/property/${propertyId}/analytics`);
  };

  const advertiseProperty = (propertyId: string) => {
    navigate(`/advertise/${propertyId}`);
  };

  const createNewProperty = () => {
    navigate('/host/onboarding');
  };

  const createDemoProperty = async (templateKey?: string) => {
    if (!user) return;
    
    setCreatingDemo(true);
    try {
      const selectedTemplate = DEMO_TEMPLATES.find(t => t.key === templateKey) || DEMO_TEMPLATES[0];
      const timestamp = Date.now();
      const demoTitle = `${selectedTemplate.template.title} (Demo #${timestamp.toString().slice(-4)}) — by Samsari`;
      
      const { data, error } = await supabase
        .from('properties')
        .insert({
          ...selectedTemplate.template,
          title: demoTitle,
          host_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: t('mp.demo_created'),
        description: t('mp.demo_created_desc', { title: demoTitle })
      });

      await fetchProperties();
      
      if (data?.short_code) {
        navigate(`/p/${data.short_code}`);
      }
    } catch (error) {
      console.error('Error creating demo property:', error);
      toast({
        title: t('prof.error'),
        description: t('mp.demo_fail'),
        variant: "destructive"
      });
    } finally {
      setCreatingDemo(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="w-full">
            <CardHeader>
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Skeleton className="h-24 w-24 rounded" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="text-center p-6 border-destructive/50">
        <CardHeader>
          <CardTitle>{t('mp.couldnt_load')}</CardTitle>
          <CardDescription className="break-words">{loadError}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center pt-4">
          <Button onClick={fetchProperties} variant="outline">{t('mp.retry')}</Button>
        </CardFooter>
      </Card>
    );
  }

  if (properties.length === 0) {
    return (
      <Card className="text-center p-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>{t('mp.become_host')}</span>
          </CardTitle>
          <CardDescription>
            {t('mp.become_host_desc')}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center pt-4">
          <Button onClick={onBecomeHost || createNewProperty} disabled={isBecomingHost}>
            {isBecomingHost ? t('mp.processing') : t('mp.become_host')}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">{t('mp.heading')}</h3>
        <div className="flex gap-2">
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={creatingDemo}>
                  <Wand2 className="mr-2 h-4 w-4" />
                  {creatingDemo ? t('mp.creating') : t('mp.create_demo')}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {DEMO_TEMPLATES.map((demo) => (
                  <DropdownMenuItem key={demo.key} onClick={() => createDemoProperty(demo.key)}>
                    {demo.label} ({demo.template.governorate})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={createNewProperty}>
            <Plus className="mr-2 h-4 w-4" />
            {t('mp.add_new')}
          </Button>
        </div>
      </div>

      {properties.map((property) => (
        <Card key={property.id} className="w-full">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">{property.title}</CardTitle>
                <CardDescription>
                  {property.city}, {property.governorate}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {property.title?.includes('— by Samsari') && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                    {t('mp.samsari_demo')}
                  </Badge>
                )}
                <Badge 
                  variant={property.is_public ? "default" : "outline"}
                >
                  {property.is_public ? t('mp.published') : t('mp.draft')}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative h-40 w-full sm:h-32 sm:w-48 md:h-36 md:w-56 shrink-0 bg-muted rounded overflow-hidden">
                {property.photos && Array.isArray(property.photos) && property.photos.length > 0 ? (
                  <img 
                    src={(property.photos[0] as any)?.url || "/placeholder.svg"} 
                    alt={property.title}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    {t('mp.no_photo')}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div className="text-sm text-muted-foreground mb-2 capitalize">
                  {property.property_type} • {property.bedrooms} bedroom{property.bedrooms !== 1 ? 's' : ''} • {property.bathrooms} bathroom{property.bathrooms !== 1 ? 's' : ''} • {t('mp.up_to_guests', { count: property.max_guests })}
                </div>
                {property.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3 hidden sm:block">
                    {property.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-auto">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1.5 text-muted-foreground" />
                    <span className="text-sm">{t('mp.bookings_count', { count: propertyStats[property.id]?.bookings || 0 })}</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-lg font-semibold">{property.price_per_night} TND</span>
                    <span className="text-sm text-muted-foreground ml-1">{t('mp.per_night_short')}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-0 flex flex-wrap gap-y-2 gap-x-4 justify-between">
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => toggleVisibility(property)}
              >
                {property.is_public ? (
                  <><EyeOff className="h-4 w-4 mr-1" /> {t('mp.hide')}</>
                ) : (
                  <><Eye className="h-4 w-4 mr-1" /> {t('mp.publish_btn')}</>
                )}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => editProperty(property.id)}
              >
                <Edit className="h-4 w-4 mr-1" /> {t('mp.edit')}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" /> {t('mp.delete')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('mp.confirm_title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('mp.confirm_desc')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('mp.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteProperty(property.id)}>
                      {t('mp.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="secondary" 
                size="sm"
                className="bg-amber-100 text-amber-900 hover:bg-amber-200 border-0"
                onClick={() => advertiseProperty(property.id)}
              >
                <Megaphone className="h-4 w-4 mr-1" /> {t('mp.advertise')}
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarSyncIcon className="h-4 w-4 mr-1" /> {t('mp.sync')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{t('mp.sync_title', { title: property.title })}</DialogTitle>
                  </DialogHeader>
                  <CalendarSync propertyId={property.id} />
                </DialogContent>
              </Dialog>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => manageProperty(property.id)}
              >
                <BarChart3 className="h-4 w-4 mr-1" /> {t('mp.manage')}
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={() => viewProperty(property)}
              >
                <ExternalLink className="h-4 w-4 mr-1" /> {t('mp.view')}
              </Button>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default MyProperties;
