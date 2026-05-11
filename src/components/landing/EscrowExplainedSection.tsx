
import { CreditCard, Shield, CheckCircle2, Wallet, RefreshCcw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScroll3D } from "@/hooks/useScroll3D";

const EscrowExplainedSection = () => {
  const { t } = useLanguage();
  const { ref, isVisible } = useScroll3D({ threshold: 0.15 });

  const steps = [
    {
      icon: CreditCard,
      day: t('escrow.day_1'),
      title: t('escrow.step_1_title'),
      description: t('escrow.step_1_desc'),
      color: 'bg-accent',
    },
    {
      icon: Shield,
      day: t('escrow.days_protected'),
      title: t('escrow.step_2_title'),
      description: t('escrow.step_2_desc'),
      color: 'bg-trust',
      highlight: true,
    },
    {
      icon: CheckCircle2,
      day: t('escrow.check_in_day'),
      title: t('escrow.step_3_title'),
      description: t('escrow.step_3_desc'),
      color: 'bg-secondary',
    },
    {
      icon: Wallet,
      day: t('escrow.release_day'),
      title: t('escrow.step_4_title'),
      description: t('escrow.step_4_desc'),
      color: 'bg-primary',
    },
  ];

  return (
    <section className="py-24 bg-muted/10 relative overflow-hidden">
      {/* Subtle background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-border/30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-border/30" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-trust/10 text-foreground px-4 py-1.5 rounded-full mb-5">
            <Shield className="w-3.5 h-3.5 text-trust" />
            <span className="text-xs font-semibold uppercase tracking-wide">{t('escrow.badge')}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight">
            {t('escrow.title')}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t('escrow.subtitle')}
          </p>
        </div>

        {/* Timeline */}
        <div ref={ref} className="relative max-w-5xl mx-auto">
          {/* Connection Line - Desktop */}
          <div 
            className="hidden md:block absolute top-[52px] left-[12%] right-[12%] h-px bg-gradient-to-r from-accent via-trust to-primary transition-all duration-1000"
            style={{ 
              transform: isVisible ? 'scaleX(1)' : 'scaleX(0)',
              transformOrigin: 'left',
            }}
          />
          
          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={index}
                  className={`relative text-center transition-all duration-500 ${
                    isVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ 
                    transitionDelay: `${index * 150}ms`,
                    transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                  }}
                >
                  {/* Icon Container */}
                  <div className="relative mx-auto mb-5">
                    <div className={`w-14 h-14 ${step.color} rounded-xl flex items-center justify-center mx-auto shadow-md ${step.highlight ? 'ring-2 ring-trust/20 ring-offset-2 ring-offset-background' : ''}`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                  </div>

                  {/* Day Badge */}
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    {step.day}
                  </div>

                  {/* Content */}
                  <h3 className="text-base font-bold text-foreground mb-1.5">{step.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>

                  {/* Arrow - Mobile */}
                  {index < steps.length - 1 && (
                    <div className="md:hidden flex justify-center my-4">
                      <svg className="w-5 h-5 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cancellation Note */}
        <div 
          className={`mt-14 max-w-2xl mx-auto transition-all duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`} 
          style={{ transitionDelay: '600ms', transform: isVisible ? 'translateY(0)' : 'translateY(20px)' }}
        >
          <div className="bg-card rounded-xl border border-border/40 p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <RefreshCcw className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-sm mb-0.5">{t('escrow.cancellation_title')}</h4>
              <p className="text-xs text-muted-foreground">{t('escrow.cancellation_desc')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EscrowExplainedSection;
