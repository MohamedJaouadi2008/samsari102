import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MapPin, Star, Sparkles, ArrowRight, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScroll3D } from "@/hooks/useScroll3D";
import { applyPublicPropertyFilter } from "@/lib/propertyVisibility";
import VerifiedBadge from "@/components/VerifiedBadge";

const DailyPicksSection = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { ref, isVisible } = useScroll3D({ threshold: 0.1 });

  const { data: pickIds } = useQuery({
    queryKey: ["daily-picks"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.functions.invoke("daily-picks");
      if (error || !data?.property_ids) return [];
      return data.property_ids as string[];
    },
    staleTime: 60 * 60 * 1000,
  });

  const { data: properties, isLoading } = useQuery({
    queryKey: ["daily-picks-props", pickIds],
    queryFn: async () => {
      if (!pickIds || pickIds.length === 0) return [];
      const { data } = await applyPublicPropertyFilter(
        supabase
          .from("properties")
          .select("id, title, city, governorate, price_per_night, photos, max_guests, is_verified")
          .in("id", pickIds)
      );
      // preserve order from pickIds
      const map = new Map((data || []).map((p) => [p.id, p]));
      return pickIds.map((id) => map.get(id)).filter(Boolean) as any[];
    },
    enabled: !!pickIds && pickIds.length > 0,
    staleTime: 60 * 60 * 1000,
  });

  const { data: ratingsMap } = useQuery({
    queryKey: ["daily-picks-ratings", properties?.map((p) => p.id)],
    queryFn: async () => {
      if (!properties || properties.length === 0) return {};
      const { data } = await supabase
        .from("reviews")
        .select("property_id, rating")
        .in("property_id", properties.map((p) => p.id))
        .eq("status", "approved");
      const out: Record<string, { avg: number; count: number }> = {};
      data?.forEach((r) => {
        if (!out[r.property_id]) out[r.property_id] = { avg: 0, count: 0 };
        out[r.property_id].count++;
        out[r.property_id].avg =
          (out[r.property_id].avg * (out[r.property_id].count - 1) + r.rating) /
          out[r.property_id].count;
      });
      return out;
    },
    enabled: !!properties && properties.length > 0,
  });

  if (!isLoading && (!properties || properties.length === 0)) return null;

  return (
    <section className="py-20 bg-gradient-to-b from-background via-primary/[0.02] to-background">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {t("daily_picks.badge") || "Picked for today"}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              {t("daily_picks.title") || "Today's Picks"}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {t("daily_picks.subtitle") || "12 hand-selected stays, refreshed daily"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="group self-start md:self-auto"
            onClick={() => navigate("/search")}
          >
            {t("featured.browse_all")}
            <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>

        <div
          ref={ref}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          {isLoading
            ? [...Array(8)].map((_, i) => (
                <Card key={i} className="overflow-hidden border-border/40">
                  <div className="aspect-[4/3] bg-muted animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                  </div>
                </Card>
              ))
            : properties?.map((property, index) => {
                const photos = (property.photos as Array<{ type: string; url: string }>) || [];
                const mainPhoto = photos[0]?.url || "/placeholder.svg";
                const rating = ratingsMap?.[property.id];
                return (
                  <Card
                    key={property.id}
                    className="group overflow-hidden cursor-pointer border-border/40 hover:border-primary/20 hover:shadow-lg transition-all duration-500 hover:-translate-y-1 animate-fade-in"
                    style={{
                      animationDelay: `${index * 60}ms`,
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
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                      <div className="absolute top-3 left-3 bg-primary/90 text-primary-foreground px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        {t("daily_picks.tag") || "Pick"}
                      </div>
                      <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                        <span className="font-bold text-foreground text-sm">
                          {property.price_per_night} TND
                        </span>
                        <span className="text-muted-foreground text-xs">/{t("featured.night")}</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors flex-1">
                          {property.title}
                        </h3>
                        {property.is_verified && (
                          <VerifiedBadge size="xs" showLabel={false} tooltip={t("property.verified_tooltip") || "Verified by Samsari"} />
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">
                        <MapPin className="w-3 h-3" />
                        <span className="line-clamp-1">
                          {property.city}, {property.governorate}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-secondary text-secondary" />
                          <span className="font-medium text-foreground text-xs">
                            {rating ? rating.avg.toFixed(1) : "0.0"}
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

export default DailyPicksSection;
