import { MapPin, Star, Shield, Users, Megaphone, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useScroll3D } from "@/hooks/useScroll3D";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { applyPublicPropertyFilter } from "@/lib/propertyVisibility";
import VerifiedBadge from "@/components/VerifiedBadge";

const TARGET_COUNT = 8;

const PopularInCity = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ref, isVisible } = useScroll3D({ threshold: 0.1 });

  // Find the user's most-recent stayed-in city
  const { data: lastCity } = useQuery({
    queryKey: ['user-last-stayed-city', user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('property_id, created_at, status')
        .eq('guest_id', user!.id)
        .in('status', ['checked_in', 'checked_out', 'settlement_pending', 'dispute_window', 'settled'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (error || !data || data.length === 0) return null;

      const { data: prop } = await supabase
        .from('properties')
        .select('city, governorate')
        .eq('id', data[0].property_id)
        .maybeSingle();
      if (!prop?.city) return null;
      return { city: prop.city, governorate: prop.governorate };
    },
  });

  // Active promoted properties (for sponsored badge + pinning)
  const { data: promotedIds } = useQuery({
    queryKey: ['popular-promoted-ids'],
    queryFn: async () => {
      const { data } = await supabase
        .from('property_promotions')
        .select('property_id')
        .eq('status', 'active')
        .gt('ends_at', new Date().toISOString());
      return (data || []).map(p => p.property_id);
    },
    staleTime: 60 * 1000,
  });

  const promotedSet = new Set(promotedIds || []);

  // Fetch top properties in that city
  const { data: properties, isLoading } = useQuery({
    queryKey: ['popular-in-city', lastCity?.city],
    enabled: !!lastCity?.city,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await applyPublicPropertyFilter(
        supabase
          .from('properties')
          .select('id, title, city, governorate, property_type, price_per_night, photos, max_guests, host_id, created_at, is_verified')
          .eq('city', lastCity!.city)
          .order('created_at', { ascending: false })
          .limit(40)
      );
      if (error) return [];
      return data || [];
    },
  });

  // Ratings
  const { data: ratingsMap } = useQuery({
    queryKey: ['popular-in-city-ratings', properties?.map(p => p.id)],
    enabled: !!properties && properties.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('reviews')
        .select('property_id, rating')
        .in('property_id', properties!.map(p => p.id));
      const map: Record<string, { avg: number; count: number }> = {};
      (data || []).forEach(r => {
        if (!map[r.property_id]) map[r.property_id] = { avg: 0, count: 0 };
        map[r.property_id].count++;
        map[r.property_id].avg =
          (map[r.property_id].avg * (map[r.property_id].count - 1) + r.rating) /
          map[r.property_id].count;
      });
      return map;
    },
  });

  // Hide if logged out or no booking history
  if (!user || !lastCity || !properties || properties.length === 0) {
    return null;
  }

  // Sort: promoted first, then by rating count then avg, then newest
  const sorted = [...properties].sort((a, b) => {
    const aPromoted = promotedSet.has(a.id) ? 1 : 0;
    const bPromoted = promotedSet.has(b.id) ? 1 : 0;
    if (aPromoted !== bPromoted) return bPromoted - aPromoted;
    const aR = ratingsMap?.[a.id];
    const bR = ratingsMap?.[b.id];
    const aScore = aR ? aR.avg * Math.log(aR.count + 1) : 0;
    const bScore = bR ? bR.avg * Math.log(bR.count + 1) : 0;
    if (bScore !== aScore) return bScore - aScore;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }).slice(0, TARGET_COUNT);

  if (isLoading) return null;

  return (
    <section className="py-20 bg-muted/20 relative">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full mb-3">
              <MapPin className="w-3 h-3" />
              <span className="text-[10px] font-semibold uppercase tracking-widest">{t('popular_city.badge')}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1 tracking-tight">
              {t('popular_city.title').replace('{city}', lastCity.city)}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t('popular_city.subtitle').replace('{city}', lastCity.city)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="group self-start md:self-auto"
            onClick={() => navigate(`/search?city=${encodeURIComponent(lastCity.city)}`)}
          >
            {t('popular_city.explore_more')}
            <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>

        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {sorted.map((property, index) => {
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
          })}
        </div>
      </div>
    </section>
  );
};

export default PopularInCity;
