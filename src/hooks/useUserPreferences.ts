import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserPreferences {
  governorates: Record<string, number>;
  cities: Record<string, number>;
  propertyTypes: Record<string, number>;
  hasSignals: boolean;
}

const EMPTY: UserPreferences = {
  governorates: {},
  cities: {},
  propertyTypes: {},
  hasSignals: false,
};

/**
 * Aggregates user signals (bookings + searches) into weighted preferences.
 * Bookings weight = 3, searches weight = 2.
 */
export function useUserPreferences() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-preferences", user?.id],
    queryFn: async (): Promise<UserPreferences> => {
      if (!user) return EMPTY;

      const [bookingsRes, searchesRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("property_id, properties:property_id(governorate, city, property_type)")
          .eq("guest_id", user.id)
          .limit(50),
        supabase
          .from("user_search_history")
          .select("governorate, city, property_type")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const prefs: UserPreferences = {
        governorates: {},
        cities: {},
        propertyTypes: {},
        hasSignals: false,
      };

      const bump = (bag: Record<string, number>, key: string | null | undefined, w: number) => {
        if (!key) return;
        bag[key] = (bag[key] || 0) + w;
        prefs.hasSignals = true;
      };

      bookingsRes.data?.forEach((b: any) => {
        const p = b.properties;
        if (!p) return;
        bump(prefs.governorates, p.governorate, 3);
        bump(prefs.cities, p.city, 3);
        bump(prefs.propertyTypes, p.property_type, 3);
      });

      searchesRes.data?.forEach((s) => {
        bump(prefs.governorates, s.governorate, 2);
        bump(prefs.cities, s.city, 2);
        bump(prefs.propertyTypes, s.property_type, 2);
      });

      return prefs;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Score a property against user preferences. Higher = better match.
 */
export function scoreProperty(
  property: { governorate?: string | null; city?: string | null; property_type?: string | null },
  prefs: UserPreferences
): number {
  let score = 0;
  if (property.governorate) score += prefs.governorates[property.governorate] || 0;
  if (property.city) score += (prefs.cities[property.city] || 0) * 1.5;
  if (property.property_type) score += prefs.propertyTypes[property.property_type] || 0;
  return score;
}
