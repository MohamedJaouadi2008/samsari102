import AIInsightsPanel from "@/components/host/AIInsightsPanel";

const HostInsightsTab = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Portfolio Insights</h2>
        <p className="text-sm text-muted-foreground">
          AI-generated analysis across all your listings, refreshed every 24 hours.
        </p>
      </div>
      <AIInsightsPanel scope="portfolio" />
    </div>
  );
};

export default HostInsightsTab;
