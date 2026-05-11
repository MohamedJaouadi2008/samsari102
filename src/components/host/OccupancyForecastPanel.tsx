import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarRange, RefreshCw } from "lucide-react";
import { useHostIntelligence, type OccupancyForecast } from "@/hooks/useHostIntelligence";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  propertyId: string;
}

const OccupancyForecastPanel = ({ propertyId }: Props) => {
  const { fetchForecast, forecastLoading } = useHostIntelligence();
  const [data, setData] = useState<OccupancyForecast | null>(null);
  const [horizon, setHorizon] = useState<30 | 60 | 90>(30);

  const load = async (h = horizon) => {
    const result = await fetchForecast(propertyId, h);
    if (result) setData(result);
  };

  useEffect(() => {
    load(horizon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, horizon]);

  if (forecastLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="w-4 h-4 text-primary" /> Occupancy Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const chartData = data.days.map((d) => ({
    date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    probability: d.forecast_probability,
    revenue: d.revenue,
    booked: d.booked,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="w-4 h-4 text-primary" /> Occupancy Forecast
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {data.forecast_occupancy_pct}% projected · {data.booked_nights} nights already booked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={String(horizon)} onValueChange={(v) => setHorizon(Number(v) as 30 | 60 | 90)}>
            <TabsList className="h-8">
              <TabsTrigger value="30" className="text-xs px-2">30d</TabsTrigger>
              <TabsTrigger value="60" className="text-xs px-2">60d</TabsTrigger>
              <TabsTrigger value="90" className="text-xs px-2">90d</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="icon" onClick={() => load()} disabled={forecastLoading}>
            <RefreshCw className={`w-4 h-4 ${forecastLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Projected occupancy</p>
            <p className="text-lg font-bold">{data.forecast_occupancy_pct}%</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Booked nights</p>
            <p className="text-lg font-bold">{data.booked_nights}</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
            <p className="text-xs text-muted-foreground">Projected revenue</p>
            <p className="text-lg font-bold text-primary">{data.projected_revenue.toLocaleString()} TND</p>
          </div>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: any, name: string) => [
                  name === "probability" ? `${value}%` : `${value} TND`,
                  name === "probability" ? "Probability" : "Revenue",
                ]}
              />
              <Area type="monotone" dataKey="probability" stroke="#dc2626" strokeWidth={2} fill="url(#probGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-muted-foreground italic">
          Forecast combines confirmed bookings, blocked dates, and seasonal demand patterns for Tunisia.
        </p>
      </CardContent>
    </Card>
  );
};

export default OccupancyForecastPanel;
