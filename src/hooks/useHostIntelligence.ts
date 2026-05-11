import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PricingCalendarDay {
  date: string;
  suggested: number;
  baseline: number;
  reason: string;
}

export interface PricingSuggestion {
  property: { id: string; title: string; current_price: number };
  market: { comp_count: number; median_price: number; p25_price: number; p75_price: number };
  demand: { occupancy_90d: number; booked_nights: number; demand_multiplier: number };
  suggestion: { avg_suggested_price: number; delta_vs_current_pct: number; calendar: PricingCalendarDay[] };
}

export interface OccupancyForecastDay {
  date: string;
  booked: boolean;
  blocked: boolean;
  forecast_probability: number;
  revenue: number;
}
export interface OccupancyForecast {
  horizon_days: number;
  booked_nights: number;
  forecast_occupancy_pct: number;
  projected_revenue: number;
  nightly_rate: number;
  days: OccupancyForecastDay[];
}

export interface AIInsights {
  summary: string;
  strengths: string[];
  improvements: string[];
  recommendations: { title: string; action: string; impact: "low" | "medium" | "high" }[];
}
export interface AIInsightsResponse {
  insights: AIInsights;
  generated_at: string;
  cached: boolean;
}

export const useHostIntelligence = () => {
  const [pricingLoading, setPricingLoading] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const fetchPricing = async (propertyId: string): Promise<PricingSuggestion | null> => {
    setPricingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-pricing-suggest", {
        body: { property_id: propertyId },
      });
      if (error) throw error;
      return data as PricingSuggestion;
    } catch (e: any) {
      toast.error(e.message || "Failed to load pricing suggestions");
      return null;
    } finally {
      setPricingLoading(false);
    }
  };

  const fetchForecast = async (propertyId: string, horizonDays = 90): Promise<OccupancyForecast | null> => {
    setForecastLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("occupancy-forecast", {
        body: { property_id: propertyId, horizon_days: horizonDays },
      });
      if (error) throw error;
      return data as OccupancyForecast;
    } catch (e: any) {
      toast.error(e.message || "Failed to load forecast");
      return null;
    } finally {
      setForecastLoading(false);
    }
  };

  const fetchInsights = async (
    scope: "property" | "portfolio",
    propertyId?: string,
    force = false
  ): Promise<AIInsightsResponse | null> => {
    setInsightsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("host-ai-insights", {
        body: { scope, property_id: propertyId, force },
      });
      if (error) {
        // 402/429 surfaced via error
        if (error.message?.includes("Rate limit")) toast.error("AI rate limit. Try again in a moment.");
        else if (error.message?.includes("credits")) toast.error("AI credits required.");
        else toast.error(error.message || "Failed to load insights");
        return null;
      }
      return data as AIInsightsResponse;
    } catch (e: any) {
      toast.error(e.message || "Failed to load insights");
      return null;
    } finally {
      setInsightsLoading(false);
    }
  };

  return { pricingLoading, forecastLoading, insightsLoading, fetchPricing, fetchForecast, fetchInsights };
};
