import { Shield, Users, Umbrella, Wallet, ArrowRight, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import useScrollAnimation from "@/hooks/useScrollAnimation";
import { useNavigate } from "react-router-dom";

const BecomeHostCTA = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { ref: leftRef, isVisible: leftVisible } = useScrollAnimation({ threshold: 0.2 });
  const { ref: rightRef, isVisible: rightVisible } = useScrollAnimation({ threshold: 0.2 });

  const benefits = [
    { icon: Shield, title: t("host_cta.benefit_1_title"), description: t("host_cta.benefit_1_desc") },
    { icon: Users, title: t("host_cta.benefit_2_title"), description: t("host_cta.benefit_2_desc") },
    { icon: Umbrella, title: t("host_cta.benefit_3_title"), description: t("host_cta.benefit_3_desc") },
    { icon: Wallet, title: t("host_cta.benefit_4_title"), description: t("host_cta.benefit_4_desc") },
  ];

  return (
    <section className="py-24 bg-foreground text-background relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.06]">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left - Benefits */}
          <div
            ref={leftRef}
            className={`transition-all duration-700 ${
              leftVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
          >
            <div className="inline-flex items-center gap-2 bg-primary/20 text-primary-foreground px-3 py-1.5 rounded-full mb-6">
              <Wallet className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold uppercase tracking-wide">{t("host_cta.badge")}</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">{t("host_cta.title")}</h2>
            <p className="text-background/60 mb-8">{t("host_cta.subtitle")}</p>

            <div className="space-y-4 mb-8">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 transition-all duration-500 ${
                      leftVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
                    }`}
                    style={{ transitionDelay: `${index * 80 + 200}ms` }}
                  >
                    <div className="w-9 h-9 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm mb-0.5">{benefit.title}</h3>
                      <p className="text-background/50 text-xs">{benefit.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground group"
              onClick={() => navigate("/become-host")}
            >
              {t("host_cta.cta_button")}
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>

          {/* Right - Visual */}
          <div
            ref={rightRef}
            className={`relative transition-all duration-700 ${
              rightVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80"
                  alt="Host welcoming guests"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Floating Stats Card */}
              <div className="absolute -bottom-4 -left-4 bg-background text-foreground p-3.5 rounded-xl shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-trust/10 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-trust" />
                  </div>
                  <div>
                    <div className="text-xl font-bold">91%</div>
                    <div className="text-xs text-muted-foreground">{t("host_cta.keep_earnings")}</div>
                  </div>
                </div>
              </div>

              {/* Fee Badge */}
              <div className="absolute -top-3 -right-3 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg shadow-lg">
                <div className="text-xs font-medium">{t("host_cta.fee_label")}</div>
                <div className="text-lg font-bold">9%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BecomeHostCTA;
