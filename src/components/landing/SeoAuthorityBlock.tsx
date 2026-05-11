import { Link } from "react-router-dom";
import { Shield, CheckCircle2, MapPin, CreditCard, Users, Headphones } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const SeoAuthorityBlock = () => {
  const { t } = useLanguage();

  const features = [
    { icon: CreditCard, title: t('seo_auth.feat1_title'), desc: t('seo_auth.feat1_desc') },
    { icon: Users, title: t('seo_auth.feat2_title'), desc: t('seo_auth.feat2_desc') },
    { icon: Headphones, title: t('seo_auth.feat3_title'), desc: t('seo_auth.feat3_desc') },
    { icon: CheckCircle2, title: t('seo_auth.feat4_title'), desc: t('seo_auth.feat4_desc') },
  ];

  return (
    <section className="py-24 bg-muted/10 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-[0.012]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)`,
        backgroundSize: '32px 32px',
      }} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-primary/8 text-primary px-4 py-1.5 rounded-full mb-5">
              <Shield className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold uppercase tracking-wide">{t('seo_auth.badge')}</span>
            </div>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-3 tracking-tight">
              {t('seo_auth.title')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('seo_auth.subtitle')}
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-10 items-start">
            <div className="lg:col-span-3 space-y-5 text-sm text-muted-foreground leading-relaxed">
              <p>{t('seo_auth.p1')}</p>
              <p>{t('seo_auth.p2')}</p>
              <p>{t('seo_auth.p3')}</p>

              <div className="bg-card rounded-xl border border-border/40 p-5 mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-foreground font-semibold text-sm">{t('seo_auth.browse_by_dest')}</span>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t('seo_auth.dest_intro')}{" "}
                  <Link to="/search?city=Tunis" className="text-primary hover:underline font-medium">Tunis</Link>{" "}
                  {t('seo_auth.dest_and_coastal')}{" "}
                  <Link to="/search?city=Hammamet" className="text-primary hover:underline font-medium">Hammamet</Link>,{" "}
                  <Link to="/search?city=Sousse" className="text-primary hover:underline font-medium">Sousse</Link>,{" "}
                  <Link to="/search?city=Monastir" className="text-primary hover:underline font-medium">Monastir</Link>,{" "}
                  {t('seo_auth.dest_island')}{" "}
                  <Link to="/search?city=Djerba" className="text-primary hover:underline font-medium">Djerba</Link>,{" "}
                  {t('seo_auth.dest_north')}{" "}
                  <Link to="/search?city=Bizerte" className="text-primary hover:underline font-medium">Bizerte</Link>,{" "}
                  <Link to="/search?city=Tabarka" className="text-primary hover:underline font-medium">Tabarka</Link>,{" "}
                  {t('seo_auth.dest_south')}{" "}
                  <Link to="/search?city=Tozeur" className="text-primary hover:underline font-medium">Tozeur</Link>.
                </p>
              </div>

              <p>{t('seo_auth.p4')}</p>
            </div>

            <div className="lg:col-span-2 space-y-3">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={index}
                    className="group bg-card rounded-xl border border-border/40 p-5 hover:border-primary/20 hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm mb-1">{feature.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SeoAuthorityBlock;
