import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2, Minus, Plus, Megaphone, Repeat } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AdvertiseProperty() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [days, setDays] = useState(2);
  const [autoRenew, setAutoRenew] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";
  const sessionId = searchParams.get("session_id");
  const isSandbox = searchParams.get("sandbox") === "true";

  const { data: property, isLoading: loadingProperty } = useQuery({
    queryKey: ['property-for-ad', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId
  });

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['user-profile-verification', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('verification_status')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const isVerified = profile?.verification_status === 'verified';

  const { data: activePromotions, refetch: refetchPromotions } = useQuery({
    queryKey: ['property-promotions', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_promotions')
        .select('*')
        .eq('property_id', propertyId)
        .eq('status', 'active')
        .gt('ends_at', new Date().toISOString())
        .order('ends_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId
  });

  useEffect(() => {
    if (success && sessionId) {
      verifyPayment();
    } else if (canceled) {
      toast({
        title: t('adv.canceled_title'),
        description: t('adv.canceled_desc'),
        variant: "default",
      });
    }
  }, [success, canceled, sessionId]);

  const verifyPayment = async () => {
    setVerifying(true);
    try {
      const response = await supabase.functions.invoke('verify-ad-payment', {
        body: { sessionId, sandbox: isSandbox },
      });

      if (response.error) throw new Error(response.error.message || "Failed to verify payment");

      toast({
        title: t('adv.success_title'),
        description: t('adv.success_desc'),
      });
      refetchPromotions();
    } catch (error: any) {
      console.error('Payment verification failed:', error);
      toast({
        title: t('adv.verify_failed_title'),
        description: error.message || t('adv.verify_failed_desc'),
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleCheckout = async (sandbox: boolean) => {
    if (!user || !property) return;
    
    setIsProcessing(true);
    try {
      const response = await supabase.functions.invoke('create-ad-checkout', {
        body: {
          propertyId: property.id,
          days,
          autoRenew,
          sandbox
        },
      });

      if (response.error) throw new Error(response.error.message || "Failed to create checkout session");
      if (!response.data?.url) throw new Error("No checkout URL returned");

      window.location.href = response.data.url;
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: t('adv.checkout_error'),
        description: error.message || t('adv.something_wrong'),
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const pricePerDay = 20;
  const totalPrice = autoRenew ? pricePerDay : days * pricePerDay;

  if (loadingProperty || loadingProfile) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!property) {
    return <div className="p-8 text-center">{t('adv.property_not_found')}</div>;
  }

  if (!isVerified) {
    return (
      <div className="container max-w-3xl py-12 mx-auto px-4">
        <Button variant="ghost" className="mb-6 pl-0" onClick={() => navigate('/profile?tab=properties')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('adv.back')}
        </Button>
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">{t('adv.id_required_title')}</AlertTitle>
          <AlertDescription className="text-amber-700">
            {t('adv.id_required_desc')}
          </AlertDescription>
        </Alert>
        <Button className="mt-6" onClick={() => navigate('/profile?tab=verification')}>
          {t('adv.go_to_verification')}
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-12 mx-auto px-4">
      <Button variant="ghost" className="mb-6 pl-0" onClick={() => navigate('/profile?tab=properties')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> {t('adv.back')}
      </Button>

      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary/10 p-3 rounded-full text-primary">
          <Megaphone className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t('adv.title')}</h1>
          <p className="text-muted-foreground">{property.title}</p>
        </div>
      </div>

      {verifying && (
        <Alert className="mb-8 bg-blue-50 text-blue-800 border-blue-200">
          <Loader2 className="h-4 w-4 animate-spin text-blue-800" />
          <AlertTitle>{t('adv.verifying_title')}</AlertTitle>
          <AlertDescription>{t('adv.verifying_desc')}</AlertDescription>
        </Alert>
      )}

      {activePromotions && activePromotions.length > 0 && (
        <Alert className="mb-8 bg-green-50 text-green-800 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-800" />
          <AlertTitle>{t('adv.active_title')}</AlertTitle>
          <AlertDescription>
            {t('adv.active_desc', { date: new Date(activePromotions[0].ends_at).toLocaleDateString() })}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('adv.duration_title')}</CardTitle>
              <CardDescription>{t('adv.duration_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <Repeat className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{t('adv.auto_renew')}</p>
                    <p className="text-xs text-muted-foreground">{t('adv.auto_renew_desc')}</p>
                  </div>
                </div>
                <Switch 
                  checked={autoRenew}
                  onCheckedChange={setAutoRenew}
                  disabled={isProcessing}
                />
              </div>

              <div className={`transition-opacity duration-200 ${autoRenew ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setDays(Math.max(1, days - 1))}
                    disabled={days <= 1 || isProcessing || autoRenew}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="text-2xl font-bold text-center">
                    {autoRenew ? 1 : days} <span className="text-lg font-normal text-muted-foreground">{(!autoRenew && days !== 1) ? t('adv.days') : t('adv.day')}</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setDays(days + 1)}
                    disabled={isProcessing || autoRenew}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {!autoRenew && <p className="text-sm text-muted-foreground text-center mt-3">{t('adv.extend_specific')}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('adv.what_you_get')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <p className="text-sm">{t('adv.feat_homepage')}</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <p className="text-sm">{t('adv.feat_priority')}</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <p className="text-sm">{t('adv.feat_badge')}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>{t('adv.summary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">
                  {autoRenew ? t('adv.daily_subscription') : t('adv.days_at', { days, price: pricePerDay })}
                </span>
                <span className="font-medium">{totalPrice} TND{autoRenew && '/day'}</span>
              </div>
              <div className="flex justify-between items-center py-2 text-lg font-bold">
                <span>{autoRenew ? t('adv.todays_total') : t('adv.total')}</span>
                <span className="text-primary">{totalPrice} TND</span>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {t('adv.stripe_notice')}
              </p>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => handleCheckout(false)}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('adv.pay_live', { total: totalPrice })}
              </Button>
              <Button 
                variant="outline" 
                className="w-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" 
                size="lg"
                onClick={() => handleCheckout(true)}
                disabled={isProcessing}
              >
                {t('adv.sandbox')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}