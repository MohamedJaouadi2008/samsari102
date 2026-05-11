import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { useHostIntelligence, type PricingSuggestion } from "@/hooks/useHostIntelligence";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  propertyId: string;
}

const reasonLabel: Record<string, string> = {
  weekend_premium: "Weekend",
  high_season: "High season",
  low_season: "Low season",
  standard: "Standard",
};

const SmartPricingPanel = ({ propertyId }: Props) => {
  const { fetchPricing, pricingLoading } = useHostIntelligence();
  const [data, setData] = useState<PricingSuggestion | null>(null);

  const load = async () => {
    const result = await fetchPricing(propertyId);
    if (result) setData(result);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  if (pricingLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" /> Smart Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const delta = data.suggestion.delta_vs_current_pct;
  const DeltaIcon = delta > 2 ? TrendingUp : delta < -2 ? TrendingDown : Minus;
  const deltaColor = delta > 2 ? "text-emerald-600" : delta < -2 ? "text-amber-600" : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" /> Smart Pricing
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Based on {data.market.comp_count} local comps + 90-day demand
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={load} disabled={pricingLoading}>
          <RefreshCw className={`w-4 h-4 ${pricingLoading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-lg font-bold">{data.property.current_price} TND</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
            <p className="text-xs text-muted-foreground">Suggested avg</p>
            <p className="text-lg font-bold text-primary">{data.suggestion.avg_suggested_price} TND</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Market median</p>
            <p className="text-lg font-bold">{data.market.median_price} TND</p>
          </div>
        </div>

        <div className={`flex items-center gap-2 text-sm ${deltaColor}`}>
          <DeltaIcon className="w-4 h-4" />
          <span className="font-medium">
            {delta > 0 ? "+" : ""}
            {delta}% vs your current price
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {data.demand.occupancy_90d}% occupancy last 90d
          </span>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Next 14 days</p>
          <div className="grid grid-cols-7 gap-1">
            {data.suggestion.calendar.map((d) => {
              const isPremium = d.suggested > d.baseline * 1.05;
              const isDiscount = d.suggested < d.baseline * 0.95;
              return (
                <div
                  key={d.date}
                  className={`p-1.5 rounded text-center text-[10px] ${
                    isPremium
                      ? "bg-emerald-500/10 border border-emerald-500/30"
                      : isDiscount
                      ? "bg-amber-500/10 border border-amber-500/30"
                      : "bg-muted"
                  }`}
                  title={`${d.date} · ${reasonLabel[d.reason]}`}
                >
                  <div className="font-medium text-xs">{d.suggested}</div>
                  <div className="text-muted-foreground">
                    {new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30">Premium days</Badge>
            <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30">Discount days</Badge>
          </div>
        </div>

        <p className="text-xs text-muted-foreground italic">
          Suggestions are estimates based on local market data, seasonality, and weekend demand. Final pricing remains your decision.
        </p>
      </CardContent>
    </Card>
  );
};

export default SmartPricingPanel;
