
import { Shield, Clock, Users, Sparkles, CreditCard, Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScroll3D } from "@/hooks/useScroll3D";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const SocialProofSection = () => {
  const { t } = useLanguage();
  const { ref: statsRef, isVisible: statsVisible } = useScroll3D({ threshold: 0.2 });
  

  // Fetch real stats from database
  const { data: realStats } = useQuery({
    queryKey: ['landing-stats'],
    queryFn: async () => {
      const [hostsResult, bookingsResult] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_host', true).eq('verification_status', 'verified'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['confirmed', 'deposit_paid', 'checked_in', 'checked_out', 'settled'])
      ]);
      return {
        hosts: hostsResult.count || 0,
        bookings: bookingsResult.count || 0
      };
    },
    staleTime: 5 * 60 * 1000,
    // Defer this query until the section scrolls into view to shorten the
    // initial network dependency chain (LCP / critical request chain SEO).
    enabled: statsVisible,
  });

  const hasRealData = realStats && (realStats.hosts > 0 || realStats.bookings > 0);

  const features = [
    { value: '100%', label: t('social.protection_rate'), icon: Shield, description: 'Escrow protection on all bookings' },
    { value: '24/7', label: t('social.support_response'), icon: Clock, description: 'Local support team' },
    { value: '20/80', label: 'Escrow Split', icon: CreditCard, description: 'Pay only 20% upfront' },
    { value: 'ID', label: t('social.verified_hosts'), icon: Users, description: 'All hosts verified' },
  ];


  return (
    <section className="py-24 bg-muted/20 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        {/* Feature Stats */}
        <div 
          ref={statsRef}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-20"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index}
                className={`text-center p-6 md:p-8 bg-card rounded-2xl border border-border/40 hover:border-primary/20 hover:shadow-lg transition-all duration-500 hover:-translate-y-1 group ${
                  statsVisible ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ 
                  transitionDelay: `${index * 80}ms`,
                  transform: statsVisible 
                    ? 'translateY(0)' 
                    : 'translateY(30px)',
                }}
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-primary/15 transition-all duration-300">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-foreground mb-1 tracking-tight">
                  {feature.value}
                </div>
                <div className="text-xs text-muted-foreground font-medium">{feature.label}</div>
              </div>
            );
          })}
        </div>

        {/* Real Stats Banner */}
        {hasRealData && (
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 mb-16 text-center">
            <div className="flex flex-wrap justify-center gap-8">
              {realStats.hosts > 0 && (
                <div>
                  <span className="text-2xl font-bold text-primary">{realStats.hosts}+</span>
                  <span className="text-muted-foreground ml-2">{t('social.verified_hosts')}</span>
                </div>
              )}
              {realStats.bookings > 0 && (
                <div>
                  <span className="text-2xl font-bold text-primary">{realStats.bookings.toLocaleString()}</span>
                  <span className="text-muted-foreground ml-2">{t('social.successful_bookings')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Launching Soon Banner */}
        {!hasRealData && (
          <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-secondary/5 border border-border/40 rounded-2xl p-8 mb-16 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-widest">
                {t('social.launching_soon')}
              </span>
            </div>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              {t('social.join_first')}
            </p>
          </div>
        )}


        {/* Trust Badges */}
        <div className="flex flex-wrap justify-center items-center gap-8 mt-16 pt-10 border-t border-border/30">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="w-4 h-4 text-trust" />
            <span className="text-xs font-medium">{t('social.badge_secure')}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="w-4 h-4 text-accent" />
            <span className="text-xs font-medium">{t('social.badge_escrow')}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Award className="w-4 h-4 text-secondary" />
            <span className="text-xs font-medium">{t('social.badge_verified')}</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProofSection;
