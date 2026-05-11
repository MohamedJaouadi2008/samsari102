
import { Shield, Users, Umbrella, HeartHandshake } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScroll3D } from "@/hooks/useScroll3D";

const TrustSection = () => {
  const { t } = useLanguage();
  const { ref, isVisible } = useScroll3D({ threshold: 0.1 });

  const features = [
    {
      icon: Shield,
      title: t('trust.secure_payment'),
      description: t('trust.secure_payment_desc'),
      color: 'primary',
    },
    {
      icon: Users,
      title: t('trust.verified_hosts'),
      description: t('trust.verified_hosts_desc'),
      color: 'trust',
    },
    {
      icon: Umbrella,
      title: t('trust.insurance'),
      description: t('trust.insurance_desc'),
      color: 'accent',
    },
    {
      icon: HeartHandshake,
      title: t('trust.support'),
      description: t('trust.support_desc'),
      color: 'secondary',
    }
  ];

  const colorClasses: Record<string, { bg: string; text: string }> = {
    primary: { bg: 'bg-primary/10', text: 'text-primary' },
    trust: { bg: 'bg-trust/10', text: 'text-trust' },
    accent: { bg: 'bg-accent/10', text: 'text-accent' },
    secondary: { bg: 'bg-secondary/10', text: 'text-secondary' },
  };

  return (
    <section className="py-24 bg-background relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight">
            {t('trust.title')}
          </h2>
          <div className="w-12 h-0.5 bg-primary mx-auto rounded-full" />
        </div>
        
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const colors = colorClasses[feature.color];
            return (
              <div 
                key={index}
                className={`group text-center p-8 rounded-2xl bg-card border border-border/40 hover:border-primary/20 hover:shadow-lg transition-all duration-500 hover:-translate-y-1 ${
                  isVisible ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ 
                  transitionDelay: `${index * 80}ms`,
                  transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                }}
              >
                <div 
                  className={`w-16 h-16 ${colors.bg} rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300`}
                >
                  <Icon className={`w-8 h-8 ${colors.text}`} />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
