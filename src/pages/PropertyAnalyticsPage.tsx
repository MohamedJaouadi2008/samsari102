import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PropertyAnalytics from "@/components/host/PropertyAnalytics";

const PropertyAnalyticsPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <PropertyAnalytics />
      </main>
      <Footer />
    </div>
  );
};

export default PropertyAnalyticsPage;
