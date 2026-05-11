
import { Search, CreditCard, Home, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScroll3D } from "@/hooks/useScroll3D";

const HowItWorks = () => {
  const { t } = useLanguage();
  const { ref, isVisible } = useScroll3D({ threshold: 0.15 });

  const steps = [
    {
      icon: Search,
      title: t('how.search'),
      description: t('how.search_desc'),
      color: 'bg-primary/10',
      iconColor: 'text-primary',
      step: 1
    },
    {
      icon: CreditCard,
      title: t('how.book'),
      description: t('how.book_desc'),
      color: 'bg-accent/10',
      iconColor: 'text-accent',
      step: 2
    },
    {
      icon: Home,
      title: t('how.enjoy'),
      description: t('how.enjoy_desc'),
      color: 'bg-secondary/10',
      iconColor: 'text-secondary',
      step: 3
    }
  ];

  return (
    <section className="py-24 bg-background relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight">
            {t('how.title')}
          </h2>
          <div className="w-12 h-0.5 bg-accent mx-auto rounded-full" />
        </div>
        
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto relative">
          {/* Connection line for desktop */}
          <div 
            className="hidden md:block absolute top-20 left-[20%] right-[20%] h-px bg-gradient-to-r from-primary via-accent to-secondary transition-all duration-1000" 
            style={{
              transform: isVisible ? 'scaleX(1)' : 'scaleX(0)',
              transformOrigin: 'left',
            }}
          />
          
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div 
                key={index}
                className={`relative text-center group transition-all duration-500 ${
                  isVisible ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ 
                  transitionDelay: `${index * 150}ms`,
                  transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                }}
              >
                {/* Step card */}
                <div className="bg-card rounded-2xl p-8 border border-border/40 hover:border-primary/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  {/* Step number */}
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-xs shadow-md z-10">
                    {step.step}
                  </div>
                  
                  {/* Icon */}
                  <div className={`w-20 h-20 ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-105 transition-transform duration-300`}>
                    <Icon className={`w-10 h-10 ${step.iconColor}`} />
                  </div>
                  
                  <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>

                {/* Arrow for mobile */}
                {index < steps.length - 1 && (
                  <div className="md:hidden flex justify-center my-4">
                    <ArrowRight className="w-5 h-5 text-border rotate-90" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
