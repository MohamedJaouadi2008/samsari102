
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Settings, Camera, Home, LogOut, Shield, Mail, Package, MessageSquare, Heart, Calendar, ClipboardList, CalendarCheck, DollarSign, CreditCard, CheckCircle, ExternalLink, Loader2, Building2, Gift } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import IdVerification from "@/components/IdVerification";
import ChangePassword from "@/components/ChangePassword";
import { MFASetup } from "@/components/auth/MFASetup";
import MyProperties from "@/components/host/MyProperties";
import HostInsightsTab from "@/components/host/HostInsightsTab";
import Inbox from "@/components/messaging/Inbox";
import ReservationRequests from "@/components/ReservationRequests";
import MyReservations from "@/components/booking/MyReservations";
import HostBookings from "@/components/host/HostBookings";
import HostEarnings from "@/components/host/HostEarnings";
import ProfilePictureUpload from "@/components/ProfilePictureUpload";
import RewardsTab from "@/components/rewards/RewardsTab";
import { profileUpdateSchema } from "@/lib/validation";
import { useLanguage } from "@/contexts/LanguageContext";

const Profile = () => {
  const { t } = useLanguage();
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [savedProperties, setSavedProperties] = useState([]);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    phone: "",
    bio: "",
    avatar_url: "",
    is_host: false,
    verification_status: "unverified",
    preferred_currency: "TND",
    stripe_account_id: null as string | null,
    stripe_account_status: null as string | null,
    stripe_onboarding_complete: false,
    payout_method: "none" as string,
    bank_name: "" as string,
    bank_rib: "" as string,
    bank_account_holder: "" as string,
  });
  const [stripeLoading, setStripeLoading] = useState(false);

  const currentTab = searchParams.get('tab') || 'profile';

  // Only fetch data once on mount, not on tab changes
  useEffect(() => {
    // Wait for auth to finish loading before redirecting
    if (authLoading) return;
    
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!initialDataLoaded) {
      fetchProfile();
      fetchSavedProperties();
      setInitialDataLoaded(true);
    }
  }, [user, navigate, initialDataLoaded, authLoading]);

  const fetchProfile = async () => {
    if (!user) return;
    
    console.log("Fetching profile for user:", user.id);
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
        
      if (error) {
        console.log("Profile fetch error:", error);
        if (error.code === 'PGRST116') {
          console.log("Profile not found, creating new profile");
          await createProfile();
        } else {
          console.error("Profile fetch error:", error);
          toast({
            title: t('prof.error'),
            description: t('prof.fetch_fail'),
            variant: "destructive"
          });
        }
      } else if (data) {
        console.log("Profile data fetched:", data);
        
        // Get the actual verification status from id_verifications table
        let actualVerificationStatus = data.verification_status || "unverified";
        
        const { data: verificationData } = await supabase
          .from("id_verifications")
          .select("status, allow_resubmit")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        
        if (verificationData) {
          // Map id_verifications status to profile verification_status
          if (verificationData.status === 'rejected') {
            actualVerificationStatus = 'rejected';
          } else if (verificationData.status === 'approved') {
            actualVerificationStatus = 'verified';
          } else if (verificationData.status === 'pending') {
            actualVerificationStatus = 'pending';
          }
          
          // Update profile if status is out of sync
          if (data.verification_status !== actualVerificationStatus) {
            await supabase
              .from("profiles")
              .update({ verification_status: actualVerificationStatus })
              .eq("id", user.id);
          }
        }
        
        setProfile({
          full_name: data.full_name || "",
          phone: data.phone || "",
          bio: data.bio || "",
          avatar_url: data.avatar_url || "",
          is_host: data.is_host || false,
          verification_status: actualVerificationStatus,
          preferred_currency: data.preferred_currency || "TND",
          stripe_account_id: data.stripe_account_id || null,
          stripe_account_status: data.stripe_account_status || null,
          stripe_onboarding_complete: data.stripe_onboarding_complete || false,
          payout_method: (data as any).payout_method || "none",
          bank_name: (data as any).bank_name || "",
          bank_rib: (data as any).bank_rib || "",
          bank_account_holder: (data as any).bank_account_holder || "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast({
        title: t('prof.error'),
        description: t('prof.fetch_fail'),
        variant: "destructive"
      });
    }
  };

  const createProfile = async () => {
    if (!user) return;
    
    console.log("Creating profile for user:", user.id);
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || "",
          avatar_url: user.user_metadata?.avatar_url || "",
          bio: "",
          phone: ""
        })
        .select()
        .single();
        
      if (error) {
        console.error("Profile creation error:", error);
        toast({
          title: t('prof.error'),
          description: t('prof.create_fail'),
          variant: "destructive"
        });
      } else if (data) {
        console.log("Profile created:", data);
        setProfile({
          full_name: data.full_name || "",
          phone: data.phone || "",
          bio: data.bio || "",
          avatar_url: data.avatar_url || "",
          is_host: data.is_host || false,
          verification_status: data.verification_status || "unverified",
          preferred_currency: data.preferred_currency || "TND",
          stripe_account_id: data.stripe_account_id || null,
          stripe_account_status: data.stripe_account_status || null,
          stripe_onboarding_complete: data.stripe_onboarding_complete || false,
          payout_method: (data as any).payout_method || "none",
          bank_name: (data as any).bank_name || "",
          bank_rib: (data as any).bank_rib || "",
          bank_account_holder: (data as any).bank_account_holder || "",
        });
      }
    } catch (error) {
      console.error("Error creating profile:", error);
      toast({
        title: t('prof.error'),
        description: t('prof.create_fail'),
        variant: "destructive"
      });
    }
  };

  const fetchSavedProperties = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("saved_properties")
        .select(`
          id,
          property_id,
          properties (
            id,
            title,
            city,
            governorate,
            price_per_night,
            photos,
            property_type,
            bedrooms,
            bathrooms
          )
        `)
        .eq("user_id", user.id);
      if (error) throw error;
      setSavedProperties(data || []);
    } catch (error) {
      console.error("Error fetching saved properties:", error);
    }
  };

  const removeSavedProperty = async (savedPropertyId: string) => {
    try {
      const { error } = await supabase
        .from("saved_properties")
        .delete()
        .eq("id", savedPropertyId);
      if (error) throw error;
      setSavedProperties(prev => prev.filter(item => item.id !== savedPropertyId));
      toast({
        title: t('prof.removed_saved'),
        description: t('prof.removed_saved_desc')
      });
    } catch (error) {
      console.error("Error removing saved property:", error);
      toast({
        title: t('prof.error'),
        description: t('prof.remove_fail'),
        variant: "destructive"
      });
    }
  };

  const updateProfile = async () => {
    if (!user) return;
    setLoading(true);
    
    console.log("Updating profile for user:", user.id);
    console.log("Profile data to update:", {
      full_name: profile.full_name,
      phone: profile.phone,
      bio: profile.bio
    });
    
    try {
      // Validate profile data (excluding full_name which is now read-only)
      const validation = profileUpdateSchema.safeParse({
        phone: profile.phone,
        bio: profile.bio
      });

      if (!validation.success) {
        toast({
          title: "Validation Error",
          description: validation.error.errors[0].message,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Update the profile directly - if it doesn't exist, the RLS policy will prevent the update
      const { data, error } = await supabase
        .from("profiles")
        .update({
          phone: profile.phone,
          bio: profile.bio,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id)
        .select()
        .single();
        
      if (error) {
        console.error("Profile update error:", error);
        
        // If profile doesn't exist, create it first then try again
        if (error.code === 'PGRST116') {
          console.log("Profile doesn't exist, creating first...");
          await createProfile();
          
          // Try the update again
          const { data: retryData, error: retryError } = await supabase
            .from("profiles")
            .update({
              phone: profile.phone,
              bio: profile.bio,
              updated_at: new Date().toISOString()
            })
            .eq("id", user.id)
            .select()
            .single();
            
          if (retryError) {
            console.error("Retry profile update error:", retryError);
            toast({
              title: t('prof.error'),
              description: t('prof.update_fail_msg', { msg: retryError.message }),
              variant: "destructive"
            });
          } else {
            console.log("Profile updated successfully on retry:", retryData);
            toast({
              title: t('prof.success'),
              description: t('prof.updated')
            });
            
            // Redirect to verification tab if not verified
            if (profile.verification_status === "unverified") {
              setSearchParams({ tab: 'verification' });
            }
          }
        } else {
          toast({
            title: t('prof.error'),
            description: t('prof.update_fail_msg', { msg: error.message }),
            variant: "destructive"
          });
        }
      } else {
        console.log("Profile updated successfully:", data);
        toast({
          title: t('prof.success'),
          description: t('prof.updated')
        });
        
        // Redirect to verification tab if not verified
        if (profile.verification_status === "unverified") {
          setSearchParams({ tab: 'verification' });
        }
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: t('prof.error'),
        description: t('prof.update_fail'),
        variant: "destructive"
      });
    }
    
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const becomeHost = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ is_host: true })
      .eq("id", user.id);
    if (error) {
      toast({
        title: t('prof.error'),
        description: t('prof.become_host_fail'),
        variant: "destructive"
      });
    } else {
      setProfile({ ...profile, is_host: true });
      toast({
        title: t('prof.welcome_host'),
        description: t('prof.welcome_host_desc')
      });
      navigate("/host/onboarding");
    }
    setLoading(false);
  };

  const handleVerificationSubmitted = () => {
    setProfile({ ...profile, verification_status: 'pending' });
  };

  const handleAvatarUpdate = (newUrl: string) => {
    setProfile({ ...profile, avatar_url: newUrl });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">{t('prof.title')}</h1>
            <Button variant="outline" onClick={handleSignOut}>
              {t('prof.sign_out')}
            </Button>
          </div>

          <Tabs value={currentTab} onValueChange={(value) => setSearchParams({ tab: value })} className="flex items-start gap-3 sm:gap-4 md:gap-6 lg:gap-8">
            <aside className="w-14 sm:w-44 md:w-48 lg:w-56 shrink-0">
              <TabsList className="sticky top-24 flex h-auto w-full flex-col gap-1 bg-muted p-2">
                <TabsTrigger value="profile" className="w-full justify-center gap-2 px-0 py-2 text-sm sm:justify-start sm:px-3"><User className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{t('prof.tab_profile')}</span></TabsTrigger>
                <TabsTrigger value="verification" className="w-full justify-center gap-2 px-0 py-2 text-sm sm:justify-start sm:px-3"><Shield className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{t('prof.tab_verification')}</span></TabsTrigger>
                <TabsTrigger value="reservations" className="w-full justify-center gap-2 px-0 py-2 text-sm sm:justify-start sm:px-3"><Calendar className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{t('prof.tab_trips')}</span></TabsTrigger>
                <TabsTrigger value="properties" className="w-full justify-center gap-2 px-0 py-2 text-sm sm:justify-start sm:px-3"><Home className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{t('prof.tab_properties')}</span></TabsTrigger>
                {profile.is_host && <TabsTrigger value="bookings" className="w-full justify-center gap-2 px-0 py-2 text-sm sm:justify-start sm:px-3"><CalendarCheck className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{t('prof.tab_bookings')}</span></TabsTrigger>}
                {profile.is_host && <TabsTrigger value="earnings" className="w-full justify-center gap-2 px-0 py-2 text-sm sm:justify-start sm:px-3"><DollarSign className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{t('prof.tab_earnings')}</span></TabsTrigger>}
                {profile.is_host && <TabsTrigger value="insights" className="w-full justify-center gap-2 px-0 py-2 text-sm sm:justify-start sm:px-3"><Building2 className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{t('prof.tab_insights')}</span></TabsTrigger>}
                <TabsTrigger value="saved" className="w-full justify-center gap-2 px-0 py-2 text-sm sm:justify-start sm:px-3"><Heart className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{t('prof.tab_saved')}</span></TabsTrigger>
                <TabsTrigger value="inbox" className="w-full justify-center gap-2 px-0 py-2 text-sm sm:justify-start sm:px-3"><MessageSquare className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{t('prof.tab_inbox')}</span></TabsTrigger>
                {profile.is_host && <TabsTrigger value="requests" className="w-full justify-center gap-2 px-0 py-2 text-sm sm:justify-start sm:px-3"><ClipboardList className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{t('prof.tab_requests')}</span></TabsTrigger>}
                <TabsTrigger value="rewards" className="w-full justify-center gap-2 px-0 py-2 text-sm sm:justify-start sm:px-3"><Gift className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{t('prof.tab_rewards')}</span></TabsTrigger>
                <TabsTrigger value="settings" className="w-full justify-center gap-2 px-0 py-2 text-sm sm:justify-start sm:px-3"><Settings className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{t('prof.tab_settings')}</span></TabsTrigger>
              </TabsList>
            </aside>

            <div className="flex-1 min-w-0 space-y-6">

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>{t('prof.personal_info')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex justify-center mb-6">
                    <ProfilePictureUpload 
                      currentAvatarUrl={profile.avatar_url} 
                      userInitial={profile.full_name?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || "U"} 
                      userId={user.id} 
                      onAvatarUpdate={handleAvatarUpdate} 
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="full_name">{t('prof.full_name')}</Label>
                      <Input 
                        id="full_name" 
                        value={profile.full_name} 
                        disabled
                        className="bg-muted cursor-not-allowed" 
                        placeholder={t('prof.full_name_locked')} 
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('prof.full_name_note')}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="bio">{t('prof.bio')}</Label>
                      <Textarea 
                        id="bio" 
                        value={profile.bio} 
                        onChange={e => setProfile({ ...profile, bio: e.target.value })} 
                        placeholder={t('prof.bio_ph')} 
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">{t('prof.phone')}</Label>
                      <Input 
                        id="phone" 
                        value={profile.phone} 
                        onChange={e => setProfile({ ...profile, phone: e.target.value })} 
                        placeholder="+216 XX XXX XXX" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">{t('prof.email')}</Label>
                      <Input id="email" value={user.email} disabled className="bg-muted" />
                    </div>
                  </div>

                  <Button onClick={updateProfile} disabled={loading}>
                    {loading ? t('prof.updating') : t('prof.update_btn')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="verification">
              <IdVerification 
                verificationStatus={profile.verification_status} 
                onVerificationSubmitted={handleVerificationSubmitted} 
              />
            </TabsContent>

            <TabsContent value="rewards">
              <RewardsTab />
            </TabsContent>

            <TabsContent value="properties">
              <MyProperties onBecomeHost={becomeHost} isBecomingHost={loading} />
            </TabsContent>

            <TabsContent value="saved">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Heart className="h-5 w-5" />
                    <span>{t('prof.saved_props')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {savedProperties.length === 0 ? (
                    <div className="text-center py-6">
                      <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">
                        {t('prof.no_saved')}
                      </p>
                      <Button onClick={() => navigate("/search")}>
                        {t('prof.browse')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {savedProperties.map((item: any) => (
                        <div key={item.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                          <div className="relative h-20 w-20 bg-muted rounded overflow-hidden">
                            {item.properties.photos && Array.isArray(item.properties.photos) && item.properties.photos.length > 0 ? (
                              <img 
                                src={(item.properties.photos[0] as any)?.url || "/placeholder.svg"} 
                                alt={item.properties.title} 
                                className="object-cover w-full h-full" 
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                                {t('prof.no_photo')}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium">{item.properties.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {item.properties.city}, {item.properties.governorate}
                            </p>
                            <p className="text-sm">
                              {item.properties.property_type} • {item.properties.bedrooms} bed • {item.properties.bathrooms} bath
                            </p>
                            <p className="font-medium">{item.properties.price_per_night} TND/night</p>
                          </div>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" onClick={() => navigate(`/property/${item.properties.id}`)}>
                              {t('prof.view')}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => removeSavedProperty(item.id)}>
                              {t('prof.remove')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reservations">
              <MyReservations />
            </TabsContent>

            <TabsContent value="inbox">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5" />
                    <span>{t('prof.messages')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Inbox />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bookings">
              <HostBookings />
            </TabsContent>

            <TabsContent value="earnings">
              <HostEarnings />
            </TabsContent>

            <TabsContent value="insights">
              <HostInsightsTab />
            </TabsContent>

            <TabsContent value="requests">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <ClipboardList className="h-5 w-5" />
                    <span>{t('prof.reservation_requests')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ReservationRequests />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings">
              <div className="space-y-6">
                <ChangePassword />
                <MFASetup />
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5" />
                      <span>{t('prof.currency_pref')}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="currency">{t('prof.display_currency')}</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('prof.choose_currency')}
                      </p>
                      <Select
                        value={profile.preferred_currency}
                        onValueChange={async (value) => {
                          setProfile({ ...profile, preferred_currency: value });
                          const { error } = await supabase
                            .from("profiles")
                            .update({ preferred_currency: value })
                            .eq("id", user.id);
                          if (error) {
                            toast({
                              title: t('prof.error'),
                              description: t('prof.currency_fail'),
                              variant: "destructive"
                            });
                          } else {
                            toast({
                              title: t('prof.currency_updated'),
                              description: t('prof.currency_updated_desc', { currency: value })
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="w-full max-w-xs">
                          <SelectValue placeholder={t('prof.display_currency')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TND">TND - Tunisian Dinar</SelectItem>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
                
                {profile.is_host && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <CreditCard className="h-5 w-5" />
                        <span>{t('prof.payout_method')}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Stripe Connect Option */}
                      <div
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          profile.payout_method === 'stripe'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                        onClick={() => setProfile(p => ({ ...p, payout_method: 'stripe' }))}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CreditCard className="h-5 w-5 text-primary" />
                            <div>
                              <h4 className="font-medium">{t('prof.stripe_connect')}</h4>
                              <p className="text-sm text-muted-foreground">
                                {t('prof.stripe_desc')}
                              </p>
                            </div>
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            profile.payout_method === 'stripe' ? 'border-primary' : 'border-muted-foreground/40'
                          }`}>
                            {profile.payout_method === 'stripe' && (
                              <div className="w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                        </div>

                        {profile.payout_method === 'stripe' && (
                          <div className="mt-4 pl-8">
                            {profile.stripe_onboarding_complete ? (
                              <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">{t('prof.stripe_active')}</span>
                              </div>
                            ) : (
                              <Button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setStripeLoading(true);
                                  try {
                                    // Save payout method first
                                    await supabase.from('profiles').update({ payout_method: 'stripe' }).eq('id', user!.id);
                                    const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
                                      body: { returnUrl: window.location.origin }
                                    });
                                    if (error) throw error;
                                    if (data?.url) window.location.href = data.url;
                                  } catch (err: any) {
                                    toast({ title: t('prof.error'), description: err.message || t('prof.stripe_fail'), variant: "destructive" });
                                  } finally {
                                    setStripeLoading(false);
                                  }
                                }}
                                disabled={stripeLoading}
                                size="sm"
                              >
                                {stripeLoading ? (
                                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('prof.stripe_setting_up')}</>
                                ) : (
                                  <><ExternalLink className="h-4 w-4 mr-2" /> {t('prof.stripe_setup')}</>
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bank Transfer Option */}
                      <div
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          profile.payout_method === 'bank_transfer'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                        onClick={() => setProfile(p => ({ ...p, payout_method: 'bank_transfer' }))}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-primary" />
                            <div>
                              <h4 className="font-medium">{t('prof.bank_transfer')}</h4>
                              <p className="text-sm text-muted-foreground">
                                {t('prof.bank_desc')}
                              </p>
                            </div>
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            profile.payout_method === 'bank_transfer' ? 'border-primary' : 'border-muted-foreground/40'
                          }`}>
                            {profile.payout_method === 'bank_transfer' && (
                              <div className="w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                        </div>

                        {profile.payout_method === 'bank_transfer' && (
                          <div className="mt-4 pl-8 space-y-3" onClick={(e) => e.stopPropagation()}>
                            <div>
                              <Label htmlFor="bank_account_holder">{t('prof.account_holder')}</Label>
                              <Input
                                id="bank_account_holder"
                                placeholder={t('prof.account_holder_ph')}
                                value={profile.bank_account_holder}
                                onChange={(e) => setProfile(p => ({ ...p, bank_account_holder: e.target.value }))}
                                maxLength={100}
                              />
                            </div>
                            <div>
                              <Label htmlFor="bank_name">{t('prof.bank_name')}</Label>
                              <Input
                                id="bank_name"
                                placeholder={t('prof.bank_name_ph')}
                                value={profile.bank_name}
                                onChange={(e) => setProfile(p => ({ ...p, bank_name: e.target.value }))}
                                maxLength={100}
                              />
                            </div>
                            <div>
                              <Label htmlFor="bank_rib">{t('prof.bank_rib')}</Label>
                              <Input
                                id="bank_rib"
                                placeholder={t('prof.bank_rib_ph')}
                                value={profile.bank_rib}
                                onChange={(e) => setProfile(p => ({ ...p, bank_rib: e.target.value }))}
                                maxLength={34}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                {t('prof.bank_rib_note')}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              onClick={async () => {
                                if (!profile.bank_rib || !profile.bank_name || !profile.bank_account_holder) {
                                  toast({ title: t('prof.bank_missing'), description: t('prof.bank_missing_desc'), variant: "destructive" });
                                  return;
                                }
                                try {
                                  const { error } = await supabase.from('profiles').update({
                                    payout_method: 'bank_transfer',
                                    bank_name: profile.bank_name.trim(),
                                    bank_rib: profile.bank_rib.trim(),
                                    bank_account_holder: profile.bank_account_holder.trim(),
                                  }).eq('id', user!.id);
                                  if (error) throw error;
                                  toast({ title: t('prof.bank_saved'), description: t('prof.bank_saved_desc') });
                                } catch (err: any) {
                                  toast({ title: t('prof.error'), description: err.message || t('prof.bank_save_fail'), variant: "destructive" });
                                }
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" /> {t('prof.save_bank')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>{t('prof.account_info')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <h4 className="font-medium">{t('prof.account_created')}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <h4 className="font-medium">{t('prof.email_verified')}</h4>
                        <p className="text-sm text-muted-foreground">
                          {user.email_confirmed_at ? t('prof.email_yes') : t('prof.email_pending')}
                        </p>
                      </div>
                      <Mail className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Profile;
