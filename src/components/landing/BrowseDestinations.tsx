import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { useScroll3D } from "@/hooks/useScroll3D";
import { useLanguage } from "@/contexts/LanguageContext";

const destinations = [
  { name: "Nabeul", query: "governorate=Nabeul", label: "Nabeul" },
  { name: "Sousse", query: "governorate=Sousse", label: "Sousse" },
  { name: "Medenine", query: "governorate=Médenine", label: "Médenine" },
  { name: "Tunis", query: "governorate=Tunis", label: "Tunis" },
  { name: "Monastir", query: "governorate=Monastir", label: "Monastir" },
  { name: "Bizerte", query: "governorate=Bizerte", label: "Bizerte" },
  { name: "Mahdia", query: "governorate=Mahdia", label: "Mahdia" },
  { name: "Jendouba", query: "governorate=Jendouba", label: "Jendouba" },
  { name: "BenArous", query: "governorate=Ben Arous", label: "Ben Arous" },
  { name: "Sfax", query: "governorate=Sfax", label: "Sfax" },
  { name: "Tozeur", query: "governorate=Tozeur", label: "Tozeur" },
  { name: "Ariana", query: "governorate=Ariana", label: "Ariana" },
];

const BrowseDestinations = () => {
  const { ref, isVisible } = useScroll3D({ threshold: 0.15 });
  const { t } = useLanguage();

  return (
    <section className="py-20 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2 tracking-tight">
            {t('browse_dest.title')}
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            {t('browse_dest.subtitle')}
          </p>
        </div>
        <div ref={ref} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-w-5xl mx-auto">
          {destinations.map((dest, index) => (
            <Link
              key={dest.name}
              to={`/search?${dest.query}`}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border border-border/40 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group ${
                isVisible ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ 
                transitionDelay: `${index * 30}ms`,
                transform: isVisible ? 'translateY(0)' : 'translateY(15px)',
              }}
            >
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                {dest.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrowseDestinations;
