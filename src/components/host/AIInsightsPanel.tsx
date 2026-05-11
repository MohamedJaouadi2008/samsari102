import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, RefreshCw, CheckCircle2, AlertCircle, Lightbulb } from "lucide-react";
import { useHostIntelligence, type AIInsightsResponse } from "@/hooks/useHostIntelligence";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface Props {
  scope: "property" | "portfolio";
  propertyId?: string;
}

const impactColor = {
  high: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  medium: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  low: "bg-muted text-muted-foreground",
};

const AIInsightsPanel = ({ scope, propertyId }: Props) => {
  const { fetchInsights, insightsLoading } = useHostIntelligence();
  const [data, setData] = useState<AIInsightsResponse | null>(null);

  const load = async (force = false) => {
    const result = await fetchInsights(scope, propertyId, force);
    if (result) setData(result);
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, propertyId]);

  if (insightsLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="w-4 h-4 text-primary" /> AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="w-4 h-4 text-primary" /> AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => load(true)} disabled={insightsLoading} className="w-full">
            <Brain className="w-4 h-4 mr-2" /> Generate insights
          </Button>
        </CardContent>
      </Card>
    );
  }

  const insights = data.insights;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="w-4 h-4 text-primary" /> AI Insights
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Updated {formatDistanceToNow(new Date(data.generated_at), { addSuffix: true })}
            {data.cached && " · cached"}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => load(true)} disabled={insightsLoading} title="Regenerate">
          <RefreshCw className={`w-4 h-4 ${insightsLoading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-sm leading-relaxed">{insights.summary}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Strengths
            </h4>
            <ul className="space-y-1.5">
              {insights.strengths.map((s, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-emerald-600 mt-0.5">✓</span> {s}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" /> Improve
            </h4>
            <ul className="space-y-1.5">
              {insights.improvements.map((s, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-amber-600 mt-0.5">!</span> {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-primary" /> Recommendations
          </h4>
          <div className="space-y-2">
            {insights.recommendations.map((r, i) => (
              <div key={i} className="p-2.5 rounded-lg border bg-card">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium">{r.title}</p>
                  <Badge variant="outline" className={`text-[10px] ${impactColor[r.impact]}`}>
                    {r.impact}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.action}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground italic text-center">
          Generated by AI · cached for 24 hours
        </p>
      </CardContent>
    </Card>
  );
};

export default AIInsightsPanel;
