
import { Shield, CreditCard, Umbrella, FileText, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import useScrollAnimation from "@/hooks/useScrollAnimation";
import { useNavigate } from "react-router-dom";

const TrustCenterSection = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.2 });

  const links = [
    { icon: Shield, title: t('trust_center.id_verification'), description: t('trust_center.id_verification_desc'), href: '/safety' },
    { icon: Umbrella, title: t('trust_center.insurance'), description: t('trust_center.insurance_desc'), href: '/safety' },
    { icon: CreditCard, title: t('trust_center.payment_security'), description: t('trust_center.payment_security_desc'), href: '/safety' },
    { icon: FileText, title: t('trust_center.cancellation'), description: t('trust_center.cancellation_desc'), href: '/terms' },
  ];

  return (
    <section className="py-20 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2 tracking-tight">
            {t('trust_center.title')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('trust_center.subtitle')}
          </p>
        </div>

        <div 
          ref={ref}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mx-auto"
        >
          {links.map((link, index) => {
            const Icon = link.icon;
            return (
              <button
                key={index}
                onClick={() => navigate(link.href)}
                className={`group text-left p-5 bg-card rounded-xl border border-border/40 hover:border-primary/20 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${index * 60}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-foreground text-sm">{link.title}</h3>
                      <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{link.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrustCenterSection;
