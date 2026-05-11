import { MapPin, Star, Shield, Users, ArrowRight, Home, Sparkles, Megaphone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useScroll3D } from "@/hooks/useScroll3D";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useUserPreferences, scoreProperty } from "@/hooks/useUserPreferences";
import { applyPublicPropertyFilter } from "@/lib/propertyVisibility";
import VerifiedBadge from "@/components/VerifiedBadge";

const TARGET_COUNT = 8;

const FeaturedPropertiesSection = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { ref, isVisible } = useScroll3D({ threshold: 0.1 });
  const { data: prefs } = useUserPreferences();

  // Admin manually-curated featured IDs
  const { data: adminFeaturedIds } = useQuery({
    queryKey: ['featured-property-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'featured_property_ids')
        .single();
      if (error || !data?.value) return [];
      try { return JSON.parse(data.value) as string[]; } catch { return []; }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Actively promoted (paid) properties
  const { data: promotedPropertyIds } = useQuery({
    queryKey: ['promoted-property-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_promotions')
        .select('property_id')
        .eq('status', 'active')
        .gt('ends_at', new Date().toISOString());
      if (error) return [];
      return data.map(p => p.property_id);
    },
    staleTime: 60 * 1000,
  });

  // Promoted set (sponsored badge)
  const promotedSet = new Set(promotedPropertyIds || []);

  // Priority list: promoted first, then admin-curated, deduped
  const priorityIds = Array.from(new Set([
    ...(promotedPropertyIds || []),
    ...(adminFeaturedIds || []),
  ])).slice(0, 25);

  // Fetch the priority (promoted + curated) properties
  const { data: priorityProperties, isLoading: priorityLoading } = useQuery({
    queryKey: ['featured-priority-properties', priorityIds],
    queryFn: async () => {
      if (priorityIds.length === 0) return [];
      const { data, error } = await applyPublicPropertyFilter(
        supabase
          .from('properties')
          .select('id, title, city, governorate, property_type, price_per_night, photos, max_guests, host_id, is_verified')
          .in('id', priorityIds)
      );
      if (error) throw error;
      return data || [];
    },
    enabled: priorityIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Pad with top-performing public properties if we have fewer than TARGET_COUNT
  const needPadCount = Math.max(0, TARGET_COUNT - (priorityProperties?.length || 0));
  const { data: topPerformers, isLoading: padLoading } = useQuery({
    queryKey: ['featured-top-performers', priorityIds, needPadCount],
    queryFn: async () => {
      if (needPadCount === 0) return [];
      const { data, error } = await applyPublicPropertyFilter(
        supabase
          .from('properties')
          .select('id, title, city, governorate, property_type, price_per_night, photos, max_guests, host_id, created_at, is_verified')
          .order('created_at', { ascending: false })
          .limit(needPadCount + priorityIds.length + 4)
      );
      if (error) return [];
      // Filter out anything already in priority list
      return (data || []).filter(p => !priorityIds.includes(p.id)).slice(0, needPadCount);
    },
    enabled: needPadCount > 0,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = priorityLoading || padLoading;

  const properties = [
    ...(priorityProperties || []),
    ...(topPerformers || []),
  ];

  // Ratings
  const { data: ratingsMap } = useQuery({
    queryKey: ['property-ratings-featured', properties.map(p => p.id)],
    queryFn: async () => {
      if (properties.length === 0) return {};
      const { data } = await supabase
        .from('reviews')
        .select('property_id, rating')
        .in('property_id', properties.map(p => p.id));
      const ratings: Record<string, { avg: number; count: number }> = {};
      if (data) {
        data.forEach(r => {
          if (!ratings[r.property_id]) ratings[r.property_id] = { avg: 0, count: 0 };
          ratings[r.property_id].count++;
          ratings[r.property_id].avg =
            (ratings[r.property_id].avg * (ratings[r.property_id].count - 1) + r.rating) /
            ratings[r.property_id].count;
        });
      }
      return ratings;
    },
    enabled: properties.length > 0,
  });

  // Personalized re-ordering, but keep promoted properties pinned to the top
  const orderedProperties = (() => {
    if (properties.length === 0) return properties;
    const promoted = properties.filter(p => promotedSet.has(p.id));
    const rest = properties.filter(p => !promotedSet.has(p.id));
    if (!prefs?.hasSignals) return [...promoted, ...rest];
    const scored = rest.map(p => ({ p, score: scoreProperty(p as any, prefs) + Math.random() * 0.5 }));
    scored.sort((a, b) => b.score - a.score);
    return [...promoted, ...scored.map(s => s.p)];
  })();

  const hasProperties = orderedProperties.length > 0;

  // Empty state — only if literally zero properties exist on the platform
  if (!isLoading && !hasProperties) {
    return (
      <section className="py-24 bg-background relative">
        <div className="container mx-auto px-4">
          <div
            ref={ref}
            className={`max-w-lg mx-auto text-center transition-all duration-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold uppercase tracking-wide">{t('featured.coming_soon')}</span>
            </div>
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Home className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 tracking-tight">
              {t('featured.coming_soon_title')}
            </h2>
            <p className="text-muted-foreground mb-8 text-sm">
              {t('featured.coming_soon_desc')}
            </p>
            <Button size="lg" className="group" onClick={() => navigate('/search')}>
              {t('featured.become_host')}
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 bg-background relative">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1 tracking-tight">
              {t('featured.title')}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t('featured.subtitle')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="group self-start md:self-auto"
            onClick={() => navigate('/search')}
          >
            {t('featured.browse_all')}
            <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>

        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {isLoading ? (
            [...Array(8)].map((_, index) => (
              <Card key={index} className="overflow-hidden border-border/40">
                <div className="aspect-[4/3] bg-muted animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                </div>
              </Card>
            ))
          ) : (
            orderedProperties.map((property, index) => {
              const photos = (property.photos as Array<{ type: string; url: string }>) || [];
              const mainPhoto = photos[0]?.url || '/placeholder.svg';
              const rating = ratingsMap?.[property.id];
              const isSponsored = promotedSet.has(property.id);

              return (
                <Card
                  key={property.id}
                  className={`group overflow-hidden cursor-pointer border-border/40 hover:border-primary/20 hover:shadow-lg transition-all duration-500 hover:-translate-y-1 ${
                    isVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{
                    transitionDelay: `${index * 60}ms`,
                    transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                  }}
                  onClick={() => navigate(`/property/${property.id}`)}
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={mainPhoto}
                      alt={property.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                    {isSponsored ? (
                      <div className="absolute top-3 left-3 bg-accent text-accent-foreground px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 shadow-sm">
                        <Megaphone className="w-2.5 h-2.5" />
                        {t('featured.sponsored')}
                      </div>
                    ) : (
                      <div className="absolute top-3 left-3 bg-trust/90 text-white px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                        <Shield className="w-2.5 h-2.5" />
                        {t('featured.protected')}
                      </div>
                    )}
                    <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                      <span className="font-bold text-foreground text-sm">{property.price_per_night} TND</span>
                      <span className="text-muted-foreground text-xs">/{t('featured.night')}</span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors flex-1">
                        {property.title}
                      </h3>
                      {(property as any).is_verified && (
                        <VerifiedBadge size="xs" showLabel={false} tooltip={t('property.verified_tooltip') || 'Verified by Samsari'} />
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">
                      <MapPin className="w-3 h-3" />
                      <span className="line-clamp-1">{property.city}, {property.governorate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-secondary text-secondary" />
                        <span className="font-medium text-foreground text-xs">
                          {rating ? rating.avg.toFixed(1) : '0.0'}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          ({rating ? rating.count : 0})
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Users className="w-3 h-3" />
                        <span>{property.max_guests}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default FeaturedPropertiesSection;
